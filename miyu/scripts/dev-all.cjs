const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const pythonCmd = isWindows
  ? path.join(rootDir, 'ai-service', '.venv', 'Scripts', 'python.exe')
  : path.join(rootDir, 'ai-service', '.venv', 'bin', 'python');
const dockerCmd = 'docker';

const sharedAiEnv = {
  PYTHONPATH: path.join(rootDir, 'ai-service'),
  MIYU_AI_DB_PATH: path.join(rootDir, 'database', 'miyu.db'),
  MIYU_AI_STORAGE_ROOT: rootDir,
  MIYU_AI_HOST: '0.0.0.0',
  MIYU_AI_PORT: '8001',
  MIYU_AI_REDIS_URL: 'redis://localhost:6379/0',
};

const services = [
  {
    name: 'frontend',
    command: npmCmd,
    args: ['run', 'dev'],
    cwd: path.join(rootDir, 'frontend'),
    env: {},
  },
  {
    name: 'backend',
    command: npmCmd,
    args: ['run', 'dev'],
    cwd: path.join(rootDir, 'backend'),
    env: {},
  },
  {
    name: 'ai-service',
    command: pythonCmd,
    args: ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8001'],
    cwd: path.join(rootDir, 'ai-service'),
    env: sharedAiEnv,
  },
  {
    name: 'ai-worker',
    command: pythonCmd,
    args: [path.join(rootDir, 'ai-service', 'scripts', 'run_worker.py')],
    cwd: path.join(rootDir, 'ai-service'),
    env: sharedAiEnv,
  },
];

const children = [];
let shuttingDown = false;
let startedDockerRedis = false;

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
    });
  });
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    const finish = value => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(value);
      }
    };

    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureRedis() {
  if (await isPortOpen(6379)) {
    process.stdout.write('Redis already available on localhost:6379\n');
    return;
  }

  process.stdout.write('Redis is not running, starting docker redis...\n');

  try {
    await runCommand(dockerCmd, ['start', 'miyu-redis'], rootDir);
  } catch (_error) {
    await runCommand(dockerCmd, ['compose', 'up', '-d', 'redis'], path.join(rootDir, 'database'));
  }

  startedDockerRedis = true;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isPortOpen(6379)) {
      process.stdout.write('Redis is ready on localhost:6379\n');
      return;
    }
    await sleep(1000);
  }

  throw new Error('Redis did not become ready on localhost:6379');
}

function prefixStream(stream, prefix) {
  let buffer = '';
  stream.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.length > 0) {
        process.stdout.write(`[${prefix}] ${line}\n`);
      }
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) {
      process.stdout.write(`[${prefix}] ${buffer}\n`);
    }
  });
}

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    }
  }

  if (startedDockerRedis) {
    spawn(dockerCmd, ['compose', 'stop', 'redis'], {
      cwd: path.join(rootDir, 'database'),
      stdio: 'ignore',
      shell: isWindows,
    });
  }

  setTimeout(() => process.exit(exitCode), 500);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

async function main() {
  await ensureRedis();
  process.stdout.write('Starting frontend, backend, ai-service, and ai-worker...\n');

  for (const service of services) {
    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      env: { ...process.env, ...service.env },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: isWindows,
    });

    children.push(child);

    prefixStream(child.stdout, service.name);
    prefixStream(child.stderr, `${service.name}:err`);

    child.on('error', error => {
      process.stderr.write(`[${service.name}:err] failed to start: ${error.message}\n`);
      stopAll(1);
    });

    child.on('exit', code => {
      if (!shuttingDown && code !== 0) {
        process.stderr.write(`[${service.name}:err] exited with code ${code}\n`);
        stopAll(code || 1);
      }
    });
  }
}

main().catch(error => {
  process.stderr.write(`[dev-all:err] ${error.message}\n`);
  stopAll(1);
});
