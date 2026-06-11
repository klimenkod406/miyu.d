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
