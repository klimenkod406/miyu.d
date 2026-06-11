import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { importTrackFromPath, type ImportTrackDependencies } from './trackImportService';

function openDb(filePath: string): sqlite3.Database {
  return new sqlite3.Database(filePath);
}

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

function close(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function createHarness() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miyu-import-'));
  const db = openDb(path.join(root, 'test.db'));
  const uploadsDir = path.join(root, 'uploads', 'tracks');
  const sourceDir = path.join(root, 'sources');
  await fs.mkdir(sourceDir, { recursive: true });
  await run(db, `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, role TEXT NOT NULL)`);
  await run(db, `CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    album_id INTEGER,
    title TEXT NOT NULL,
    duration INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    cover_url TEXT,
    genre TEXT,
    bpm INTEGER,
    key TEXT,
    lyrics TEXT,
    is_explicit INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  const deps: ImportTrackDependencies = {
    getOne: <T>(sql: string, params?: unknown[]) => get<T>(db, sql, params),
    runQuery: (sql: string, params?: unknown[]) => run(db, sql, params),
    enqueueAnalyzeTrack: async (trackId: number) => ({ ok: true, job_id: `job-${trackId}` }),
  };

  return { root, db, uploadsDir, sourceDir, deps };
}

async function writeSource(sourceDir: string, fileName: string): Promise<string> {
  const sourcePath = path.join(sourceDir, fileName);
  await fs.writeFile(sourcePath, Buffer.from('fake mp3 bytes'));
  return sourcePath;
}

test('importTrackFromPath imports a valid Artist - Track.mp3 file and enqueues AI', async () => {
  const h = await createHarness();
  try {
    await run(h.db, `INSERT INTO users (username, role) VALUES ('Miyu', 'artist')`);
    const sourcePath = await writeSource(h.sourceDir, 'Miyu - Night.mp3');

    const result = await importTrackFromPath({
      originalFileName: 'Miyu - Night.mp3',
      sourcePath,
      duration: 184,
      requireMp3: true,
      uploadsDir: h.uploadsDir,
    }, h.deps);

    assert.equal(result.status, 'imported');
    assert.equal(result.artistName, 'Miyu');
    assert.equal(result.title, 'Night');
    assert.equal(result.aiQueued, true);
    assert.equal(result.aiJobId, 'job-1');
    assert.match(result.filePath || '', /^\/uploads\/tracks\/.+\.mp3$/);

    const row = await get<{ artist_id: number; title: string; duration: number; status: string; file_path: string }>(
      h.db,
      'SELECT artist_id, title, duration, status, file_path FROM tracks WHERE id = ?',
      [result.trackId],
    );
    assert.deepEqual(row, {
      artist_id: 1,
      title: 'Night',
      duration: 184,
      status: 'pending',
      file_path: result.filePath,
    });

    const storedFile = path.join(h.uploadsDir, path.basename(result.filePath!));
    assert.equal(await fs.readFile(storedFile, 'utf8'), 'fake mp3 bytes');
  } finally {
    await close(h.db);
    await fs.rm(h.root, { recursive: true, force: true });
  }
});

test('importTrackFromPath copies and removes temp uploads when rename crosses devices', async () => {
  const h = await createHarness();
  const originalRename = fs.rename;

  try {
    await run(h.db, `INSERT INTO users (username, role) VALUES ('Miyu', 'artist')`);
    const sourcePath = await writeSource(h.sourceDir, 'Miyu - Cross Device.mp3');

    (fs as typeof fs & { rename: typeof fs.rename }).rename = async () => {
      const error = new Error('cross-device link not permitted') as NodeJS.ErrnoException;
      error.code = 'EXDEV';
      throw error;
    };

    const result = await importTrackFromPath({
      originalFileName: 'Miyu - Cross Device.mp3',
      sourcePath,
      duration: 200,
      requireMp3: true,
      removeSourceOnSuccess: true,
      uploadsDir: h.uploadsDir,
    }, h.deps);

    assert.equal(result.status, 'imported');
    const storedFile = path.join(h.uploadsDir, path.basename(result.filePath!));
    assert.equal(await fs.readFile(storedFile, 'utf8'), 'fake mp3 bytes');
    await assert.rejects(fs.access(sourcePath), { code: 'ENOENT' });
  } finally {
    (fs as typeof fs & { rename: typeof fs.rename }).rename = originalRename;
    await close(h.db);
    await fs.rm(h.root, { recursive: true, force: true });
  }
});

test('importTrackFromPath rejects non-MP3 files when requireMp3 is true', async () => {
  const h = await createHarness();
  try {
    await run(h.db, `INSERT INTO users (username, role) VALUES ('Miyu', 'artist')`);
    const sourcePath = await writeSource(h.sourceDir, 'Miyu - Night.wav');

    const result = await importTrackFromPath({
      originalFileName: 'Miyu - Night.wav',
      sourcePath,
      requireMp3: true,
      uploadsDir: h.uploadsDir,
    }, h.deps);

    assert.equal(result.status, 'unsupported_type');
    const count = await get<{ count: number }>(h.db, 'SELECT COUNT(*) as count FROM tracks');
    assert.equal(count?.count, 0);
  } finally {
    await close(h.db);
    await fs.rm(h.root, { recursive: true, force: true });
  }
});

test('importTrackFromPath reports unknown artist without creating a track', async () => {
  const h = await createHarness();
  try {
    const sourcePath = await writeSource(h.sourceDir, 'Unknown - Night.mp3');

    const result = await importTrackFromPath({
      originalFileName: 'Unknown - Night.mp3',
      sourcePath,
      requireMp3: true,
      uploadsDir: h.uploadsDir,
    }, h.deps);

    assert.equal(result.status, 'artist_not_found');
    assert.equal(result.artistName, 'Unknown');
    const count = await get<{ count: number }>(h.db, 'SELECT COUNT(*) as count FROM tracks');
    assert.equal(count?.count, 0);
  } finally {
    await close(h.db);
    await fs.rm(h.root, { recursive: true, force: true });
  }
});

test('importTrackFromPath returns duplicate for existing artist/title pair', async () => {
  const h = await createHarness();
  try {
    await run(h.db, `INSERT INTO users (username, role) VALUES ('Miyu', 'artist')`);
    await run(h.db, `INSERT INTO tracks (artist_id, title, duration, file_path, status) VALUES (1, 'Night', 180, '/uploads/tracks/existing.mp3', 'pending')`);
    const sourcePath = await writeSource(h.sourceDir, 'Miyu - Night.mp3');

    const result = await importTrackFromPath({
      originalFileName: 'Miyu - Night.mp3',
      sourcePath,
      requireMp3: true,
      uploadsDir: h.uploadsDir,
    }, h.deps);

    assert.equal(result.status, 'duplicate');
    assert.equal(result.trackId, 1);
    const count = await get<{ count: number }>(h.db, 'SELECT COUNT(*) as count FROM tracks');
    assert.equal(count?.count, 1);
  } finally {
    await close(h.db);
    await fs.rm(h.root, { recursive: true, force: true });
  }
});
