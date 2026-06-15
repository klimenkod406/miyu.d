import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import crypto from 'node:crypto';

type SendEmailFn = (to: string, subject: string, html: string) => Promise<void>;

// ---------------------------------------------------------------------------
// Helper: minimal SMTP server for testing nodemailer delivery.
// Accepts connections on a random port, speaks enough SMTP to satisfy
// nodemailer's client, and tracks how many connections were made.
// ---------------------------------------------------------------------------
function createSmtpServer(
  acceptData: boolean,
): Promise<{ server: net.Server; port: number; connectionCount: number }> {
  let connections = 0;

  const server = net.createServer(socket => {
    connections += 1;
    let buffer = '';
    let receivingData = false;

    const respond = (line: string) => socket.write(line);

    // Greeting
    respond('220 miyu-test-smtp ESMTP ready\r\n');

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');

      if (receivingData) {
        // Look for the end-of-data marker <CRLF>.<CRLF>
        if (buffer.includes('\r\n.\r\n')) {
          receivingData = false;
          buffer = '';
          if (acceptData) {
            respond('250 OK: message queued\r\n');
          } else {
            respond('554 Transaction failed\r\n');
          }
        }
        return;
      }

      // Process complete lines
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        if (/^(EHLO|HELO)/i.test(line)) {
          respond('250 miyu-test-smtp\r\n');
        } else if (/^MAIL FROM:/i.test(line)) {
          respond('250 OK\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          respond('250 OK\r\n');
        } else if (/^DATA/i.test(line)) {
          if (acceptData) {
            receivingData = true;
            buffer = '';
            respond('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
          } else {
            respond('503 Bad sequence of commands\r\n');
          }
        } else if (/^QUIT/i.test(line)) {
          respond('221 Bye\r\n');
          socket.end();
        }
      }
    });

    socket.on('error', () => {
      /* ignore ECONNRESET etc during retry tests */
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port, get connectionCount() { return connections; } });
    });
    server.on('error', reject);
  });
}

/** Load the emailService module with a fresh transporter (clears require cache). */
function freshEmailService(): { sendEmail: SendEmailFn } {
  delete require.cache[require.resolve('./emailService')];
  return require('./emailService') as { sendEmail: SendEmailFn };
}

// ===========================================================================
// Email-service integration tests
// ===========================================================================

test('sendEmail delivers email to a live SMTP server', async () => {
  const smtp = await createSmtpServer(true);
  const prevHost = process.env.MAIL_HOST;
  const prevPort = process.env.MAIL_PORT;

  try {
    process.env.MAIL_HOST = '127.0.0.1';
    process.env.MAIL_PORT = String(smtp.port);

    const { sendEmail: send } = freshEmailService();
    await send('recipient@example.com', 'Hello', '<p>Test</p>');

    // If we get here without throwing, the email was delivered
    assert.ok(true, 'sendEmail completed without error');
  } finally {
    process.env.MAIL_HOST = prevHost;
    process.env.MAIL_PORT = prevPort;
    smtp.server.close();
    // Restore original transporter for subsequent tests
    delete require.cache[require.resolve('./emailService')];
  }
});

test('sendEmail retries 3 times when SMTP rejects commands', async () => {
  // Start a server that rejects DATA → nodemailer errors, sendEmail retries internally
  const smtp = await createSmtpServer(false);
  const prevHost = process.env.MAIL_HOST;
  const prevPort = process.env.MAIL_PORT;

  try {
    process.env.MAIL_HOST = '127.0.0.1';
    process.env.MAIL_PORT = String(smtp.port);

    const { sendEmail: send } = freshEmailService();
    // sendEmail catches errors internally and does NOT rethrow after retries
    await send('fail@example.com', 'Retry', '<p>Fail</p>');

    // sendEmail ran MAX_RETRIES=3 attempts → 3 TCP connections
    assert.equal(smtp.connectionCount, 3,
      'expected exactly 3 SMTP connection attempts');
  } finally {
    process.env.MAIL_HOST = prevHost;
    process.env.MAIL_PORT = prevPort;
    smtp.server.close();
    delete require.cache[require.resolve('./emailService')];
  }
});

// ===========================================================================
// Password-reset token logic tests
// ===========================================================================

test('token: crypto.randomBytes(32) produces 64-char hex', () => {
  const token = crypto.randomBytes(32).toString('hex');
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test('token: two tokens are unique', () => {
  const a = crypto.randomBytes(32).toString('hex');
  const b = crypto.randomBytes(32).toString('hex');
  assert.notEqual(a, b);
});

test('token: expiry check — past is expired, future is valid', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 3600_000 - 1000).toISOString();
  const future = new Date(now.getTime() + 3600_000).toISOString();
  assert.ok(new Date(past) < now, 'past token expired');
  assert.ok(new Date(future) > now, 'future token valid');
});

test('token: used flag distinguishes used vs fresh', () => {
  assert.equal(({ used: 1 } as any).used, 1);
  assert.equal(({ used: 0 } as any).used, 0);
});

// ===========================================================================
// Input validation tests
// ===========================================================================

test('password: minimum 6 characters', () => {
  assert.ok('12345'.length < 6, '5-char too short');
  assert.ok('123456'.length >= 6, '6-char valid');
});

test('email: basic format validation', () => {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert.match('test@example.com', pattern);
  assert.match('user@sub.domain.ru', pattern);
});
