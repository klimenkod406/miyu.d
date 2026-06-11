# Seed Tracks From Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually-run seed command that imports audio files named `Автор - Название.mp3` to already-existing Miyu artists, keeping tracks in the normal pending/moderation/AI pipeline.

**Architecture:** Keep the importer inside `backend/scripts` so it can reuse the existing SQLite helpers and AI enqueue client. Split pure filename/path helpers into a small utility file with Node built-in tests, while the main script handles filesystem copying, DB lookup/insert, duplicate skipping, and AI enqueue reporting. Wire the seed folder into the production backend container as a read-only compose volume, but never run the importer automatically during container startup.

**Tech Stack:** Node.js 20, TypeScript, ts-node for dev scripts, compiled CommonJS in production, SQLite via existing `backend/db`, Docker Compose, Node built-in `node:test`.

---

## File Structure

- Create: `backend/scripts/seed-tracks-from-folder-utils.ts`
  - Pure helpers only: supported audio extension check, `Автор - Название` parsing, seed directory resolution, stored filename generation.
  - No DB imports and no filesystem side effects at module import time.

- Create: `backend/scripts/seed-tracks-from-folder.test.ts`
  - Node built-in tests for the pure helpers.
  - Compiled by existing backend `tsconfig.json`, then run via `node --test`.

- Create: `backend/scripts/seed-tracks-from-folder.ts`
  - Manual importer script.
  - Reads `SEED_TRACKS_DIR` or default folder, finds existing artists, skips unknown artists/duplicates, copies files to `uploads/tracks`, inserts `tracks.status = 'pending'`, and calls existing AI enqueue client.

- Modify: `backend/package.json`
  - Add `seed:tracks` for production/container execution from compiled JS.
  - Add `seed:tracks:dev` for local TypeScript execution.
  - Add `test:seed-tracks` for the focused helper test.

- Modify: `backend/package-lock.json`
  - Keep the lockfile synchronized with `package.json` so backend Docker `npm ci` succeeds in a clean container.

- Create: `backend/.dockerignore`
  - Exclude local `node_modules`, `dist`, TypeScript build info, env files, and logs from the backend Docker build context.
  - Do not exclude `uploads` because the existing backend Dockerfile seeds `/opt/seed-uploads` from that directory.

- Modify: `docker-compose.prod.yml`
  - Mount `./seed-content` into the backend container read-only so the manual seed command can see files on VPS.

- Modify: `.env.production.example`
  - Document `SEED_TRACKS_DIR=/app/seed-content/tracks`.

- Modify: `.gitignore`
  - Ignore actual seed audio files while allowing a directory placeholder.

- Create: `seed-content/tracks/.gitkeep`
  - Preserve the expected folder structure without committing audio files.

- Modify: `docs/UPLOAD_TO_VPS.md`
  - Update ordinary VPS launch instructions and add the separate manual track import flow.

**Git policy:** Do not run commit commands unless Denis explicitly authorizes commits during execution. Commit commands below are checkpoints only and must be skipped without explicit commit approval.

---

### Task 1: Add tested seed filename/path helpers

