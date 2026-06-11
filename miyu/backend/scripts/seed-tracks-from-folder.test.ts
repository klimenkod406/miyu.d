import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildStoredTrackFilename,
  isMp3AudioFile,
  isSupportedAudioFile,
  parseTrackFilename,
  resolveSeedTracksDir,
} from './seed-tracks-from-folder-utils';

test('parseTrackFilename parses author and title from supported audio filename', () => {
  assert.deepEqual(parseTrackFilename('Kira - Neon Sky.mp3'), {
    artistName: 'Kira',
    title: 'Neon Sky',
    extension: '.mp3',
  });
});

test('parseTrackFilename keeps extra separators inside title', () => {
  assert.deepEqual(parseTrackFilename('Kira - Neon Sky - Live.flac'), {
    artistName: 'Kira',
    title: 'Neon Sky - Live',
    extension: '.flac',
  });
});

test('parseTrackFilename trims spaces around author and title', () => {
  assert.deepEqual(parseTrackFilename('  Miyu Artist   -   Night Walk  .wav'), {
    artistName: 'Miyu Artist',
    title: 'Night Walk',
    extension: '.wav',
  });
});

test('parseTrackFilename rejects filenames without the required separator', () => {
  assert.equal(parseTrackFilename('Kira Neon Sky.mp3'), null);
});

test('parseTrackFilename rejects unsupported file extensions', () => {
  assert.equal(parseTrackFilename('Kira - Cover.txt'), null);
});

test('isSupportedAudioFile recognizes supported formats case-insensitively', () => {
  assert.equal(isSupportedAudioFile('Track.MP3'), true);
  assert.equal(isSupportedAudioFile('Track.FLAC'), true);
  assert.equal(isSupportedAudioFile('Track.png'), false);
});

test('isMp3AudioFile only accepts MP3 files for admin batch import', () => {
  assert.equal(isMp3AudioFile('Artist - Track.mp3'), true);
  assert.equal(isMp3AudioFile('Artist - Track.MP3'), true);
  assert.equal(isMp3AudioFile('Artist - Track.wav'), false);
});

test('resolveSeedTracksDir prefers explicit env path relative to cwd', () => {
  assert.equal(
    resolveSeedTracksDir('custom/tracks', '/app'),
    path.resolve('/app', 'custom/tracks'),
  );
});

test('resolveSeedTracksDir uses container-friendly default when env is absent', () => {
  assert.equal(
    resolveSeedTracksDir(undefined, '/app'),
    path.resolve('/app', 'seed-content/tracks'),
  );
});

test('buildStoredTrackFilename creates deterministic safe filename when parts are supplied', () => {
  assert.equal(
    buildStoredTrackFilename('Kira - Neon Sky.MP3', 1710000000000, 'abc123'),
    '1710000000000-abc123.mp3',
  );
});
