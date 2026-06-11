# Быстрый запуск Miyu через Cloudflare Tunnel

## Что нужно

- установленный `cloudflared`
- Node.js и npm
- запущенный Docker/Redis, если нужен `ai-service`

## 1. Запустить проект локально

Открой PowerShell:

```powershell
cd C:\Users\Денис\Desktop\miyu
npm run dev
```

После запуска должны подняться:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`
- ai-service: `http://localhost:8001`

Не закрывай это окно.

## 2. Открыть проект в интернете через туннель

Во втором окне PowerShell выполни:

```powershell
cloudflared tunnel --url http://127.0.0.1:5173
```

Cloudflare покажет ссылку вида:

```text
https://example-name.trycloudflare.com
```

Открой ее в браузере — это и есть публичный доступ к проекту.

## 3. Как остановить

В обоих окнах PowerShell нажми:

```powershell
Ctrl + C
```

## Примечания

- ссылка `trycloudflare.com` временная и может меняться после каждого запуска
- пока окна `npm run dev` и `cloudflared` открыты, сайт доступен извне
- для постоянного домена и стабильной работы лучше потом настроить named tunnel через аккаунт Cloudflare
