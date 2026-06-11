import fsp from 'fs/promises';
import path from 'path';
import { getOne, runQuery } from '../db';
import { enqueueAnalyzeTrack, type EnqueueResult } from './aiService';
import {
  buildStoredTrackFilename,
  isMp3AudioFile,
  isSupportedAudioFile,
  parseTrackFilename,
} from '../scripts/seed-tracks-from-folder-utils';

export type ImportTrackStatus =
  | 'imported'
  | 'duplicate'
  | 'invalid_name'
  | 'unsupported_type'
  | 'artist_not_found'
  | 'failed';

export interface ImportTrackSource {
  originalFileName: string;
  sourcePath: string;
  duration?: number | null;
  artistName?: string;
  title?: string;
  requireMp3?: boolean;
  removeSourceOnSuccess?: boolean;
  uploadsDir?: string;
}

export interface ImportTrackResult {
  originalFileName: string;
  status: ImportTrackStatus;
  artistName?: string;
  artistId?: number;
  title?: string;
  trackId?: number;
  filePath?: string;
  aiQueued?: boolean;
  aiJobId?: string;
  error?: string;
}

export interface ImportTrackDependencies {
  getOne?: <T>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  runQuery?: (sql: string, params?: unknown[]) => Promise<{ lastID?: number }>;
  enqueueAnalyzeTrack?: (trackId: number, filePath?: string) => Promise<EnqueueResult>;
}

interface ArtistRow {
  id: number;
  username: string;
}

interface ExistingTrackRow {
  id: number;
}

const DEFAULT_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/tracks');

function depsWithDefaults(deps: ImportTrackDependencies = {}): Required<ImportTrackDependencies> {
  return {
    getOne: deps.getOne || getOne,
    runQuery: deps.runQuery || runQuery,
    enqueueAnalyzeTrack: deps.enqueueAnalyzeTrack || enqueueAnalyzeTrack,
  };
}

function failure(
  source: ImportTrackSource,
  status: Exclude<ImportTrackStatus, 'imported' | 'duplicate'>,
  error: string,
  artistName?: string,
  title?: string,
): ImportTrackResult {
  return {
    originalFileName: source.originalFileName,
    status,
    artistName,
    title,
    error,
  };
}

function normalizePositiveDuration(duration: number | null | undefined): number {
  if (!Number.isFinite(duration) || !duration || duration < 0) {
    return 0;
  }
  return Math.round(duration);
}

async function moveFileAcrossDevices(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fsp.rename(sourcePath, destinationPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error;
    }

    await fsp.copyFile(sourcePath, destinationPath);
    await fsp.unlink(sourcePath);
  }
}

export async function importTrackFromPath(
  source: ImportTrackSource,
  injectedDeps: ImportTrackDependencies = {},
): Promise<ImportTrackResult> {
  const deps = depsWithDefaults(injectedDeps);

  if (source.requireMp3 ? !isMp3AudioFile(source.originalFileName) : !isSupportedAudioFile(source.originalFileName)) {
    return failure(source, 'unsupported_type', source.requireMp3 ? 'Поддерживаются только MP3-файлы' : 'Неподдерживаемый аудиоформат');
  }

  const parsed = parseTrackFilename(source.originalFileName);
  const artistName = (source.artistName || parsed?.artistName || '').trim();
  const title = (source.title || parsed?.title || '').trim();

  if (!parsed || !artistName || !title) {
    return failure(source, 'invalid_name', 'Имя файла должно быть в формате Artist - Track.mp3', artistName, title);
  }

  const artist = await deps.getOne<ArtistRow>(
    "SELECT id, username FROM users WHERE role = 'artist' AND username = ? LIMIT 1",
    [artistName],
  );

  if (!artist) {
    return failure(source, 'artist_not_found', `Артист не найден: ${artistName}`, artistName, title);
  }

  const duplicate = await deps.getOne<ExistingTrackRow>(
    'SELECT id FROM tracks WHERE artist_id = ? AND title = ? LIMIT 1',
    [artist.id, title],
  );

  if (duplicate) {
    return {
      originalFileName: source.originalFileName,
      status: 'duplicate',
      artistName,
      artistId: artist.id,
      title,
      trackId: duplicate.id,
      error: 'Такой трек уже существует у этого артиста',
    };
  }

  const uploadsDir = source.uploadsDir || DEFAULT_UPLOADS_DIR;
  await fsp.mkdir(uploadsDir, { recursive: true });

  const storedFileName = buildStoredTrackFilename(source.originalFileName);
  const destinationPath = path.join(uploadsDir, storedFileName);
  const publicFilePath = `/uploads/tracks/${storedFileName}`;

  try {
    if (source.removeSourceOnSuccess) {
      await moveFileAcrossDevices(source.sourcePath, destinationPath);
    } else {
      await fsp.copyFile(source.sourcePath, destinationPath);
    }

    const insertResult = await deps.runQuery(
      `INSERT INTO tracks (
        artist_id, album_id, title, duration, file_path, cover_url,
        genre, bpm, key, lyrics, is_explicit, is_premium, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        artist.id,
        null,
        title,
        normalizePositiveDuration(source.duration),
        publicFilePath,
        null,
        null,
        null,
        null,
        null,
        0,
        0,
      ],
    );

    const trackId = Number(insertResult.lastID);
    const enqueueResult = await deps.enqueueAnalyzeTrack(trackId, publicFilePath);

    return {
      originalFileName: source.originalFileName,
      status: 'imported',
      artistName,
      artistId: artist.id,
      title,
      trackId,
      filePath: publicFilePath,
      aiQueued: enqueueResult.ok,
      aiJobId: enqueueResult.job_id,
      error: enqueueResult.ok ? undefined : enqueueResult.error,
    };
  } catch (error) {
    await fsp.unlink(destinationPath).catch(() => undefined);
    return failure(source, 'failed', error instanceof Error ? error.message : String(error), artistName, title);
  }
}
