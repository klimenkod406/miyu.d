import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeMultipartFileName,
  resolveBatchUploadFileName,
  type BatchManifestItem,
} from './admin-upload';

test('decodeMultipartFileName restores UTF-8 Cyrillic filename decoded as latin1 by multipart parser', () => {
  const expected = 'HammAli & Navai - А Если Это Любовь.mp3';
  const mojibake = Buffer.from(expected, 'utf8').toString('latin1');

  assert.equal(decodeMultipartFileName(mojibake), expected);
});

test('resolveBatchUploadFileName accepts matching manifest filename when multipart originalname is mojibake', () => {
  const manifestItem: BatchManifestItem = {
    fileName: 'HammAli & Navai - А Если Это Любовь.mp3',
    artistName: 'HammAli & Navai',
    title: 'А Если Это Любовь',
    duration: 180,
  };
  const originalName = Buffer.from(manifestItem.fileName!, 'utf8').toString('latin1');

  const resolved = resolveBatchUploadFileName(originalName, manifestItem);

  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.fileName, manifestItem.fileName);
  }
});

test('resolveBatchUploadFileName accepts matching manifest filename when originalname is already UTF-8', () => {
  const manifestItem: BatchManifestItem = {
    fileName: 'HammAli & Navai - А Если Это Любовь.mp3',
  };

  const resolved = resolveBatchUploadFileName(manifestItem.fileName!, manifestItem);

  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.fileName, manifestItem.fileName);
  }
});

test('resolveBatchUploadFileName rejects real manifest mismatch', () => {
  const resolved = resolveBatchUploadFileName('Artist - Track.mp3', {
    fileName: 'Different - Track.mp3',
  });

  assert.equal(resolved.ok, false);
  if (!resolved.ok) {
    assert.match(resolved.error, /Файл не совпадает с manifest/);
  }
});
