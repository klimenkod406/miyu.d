import path from 'path';
import { randomUUID } from 'crypto';

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.m4a',
  '.ogg',
  '.aac',
]);

export interface ParsedTrackFilename {
  artistName: string;
  title: string;
  extension: string;
}

export function isSupportedAudioFile(fileName: string): boolean {
  return SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function isMp3AudioFile(fileName: string): boolean {
  return path.extname(fileName).toLowerCase() === '.mp3';
}

export function parseTrackFilename(fileName: string): ParsedTrackFilename | null {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    return null;
  }

  const baseName = path.basename(fileName, path.extname(fileName)).trim();
  const separator = baseName.indexOf(' - ');
  if (separator === -1) {
    return null;
  }

  const artistName = baseName.slice(0, separator).trim();
  const title = baseName.slice(separator + 3).trim();

  if (!artistName || !title) {
    return null;
  }

  return { artistName, title, extension };
}

export function resolveSeedTracksDir(rawEnvValue = process.env.SEED_TRACKS_DIR, cwd = process.cwd()): string {
  if (rawEnvValue && rawEnvValue.trim()) {
    return path.resolve(cwd, rawEnvValue.trim());
  }

  return path.resolve(cwd, 'seed-content/tracks');
}

export function buildStoredTrackFilename(
  originalFileName: string,
  timestamp = Date.now(),
  uniquePart: string = randomUUID(),
): string {
  const extension = path.extname(originalFileName).toLowerCase();
  return `${timestamp}-${uniquePart}${extension}`;
}