**Files:**
- Create: `backend/scripts/seed-tracks-from-folder.test.ts`
- Create: `backend/scripts/seed-tracks-from-folder-utils.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Add the focused test script to `backend/package.json`**

Change the `scripts` block in `backend/package.json` to:

```json
"scripts": {
  "dev": "ts-node index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "seed:tracks": "node dist/scripts/seed-tracks-from-folder.js",
  "seed:tracks:dev": "ts-node scripts/seed-tracks-from-folder.ts",
  "test:seed-tracks": "npm run build && node --test dist/scripts/seed-tracks-from-folder.test.js",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

- [ ] **Step 2: Write the failing helper tests**

Create `backend/scripts/seed-tracks-from-folder.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildStoredTrackFilename,
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
```

- [ ] **Step 3: Run the helper tests and verify they fail because the utils module does not exist yet**

Run:

```bash
cd backend && npm run test:seed-tracks
```

Expected: FAIL during TypeScript build with an error like:

```text
Cannot find module './seed-tracks-from-folder-utils'
```

- [ ] **Step 4: Implement the pure helper module**

Create `backend/scripts/seed-tracks-from-folder-utils.ts`:

```ts
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
  uniquePart = randomUUID(),
): string {
  const extension = path.extname(originalFileName).toLowerCase();
  return `${timestamp}-${uniquePart}${extension}`;
}
```

- [ ] **Step 5: Run the helper tests and verify they pass**

Run:

```bash
cd backend && npm run test:seed-tracks
```

Expected: PASS, including output from `node --test` similar to:

```text
# pass 9
# fail 0
```

- [ ] **Step 6: Commit checkpoint only if commits were explicitly authorized**

If Denis explicitly authorized commits, run:

```bash
git add backend/package.json backend/scripts/seed-tracks-from-folder-utils.ts backend/scripts/seed-tracks-from-folder.test.ts
git commit -m "test: add seed track filename helpers"
```

If commits were not explicitly authorized, skip this step.

---

### Task 2: Implement the manual track import script

**Files:**
- Create: `backend/scripts/seed-tracks-from-folder.ts`
- Reuse: `backend/scripts/seed-tracks-from-folder-utils.ts`
- Reuse: `backend/db/index.ts`
- Reuse: `backend/services/aiService.ts`

- [ ] **Step 1: Create the importer script**

Create `backend/scripts/seed-tracks-from-folder.ts`:

```ts
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { db, getOne, runQuery } from '../db';
import { enqueueAnalyzeTrack } from '../services/aiService';
import {
  buildStoredTrackFilename,
  isSupportedAudioFile,
  parseTrackFilename,
  resolveSeedTracksDir,
} from './seed-tracks-from-folder-utils';

interface ArtistRow {
  id: number;
  username: string;
}

interface ExistingTrackRow {
  id: number;
}

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

async function findArtist(username: string): Promise<ArtistRow | undefined> {
  return getOne<ArtistRow>(
    "SELECT id, username FROM users WHERE role = 'artist' AND username = ? LIMIT 1",
    [username],
  );
}

async function findDuplicateTrack(artistId: number, title: string): Promise<ExistingTrackRow | undefined> {
  return getOne<ExistingTrackRow>(
    'SELECT id FROM tracks WHERE artist_id = ? AND title = ? LIMIT 1',
    [artistId, title],
  );
}

async function importOneFile(seedDir: string, uploadsDir: string, fileName: string): Promise<void> {
  report.scanned += 1;

  if (!isSupportedAudioFile(fileName)) {
    report.unsupported += 1;
    console.log(`skip unsupported: ${fileName}`);
    return;
  }

  const parsed = parseTrackFilename(fileName);
  if (!parsed) {
    report.invalidName += 1;
    console.log(`skip invalid name: ${fileName}`);
    return;
  }

  const artist = await findArtist(parsed.artistName);
  if (!artist) {
    report.artistNotFound += 1;
    console.log(`skip artist not found: ${parsed.artistName} (${fileName})`);
    return;
  }

  const duplicate = await findDuplicateTrack(artist.id, parsed.title);
  if (duplicate) {
    report.duplicates += 1;
    console.log(`skip duplicate: ${artist.username} - ${parsed.title}`);
    return;
  }

  await fsp.mkdir(uploadsDir, { recursive: true });

  const storedFileName = buildStoredTrackFilename(fileName);
  const sourcePath = path.join(seedDir, fileName);
  const destinationPath = path.join(uploadsDir, storedFileName);
  const publicFilePath = `/uploads/tracks/${storedFileName}`;

  try {
    await fsp.copyFile(sourcePath, destinationPath);

    const result = await runQuery(
      `INSERT INTO tracks (
        artist_id, album_id, title, duration, file_path, cover_url,
        genre, bpm, key, lyrics, is_explicit, is_premium, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        artist.id,
        null,
        parsed.title,
        0,
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

    report.imported += 1;
    console.log(`imported: ${artist.username} - ${parsed.title}`);

    const enqueueResult = await enqueueAnalyzeTrack(result.lastID, publicFilePath);
    if (enqueueResult.ok) {
      console.log(`  ai queued: track=${result.lastID} job=${enqueueResult.job_id}`);
    } else {
      console.warn(`  ai enqueue skipped/failed: track=${result.lastID} reason=${enqueueResult.error}`);
    }
  } catch (error) {
    report.errors += 1;
    await fsp.unlink(destinationPath).catch(() => undefined);
    console.error(`error importing ${fileName}:`, error instanceof Error ? error.message : error);
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
```

- [ ] **Step 2: Run backend build**

Run:

```bash
cd backend && npm run build
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run the focused helper tests again**

Run:

```bash
cd backend && npm run test:seed-tracks
```

Expected: PASS with `# fail 0`.

- [ ] **Step 4: Run a safe missing-folder smoke check**

Run:

```bash
cd backend && SEED_TRACKS_DIR=../seed-content/missing npm run seed:tracks
```

Expected: command exits non-zero and prints:

```text
Seed tracks failed: Seed tracks directory does not exist:
```

- [ ] **Step 5: Commit checkpoint only if commits were explicitly authorized**

If Denis explicitly authorized commits, run:

```bash
git add backend/scripts/seed-tracks-from-folder.ts backend/scripts/seed-tracks-from-folder-utils.ts backend/scripts/seed-tracks-from-folder.test.ts backend/package.json
git commit -m "feat: import seed tracks for existing artists"
```

If commits were not explicitly authorized, skip this step.

---

### Task 3: Wire the seed folder into production without auto-running it

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `.env.production.example`
- Modify: `.gitignore`
- Create: `seed-content/tracks/.gitkeep`

- [ ] **Step 1: Mount seed content read-only in the backend service**

In `docker-compose.prod.yml`, update the `backend.volumes` block to:

```yaml
    volumes:
      - ./database:/app/database
      - ./uploads:/app/uploads
      - ./seed-content:/app/seed-content:ro
```

Do not add any seed command to `entrypoint`, `command`, `depends_on`, or service startup.

- [ ] **Step 2: Add the production seed directory variable**

Update `.env.production.example` to:

```env
JWT_SECRET=change-me-to-a-long-random-secret
AI_SERVICE_ENABLED=true
SEED_TRACKS_DIR=/app/seed-content/tracks
```

- [ ] **Step 3: Ignore real seed audio files**

Append this block to `.gitignore`:

```gitignore
# ============================================
# Seed media for manual VPS import
# ============================================
seed-content/tracks/*
!seed-content/tracks/.gitkeep
```

- [ ] **Step 4: Preserve the seed folder structure**

Create `seed-content/tracks/.gitkeep` as an empty file.

- [ ] **Step 5: Verify Docker Compose config parses**

Run:

```bash
docker compose --env-file .env.production.example -f docker-compose.prod.yml config >/dev/null
```

Expected: exits 0 with no YAML/config error.

- [ ] **Step 6: Commit checkpoint only if commits were explicitly authorized**

If Denis explicitly authorized commits, run:

```bash
git add docker-compose.prod.yml .env.production.example .gitignore seed-content/tracks/.gitkeep
git commit -m "chore: wire manual seed content directory"
```

If commits were not explicitly authorized, skip this step.

---

### Task 4: Update VPS upload documentation

**Files:**
- Modify: `docs/UPLOAD_TO_VPS.md`

- [ ] **Step 1: Replace the VPS document with the updated instructions**

Replace `docs/UPLOAD_TO_VPS.md` with:

```markdown
# Подготовка Miyu к заливке на VPS

Проект подготовлен для обычного запуска на VPS через Docker Compose. Первичный импорт треков выполняется только отдельной ручной командой и не запускается автоматически при старте контейнеров.

## Что уже добавлено для VPS

- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `backend/docker-entrypoint.sh`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `deploy/nginx/default.conf`
- `.env.production.example`
- `seed-content/tracks/` для ручного импорта треков

## Как отправить проект с Windows на сервер

Пример через `scp`:

```powershell
scp -r C:\Users\Денис\Desktop\miyu root@IP_СЕРВЕРА:/root/
```

Если проект большой и `scp` идет медленно, лучше архивом:

```powershell
tar -czf miyu-upload.tar.gz -C C:\Users\Денис\Desktop miyu
scp miyu-upload.tar.gz root@IP_СЕРВЕРА:/root/
```

На сервере:

```bash
cd /root
tar -xzf miyu-upload.tar.gz
cd miyu
```

## Перед первым запуском на сервере

Создай production env:

```bash
cp .env.production.example .env.production
```

Отредактируй `.env.production` и задай сильный секрет:

```env
JWT_SECRET=очень-длинный-случайный-секрет
AI_SERVICE_ENABLED=true
SEED_TRACKS_DIR=/app/seed-content/tracks
```

## Обычный запуск на VPS

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

После запуска сайт будет доступен по IP сервера:

```text
http://IP_СЕРВЕРА
```

## Проверка контейнеров

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx backend ai-service
```

## Ручной импорт треков существующим артистам

Скрипт не создаёт новых артистов. Он только добавляет треки тем артистам, которые уже есть в БД с ролью `artist`.

Положи аудиофайлы в папку:

```text
seed-content/tracks/
```

Формат имени файла:

```text
Автор - Название.mp3
```

Пример:

```text
Kira - Neon Sky.mp3
Kira - Rain Again.mp3
Miyu Artist - Night Walk.mp3
```

Имя `Автор` должно совпадать с `users.username` существующего артиста. Если артист не найден, файл будет пропущен.

Запуск импорта:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run seed:tracks
```

Что делает импорт:

- ищет существующего артиста по имени из файла;
- пропускает неизвестных артистов;
- пропускает дубли `artist + title`;
- копирует трек в `uploads/tracks`;
- создаёт трек со статусом `pending`;
- отправляет трек в AI-анализ;
- выводит итоговый отчёт по импортированным и пропущенным файлам.

После AI-анализа треки проходят обычный moderation pipeline: автоодобрение, ожидание модерации или `ai_flagged`.

## Важно

- импорт треков запускается только вручную;
- перезапуск Docker Compose не повторяет импорт;
- реальные аудиофайлы из `seed-content/tracks/` не нужно коммитить в git;
- если на сервере включен firewall, открой порт `80`;
- позже можно добавить домен и HTTPS.
```

- [ ] **Step 2: Verify the docs mention separate manual import**

Run:

```bash
grep -n "Ручной импорт треков" docs/UPLOAD_TO_VPS.md && grep -n "только вручную" docs/UPLOAD_TO_VPS.md
```

Expected: both commands print matching lines.

- [ ] **Step 3: Commit checkpoint only if commits were explicitly authorized**

If Denis explicitly authorized commits, run:

```bash
git add docs/UPLOAD_TO_VPS.md
git commit -m "docs: document manual track seed import"
```

If commits were not explicitly authorized, skip this step.

---

### Task 5: Final verification

**Files:**
- Verify all files from Tasks 1-4.

- [ ] **Step 1: Run backend build**

Run:

```bash
cd backend && npm run build
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run focused seed helper tests**

Run:

```bash
cd backend && npm run test:seed-tracks
```

Expected: PASS with `# fail 0`.

- [ ] **Step 3: Validate production compose file**

Run:

```bash
docker compose --env-file .env.production.example -f docker-compose.prod.yml config >/dev/null
```

Expected: exits 0 with no Docker Compose config errors.

- [ ] **Step 4: Check that seed media is ignored but placeholder is trackable**

Run:

```bash
git check-ignore seed-content/tracks/example.mp3 && git check-ignore -v seed-content/tracks/example.mp3
```

Expected: output shows `seed-content/tracks/example.mp3` is ignored by the new `.gitignore` rule.

Run:

```bash
git check-ignore seed-content/tracks/.gitkeep
```

Expected: exits non-zero, meaning `.gitkeep` is not ignored.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff -- backend/package.json backend/package-lock.json backend/.dockerignore backend/scripts/seed-tracks-from-folder-utils.ts backend/scripts/seed-tracks-from-folder.test.ts backend/scripts/seed-tracks-from-folder.ts docker-compose.prod.yml .env.production.example .gitignore docs/UPLOAD_TO_VPS.md
```

Expected: diff only contains the seed importer, production seed folder wiring, ignore rules, and VPS documentation updates.

- [ ] **Step 6: Request independent verification if implementation was non-trivial**

Because this changes more than three files and touches production Docker configuration, dispatch the `verification` agent with:

```text
Original request: prepare the project for ordinary VPS launch and add a manual script that imports tracks from seed-content/tracks to existing artists only, keeping tracks in the moderation/AI pipeline.
Changed files: backend/package.json, backend/package-lock.json, backend/.dockerignore, backend/scripts/seed-tracks-from-folder-utils.ts, backend/scripts/seed-tracks-from-folder.test.ts, backend/scripts/seed-tracks-from-folder.ts, docker-compose.prod.yml, .env.production.example, .gitignore, seed-content/tracks/.gitkeep, docs/UPLOAD_TO_VPS.md.
Approach: compiled backend seed script reads Автор - Название audio files, finds existing users.role='artist', skips missing artists and duplicates, copies to uploads/tracks, inserts tracks.status='pending', enqueues AI analysis, and is only run manually.
Plan file: docs/superpowers/plans/2026-05-28-seed-tracks-from-folder.md
```

Expected verifier verdict: PASS or actionable FAIL/PARTIAL with command evidence.

- [ ] **Step 7: Commit checkpoint only if commits were explicitly authorized**

If Denis explicitly authorized commits, run:

```bash
git add backend/package.json backend/package-lock.json backend/.dockerignore backend/scripts/seed-tracks-from-folder-utils.ts backend/scripts/seed-tracks-from-folder.test.ts backend/scripts/seed-tracks-from-folder.ts docker-compose.prod.yml .env.production.example .gitignore seed-content/tracks/.gitkeep docs/UPLOAD_TO_VPS.md docs/superpowers/specs/2026-05-28-seed-tracks-from-folder-design.md docs/superpowers/plans/2026-05-28-seed-tracks-from-folder.md
git commit -m "feat: add manual seed track import"
```

If commits were not explicitly authorized, skip this step.

---

## Self-Review

- Spec coverage: The plan implements a separate manual seed script, existing-artist-only matching, duplicate skipping, `pending` track creation, AI enqueue, production VPS folder wiring, and VPS docs. It preserves the existing DB population and does not create artists.
- Placeholder scan: No `TBD`, unresolved placeholder, or open-ended implementation step remains.
- Type consistency: Helper names used in tests match the exported helper names. The importer uses existing `getOne`, `runQuery`, and `enqueueAnalyzeTrack` APIs with the current backend module structure.
