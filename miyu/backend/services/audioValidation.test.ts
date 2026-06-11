import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isProbablyMp3File } from './audioValidation';

async function withTempFile(bytes: number[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'miyu-audio-'));
  const filePath = path.join(dir, 'sample.mp3');
  await fs.writeFile(filePath, Buffer.from(bytes));
  return filePath;
}

test('isProbablyMp3File accepts ID3-tagged MP3 files', async () => {
  const filePath = await withTempFile([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
  try {
    assert.equal(await isProbablyMp3File(filePath), true);
  } finally {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  }
});

test('isProbablyMp3File accepts MPEG frame sync headers', async () => {
  const filePath = await withTempFile([0xff, 0xfb, 0x90, 0x64]);
  try {
    assert.equal(await isProbablyMp3File(filePath), true);
  } finally {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  }
});

test('isProbablyMp3File rejects renamed non-MP3 files', async () => {
  const filePath = await withTempFile([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
  try {
    assert.equal(await isProbablyMp3File(filePath), false);
  } finally {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  }
});
