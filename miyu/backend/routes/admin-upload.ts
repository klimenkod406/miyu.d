import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { AuthRequest, authenticateToken, authorizeRole } from '../middleware/auth';
import { importTrackFromPath, type ImportTrackResult } from '../services/trackImportService';
import { parseTrackFilename } from '../scripts/seed-tracks-from-folder-utils';
import { isProbablyMp3File } from '../services/audioValidation';

const router = Router();
const tmpImportDir = path.resolve(process.cwd(), 'tmp/admin-imports');

if (!fs.existsSync(tmpImportDir)) {
  fs.mkdirSync(tmpImportDir, { recursive: true });
}

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const maxUploadMb = positiveIntEnv('MAX_UPLOAD_MB', 200);
const maxBatchFiles = positiveIntEnv('MAX_BATCH_FILES', 100);

const upload = multer({
  dest: tmpImportDir,
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
    files: maxBatchFiles,
  },
});

export interface BatchManifestItem {
  fileName?: string;
  filename?: string;
  originalFileName?: string;
  artistName?: string;
  title?: string;
  duration?: number;
}

interface BatchManifest {
  items?: BatchManifestItem[];
}

function parseManifest(rawValue: unknown): BatchManifest {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return { items: [] };
  }

  const parsed = JSON.parse(rawValue) as BatchManifest;
  if (!Array.isArray(parsed.items)) {
    throw new Error('manifest.items must be an array');
  }
  return parsed;
}

function manifestFileName(item: BatchManifestItem | undefined): string | undefined {
  return item?.fileName || item?.filename || item?.originalFileName;
}

function normalizeFileName(value: string): string {
  return value.normalize('NFC');
}

export function decodeMultipartFileName(fileName: string): string {
  const normalized = normalizeFileName(fileName);
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');

  if (decoded.includes('�')) {
    return normalized;
  }

  return normalizeFileName(decoded);
}

export function resolveBatchUploadFileName(
  originalFileName: string,
  manifestItem?: BatchManifestItem,
): { ok: true; fileName: string } | { ok: false; originalFileName: string; error: string } {
  const normalizedOriginalFileName = normalizeFileName(originalFileName);
  const decodedOriginalFileName = decodeMultipartFileName(originalFileName);
  const expectedFileName = manifestFileName(manifestItem);

  if (!expectedFileName) {
    return { ok: true, fileName: decodedOriginalFileName };
  }

  const normalizedExpectedFileName = normalizeFileName(expectedFileName);
  if (
    normalizedExpectedFileName !== normalizedOriginalFileName
    && normalizedExpectedFileName !== decodedOriginalFileName
  ) {
    return {
      ok: false,
      originalFileName: decodedOriginalFileName,
      error: `Файл не совпадает с manifest: ожидался ${expectedFileName}`,
    };
  }

  return { ok: true, fileName: normalizedExpectedFileName };
}

function summarize(results: ImportTrackResult[]) {
  const imported = results.filter(item => item.status === 'imported').length;
  const duplicates = results.filter(item => item.status === 'duplicate').length;
  const failed = results.length - imported - duplicates;
  const aiQueued = results.filter(item => item.aiQueued).length;

  return {
    received: results.length,
    imported,
    duplicates,
    failed,
    aiQueued,
  };
}

async function cleanupUploadedFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map(file => fsp.unlink(file.path).catch(() => undefined)));
}

router.post(
  '/tracks/batch',
  authenticateToken,
  authorizeRole(['admin']),
  upload.array('tracks', maxBatchFiles),
  async (req: AuthRequest, res: Response) => {
    const files = (req.files || []) as Express.Multer.File[];

    try {
      const manifest = parseManifest(req.body?.manifest);
      const results: ImportTrackResult[] = [];

      if (files.length === 0) {
        return res.status(400).json({ error: 'Добавьте MP3-файлы для загрузки' });
      }

      for (const [index, file] of files.entries()) {
        const manifestItem = manifest.items?.[index];
        const resolvedFileName = resolveBatchUploadFileName(file.originalname, manifestItem);

        if (!resolvedFileName.ok) {
          results.push({
            originalFileName: resolvedFileName.originalFileName,
            status: 'failed',
            error: resolvedFileName.error,
          });
          await fsp.unlink(file.path).catch(() => undefined);
          continue;
        }

        const originalFileName = resolvedFileName.fileName;
        const parsed = parseTrackFilename(originalFileName);
        if (!parsed) {
          results.push({
            originalFileName,
            status: 'invalid_name',
            error: 'Имя файла должно быть в формате Artist - Track.mp3',
          });
          await fsp.unlink(file.path).catch(() => undefined);
          continue;
        }

        if (!file.mimetype.includes('mpeg') && !file.mimetype.includes('mp3')) {
          results.push({
            originalFileName,
            status: 'unsupported_type',
            error: 'Файл должен быть MP3-аудио',
          });
          await fsp.unlink(file.path).catch(() => undefined);
          continue;
        }

        if (!(await isProbablyMp3File(file.path))) {
          results.push({
            originalFileName,
            status: 'unsupported_type',
            error: 'Содержимое файла не похоже на MP3',
          });
          await fsp.unlink(file.path).catch(() => undefined);
          continue;
        }

        const result = await importTrackFromPath({
          originalFileName,
          sourcePath: file.path,
          duration: manifestItem?.duration,
          artistName: manifestItem?.artistName || parsed.artistName,
          title: manifestItem?.title || parsed.title,
          requireMp3: true,
          removeSourceOnSuccess: true,
        });
        results.push(result);

        if (result.status !== 'imported') {
          await fsp.unlink(file.path).catch(() => undefined);
        }
      }

      return res.status(201).json({
        summary: summarize(results),
        results,
      });
    } catch (error) {
      await cleanupUploadedFiles(files);
      console.error('Admin batch upload error:', error);
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Ошибка batch upload' });
    }
  },
);

export default router;
