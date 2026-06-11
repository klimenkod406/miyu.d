import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { importTrackFromPath } from '../services/trackImportService';
import {
  isSupportedAudioFile,
  resolveSeedTracksDir,
} from './seed-tracks-from-folder-utils';

interface SeedReport {
  scanned: number;
  imported: number;
  duplicates: number;
  artistNotFound: number;
  invalidName: number;
  unsupported: number;
  errors: number;
}

const report: SeedReport = {
  scanned: 0,
  imported: 0,
  duplicates: 0,
  artistNotFound: 0,
  invalidName: 0,
  unsupported: 0,
  errors: 0,
};

function logReport(): void {
  console.log('\nSeed tracks report:');
  console.log(`- scanned: ${report.scanned}`);
  console.log(`- imported: ${report.imported}`);
  console.log(`- duplicates: ${report.duplicates}`);
  console.log(`- artist not found: ${report.artistNotFound}`);
  console.log(`- invalid name: ${report.invalidName}`);
  console.log(`- unsupported: ${report.unsupported}`);
  console.log(`- errors: ${report.errors}`);
}

async function ensureDirectoryExists(dirPath: string, label: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${label} directory does not exist: ${dirPath}`);
  }

  const stat = await fsp.stat(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`${label} path is not a directory: ${dirPath}`);
  }
}

async function listSeedFiles(seedDir: string): Promise<string[]> {
  const entries = await fsp.readdir(seedDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function importOneFile(seedDir: string, uploadsDir: string, fileName: string): Promise<void> {
  report.scanned += 1;

  if (!isSupportedAudioFile(fileName)) {
    report.unsupported += 1;
    console.log(`skip unsupported: ${fileName}`);
    return;
  }

  const result = await importTrackFromPath({
    originalFileName: fileName,
    sourcePath: path.join(seedDir, fileName),
    uploadsDir,
  });

  switch (result.status) {
    case 'imported':
      report.imported += 1;
      console.log(`imported: ${result.artistName} - ${result.title}`);
      if (result.aiQueued) {
        console.log(`  ai queued: track=${result.trackId} job=${result.aiJobId}`);
      } else {
        console.warn(`  ai enqueue skipped/failed: track=${result.trackId} reason=${result.error}`);
      }
      return;
    case 'duplicate':
      report.duplicates += 1;
      console.log(`skip duplicate: ${result.artistName} - ${result.title}`);
      return;
    case 'artist_not_found':
      report.artistNotFound += 1;
      console.log(`skip artist not found: ${result.artistName} (${fileName})`);
      return;
    case 'invalid_name':
      report.invalidName += 1;
      console.log(`skip invalid name: ${fileName}`);
      return;
    case 'unsupported_type':
      report.unsupported += 1;
      console.log(`skip unsupported: ${fileName}`);
      return;
    case 'failed':
    default:
      report.errors += 1;
      console.error(`error importing ${fileName}: ${result.error || 'unknown error'}`);
  }
}

async function closeDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function seedTracksFromFolder(): Promise<void> {
  const seedDir = resolveSeedTracksDir();
  const uploadsDir = path.resolve(process.cwd(), 'uploads/tracks');

  console.log(`Seed tracks directory: ${seedDir}`);
  console.log(`Uploads directory: ${uploadsDir}`);

  await ensureDirectoryExists(seedDir, 'Seed tracks');

  const files = await listSeedFiles(seedDir);
  if (files.length === 0) {
    console.log('No files found in seed tracks directory.');
    return;
  }

  for (const fileName of files) {
    await importOneFile(seedDir, uploadsDir, fileName);
  }
}

async function main(): Promise<void> {
  try {
    await seedTracksFromFolder();
    logReport();
    process.exitCode = report.errors > 0 ? 1 : 0;
  } catch (error) {
    console.error('Seed tracks failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch((error) => {
      console.warn('Failed to close database:', error instanceof Error ? error.message : error);
    });
  }
}

if (require.main === module) {
  main();
}
