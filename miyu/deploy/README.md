# Деплой Miyu на VPS

Этот путь рассчитан на дипломный MVP: один VPS, Docker Compose, SQLite, Redis, frontend, backend, ai-service и nginx.

## Минимальные ресурсы

- Рекомендуемо для AI-демо: 4 vCPU, 8 GB RAM, 60+ GB SSD.
- Допустимо для маленького демо: 2 vCPU, 4 GB RAM, модель Whisper `tiny`/`base`, анализ будет медленным.
- GPU не обязателен. По умолчанию compose использует CPU-safe настройки.

## Подготовка VPS

Установи Docker и Docker Compose plugin. Затем загрузи проект на сервер, например:

```bash
scp -r miyu root@SERVER_IP:/root/miyu
cd /root/miyu
```

Создай production env:

```bash
cp .env.production.example .env.production
```

Обязательно замени `JWT_SECRET` на длинный случайный секрет:

```bash
openssl rand -hex 32
```

Для обычного VPS оставь безопасные значения:

```env
AI_SERVICE_ENABLED=true
MIYU_AI_WHISPER_MODEL=base
MIYU_AI_WHISPER_DEVICE=cpu
MIYU_AI_WHISPER_COMPUTE_TYPE=int8
MIYU_AI_WHISPER_NUM_WORKERS=1
```

Если сервер слабый, поставь `MIYU_AI_WHISPER_MODEL=tiny`. Если сервер мощнее, можно использовать `small`.

## Первый запуск

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Проверка контейнеров:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx backend ai-service ai-worker
```

Smoke checks:

```bash
curl http://SERVER_IP/api/health
curl http://SERVER_IP/ai/health
```

Сайт должен открыться по адресу:

```text
http://SERVER_IP
```

## Что хранить и бэкапить

Обязательно сохраняй:

- `database/` — SQLite база `miyu.db`;
- `uploads/` — аудио, обложки, видео;
- `.env.production` — только на сервере, не коммитить.

AI model cache (`ai_models_cache`) можно не бэкапить: модели перекачаются, но первый запуск будет дольше.

## Админская массовая загрузка MP3

1. Войди под админом.
2. Убедись, что артисты уже существуют в системе и их `username` совпадает с именем в файле.
3. Открой `/admin/upload`.
4. Выбери несколько MP3-файлов с именами строго:

```text
Artist - Track.mp3
```

Пример:

```text
Miyu - Night Walk.mp3
Kira - Neon Sky.mp3
```

5. Проверь предпросмотр: исполнитель, название, длительность, совпавший artist account.
6. Нажми «Загрузить и отправить на AI».
7. После загрузки перейди в `/admin/content`.
8. Дождись AI-анализа, открой модалку модерации, проверь flags/lyrics/features.
9. Одобри трек — после этого он появится в публичном каталоге и будет проигрываться через `/uploads/tracks/...`.

## Fallback: импорт из папки на сервере

Админская загрузка — основной путь. Если нужно импортировать файлы прямо на VPS:

1. Положи файлы в `seed-content/tracks/`.
2. Имена также должны быть `Artist - Track.mp3` или другой формат, поддерживаемый seed script.
3. Запусти:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run seed:tracks
```

Скрипт не создаёт артистов. Если артист не найден или трек уже существует, файл будет пропущен.

## Обновление проекта

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

После обновления проверь:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl http://SERVER_IP/api/health
```

## Типичные проблемы

### AI анализ долго висит

- Проверь `docker compose ... logs -f ai-worker`.
- На слабом VPS поставь `MIYU_AI_WHISPER_MODEL=tiny`.
- Уменьши `MIYU_AI_WHISPER_NUM_WORKERS=1`.

### Файл не появляется в модерации

- Проверь, что имя строго `Artist - Track.mp3`.
- Проверь, что `Artist` совпадает с `users.username` артиста.
- Проверь logs backend и ai-worker.

### Трек не проигрывается после approve

- Проверь, что файл есть в `uploads/tracks/`.
- Проверь, что backend вернул `file_path` вида `/uploads/tracks/file.mp3`.
- Проверь nginx location `/uploads/`.
