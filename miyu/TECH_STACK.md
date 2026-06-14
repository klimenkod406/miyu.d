# Стек технологий проекта «Мийу»

Этот документ описывает все программные технологии, использованные в проекте. Каждый раздел содержит пояснение, зачем нужна технология, и пример кода из проекта, чтобы вы могли читать и понимать написанное.

---

## Содержание

1. [Обзор архитектуры](#1-обзор-архитектуры)
2. [Frontend — клиентская часть](#2-frontend--клиентская-часть)
3. [Backend — серверная часть](#3-backend--серверная-часть)
4. [AI-сервис — аналитика и рекомендации](#4-ai-сервис--аналитика-и-рекомендации)
5. [Инфраструктура](#5-инфраструктура)

---

## 1. Обзор архитектуры

Проект «Мийу» — это **монорепозиторий** с тремя сервисами:

```
miyu/
├── frontend/       ← React (порт 5173)
├── backend/        ← Express (порт 3001)
├── ai-service/     ← FastAPI (порт 8001)
├── database/       ← SQLite + миграции
├── deploy/         ← Nginx конфиг
└── scripts/        ← Утилиты разработки
```

**Как сервисы общаются между собой:**

```
Браузер пользователя
    │
    ▼
┌─────────────────────────────────────┐
│  Frontend (React + Vite)            │
│  Порт 5173                          │
│  Отправляет запросы на /api/*       │
└──────────────┬──────────────────────┘
               │ /api/*
               ▼
┌─────────────────────────────────────┐
│  Backend (Express + SQLite)         │
│  Порт 3001                          │
│  Обрабатывает запросы, хранит данные│
└──────────────┬──────────────────────┘
               │ HTTP (fire-and-forget)
               ▼
┌─────────────────────────────────────┐
│  AI-сервис (FastAPI + Python)       │
│  Порт 8001                          │
│  Анализ треков, рекомендации        │
└──────────────┬──────────────────────┘
               │
               ▼
          Redis (очередь задач)
```

Frontend не обращается к AI-сервису напрямую. Backend пересылает задачи в AI-сервис через HTTP, а результаты записываются в общую SQLite-базу.

---

## 2. Frontend — клиентская часть

### 2.1. React 18

**Что это:** JavaScript-библиотека для построения пользовательских интерфейсов из компонентов. Каждый экран — это компонент, который может содержать другие компоненты.

**Зачем в проекте:** Весь интерфейс «Мийу» построен на React-компонентах: страницы, кнопки, плеер, боковая панель.

**Пример — точка входа (`frontend/src/main.tsx`):**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './hooks/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

**Что здесь происходит:**
- `createRoot` — новый способ запуска React 18 (вместо устаревшего `ReactDOM.render`)
- `StrictMode` — режим разработки, который дважды вызывает эффекты для поиска багов
- `BrowserRouter` — обёртка для маршрутизации (навигация между страницами без перезагрузки)
- `AuthProvider` — провайдер контекста авторизации, доступный всем компонентам внутри

**Пример — компонент страницы трека (`frontend/src/pages/TrackPage.tsx`):**

```tsx
export default function TrackPage() {
  const { id } = useParams()           // Получаем ID трека из URL
  const [track, setTrack] = useState(null)  // Состояние трека
  const [loading, setLoading] = useState(true)
  const player = usePlayer()           // Контекст плеера

  useEffect(() => {
    async function fetchTrack() {
      const res = await fetch(`/api/track/${id}`)
      const data = await res.json()
      setTrack(data)
      setLoading(false)
    }
    fetchTrack()
  }, [id])  // Перезапрос при изменении ID

  if (loading) return <Loader2 className="animate-spin" />

  return (
    <div>
      <h1>{track.title}</h1>
      <button onClick={() => player.setTrack(track)}>
        <Play /> Слушать
      </button>
    </div>
  )
}
```

**Ключевые концепции:**
- `useState` — хук для хранения данных (трек, загрузка, ошибки)
- `useEffect` — хук для побочных эффектов (загрузка данных при монтировании)
- `useParams` — получение параметров из URL (`/track/123` → `id = "123"`)

---

### 2.2. TypeScript

**Что это:** Надстройка над JavaScript, добавляющая статическую типизацию. Позволяет ловить ошибки ещё до запуска кода.

**Зачем в проекте:** Все файлы frontend и backend написаны на TypeScript. Это помогает избежать ошибок вроде «получить свойство у undefined».

**Пример — типизация API-ответа (`frontend/src/api/auth.ts`):**

```ts
interface LoginRequest {
  email: string
  password: string
}

interface AuthResponse {
  user: {
    id: number
    email: string
    username: string
    role: string
    avatar_url: string | null
    is_premium: boolean
  }
  accessToken: string
  refreshToken: string
}

// Функция принимает LoginRequest, возвращает AuthResponse
async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return response.json()
}
```

**Что здесь происходит:**
- `interface` — описывает форму объекта (какие поля и типы)
- `Promise<AuthResponse>` — функция возвращает промис с данными типа `AuthResponse`
- TypeScript подскажет, если вы обратитесь к несуществующему полю или передадите не тот тип

---

### 2.3. Vite 5

**Что это:** Сборщик и dev-сервер для frontend-проектов. Заменяет Webpack — работает значительно быстрее.

**Зачем в проекте:** Запускает dev-сервер с горячей перезагрузкой (HMR), собирает проект для продакшена, проксирует API-запросы к backend.

**Пример конфигурации (`frontend/vite.config.ts`):**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',        // Доступен в локальной сети
    port: 5173,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',  // Проксировать на backend
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**Что здесь происходит:**
- `proxy` — все запросы `/api/*` автоматически перенаправляются на backend (порт 3001). Поэтому во frontend-коде пишем `/api/auth/login`, а не `http://localhost:3001/api/auth/login`
- `allowedHosts` — разрешает доступ через туннели (Cloudflare, ngrok) для демонстрации

---

### 2.4. Tailwind CSS 3

**Что это:** CSS-фреймворк с утилитарными классами. Вместо написания CSS-файлов вы применяете готовые классы прямо в HTML/JSX.

**Зачем в проекте:** Быстрая стилизация без переключения между JS и CSS. Тёмная тема с эффектом стекла (glassmorphism).

**Пример — карточка трека:**

```tsx
<div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4
                hover:bg-white/[0.05] transition-all duration-300">
  <img src={track.cover_url} className="w-16 h-16 rounded-lg object-cover" />
  <h3 className="text-white font-medium text-sm mt-2">{track.title}</h3>
  <p className="text-gray-400 text-xs">{track.artist_name}</p>
</div>
```

**Расшифровка классов:**
- `bg-white/[0.02]` — фон белый с прозрачностью 2%
- `border border-white/[0.05]` — граница белая с прозрачностью 5%
- `rounded-xl` — скруглённые углы
- `hover:bg-white/[0.05]` — при наведении фон становится 5%
- `transition-all duration-300` — плавная анимация 300мс

**Кастомная палитра (`frontend/tailwind.config.js`):**

```js
colors: {
  primary: {
    500: '#0ea5e9',  // Основной цвет (голубой)
  },
  dark: {
    900: '#0f172a',  // Основной фон
    950: '#020617',  // Самый тёмный
  },
}
```

---

### 2.5. React Router DOM 6

**Что это:** Библиотека для маршрутизации — навигация между страницами без перезагрузки браузера.

**Зачем в проекте:** Определяет, какой компонент показывать для каждого URL.

**Пример — структура маршрутов (`frontend/src/App.tsx`):**

```tsx
<Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />

<Route path="/" element={<Layout />}>
  <Route index element={<HomePage />} />
  <Route path="track/:id" element={<TrackPage />} />
  <Route path="artist/:id" element={<ArtistPage />} />
  <Route path="search" element={<SearchPage />} />
  <Route path="profile" element={<ProfilePage />} />
  {/* 40+ маршрутов */}
</Route>
```

**Что здесь происходит:**
- `path="/track/:id"` — `:id` это динамический параметр. URL `/track/42` даст `id = "42"`
- `<Layout />` — обёртка с общими элементами (шапка, боковая панель, плеер)
- `<Outlet />` внутри Layout — место, куда вставляется дочерний маршрут

**Защита маршрутов:**

```tsx
function GuestHomeOnlyGate() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const publicGuestPaths = ['/']  // Только главная страница для гостей

  if (isLoading) return null

  if (!isAuthenticated && !publicGuestPaths.includes(location.pathname)) {
    return <Navigate to="/" replace />  // Перенаправить на главную
  }
  return <Layout />
}
```

---

### 2.6. Framer Motion

**Что это:** Библиотека анимаций для React. Позволяет анимировать появление, исчезновение, перемещение элементов.

**Зачем в проекте:** Плавные переходы между страницами, анимация карточек, раскрытие плеера.

**Пример — анимация появления элемента:**

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}   // Начальное состояние
  animate={{ opacity: 1, y: 0 }}     // Конечное состояние
  transition={{ duration: 0.3 }}      // Длительность
>
  <TrackCard track={track} />
</motion.div>
```

---

### 2.7. Lucide React

**Что это:** Библиотека SVG-иконок. Каждая иконка — отдельный React-компонент.

**Зачем в проекте:** Все иконки в интерфейсе: play, pause, heart, search, settings и др.

**Пример:**

```tsx
import { Play, Pause, Heart, Search, Music } from 'lucide-react'

<button onClick={handlePlay}>
  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
</button>
```

---

### 2.8. Recharts

**Что это:** Библиотека графиков для React на основе D3.

**Зачем в проекте:** Статистика прослушиваний, дашборд артиста, аналитика администратора.

**Пример:**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

<LineChart width={600} height={300} data={listenStats}>
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="plays" stroke="#0ea5e9" />
</LineChart>
```

---

### 2.9. Context API — управление состоянием

**Что это:** Встроенный механизм React для хранения данных, доступных всем компонентам (без передачи props через все уровни).

**Зачем в проекте:** Данные авторизации, состояние плеера, настройки темы — всё через Context.

**Пример — AuthContext (`frontend/src/hooks/AuthContext.tsx`):**

```tsx
interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  // При загрузке — восстановить сессию из localStorage
  useEffect(() => {
    const tokens = getStoredTokens()
    if (tokens) {
      authApi.me(tokens.accessToken)
        .then(setUser)
        .catch(() => {
          // Токен протух — попробовать обновить
          authApi.refresh(tokens.refreshToken)
            .then(newTokens => {
              storeTokens(newTokens.accessToken, newTokens.refreshToken)
              authApi.me(newTokens.accessToken).then(setUser)
            })
            .catch(clearTokens)
        })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Хук для использования в компонентах
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

**Как использовать в компоненте:**

```tsx
function Header() {
  const { user, isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) return <Link to="/login">Войти</Link>

  return (
    <div>
      <span>{user.username}</span>
      <button onClick={logout}>Выйти</button>
    </div>
  )
}
```

---

### 2.10. API-клиенты

**Паттерн:** Каждый домен (авторизация, рекомендации, админка) имеет свой API-модуль с типизированными методами.

**Пример (`frontend/src/api/auth.ts`):**

```ts
const API_BASE = '/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

export const authApi = {
  login: (data: LoginRequest) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    request<AuthUser>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
}
```

**Токены хранятся в localStorage:**

```ts
export function storeTokens(access: string, refresh: string) {
  localStorage.setItem('accessToken', access)
  localStorage.setItem('refreshToken', refresh)
}
```

---

## 3. Backend — серверная часть

### 3.1. Express 5

**Что это:** Веб-фреймворк для Node.js. Обрабатывает HTTP-запросы, маршрутизацию, middleware.

**Зачем в проекте:** Все API-эндпоинты `/api/*` обслуживаются Express.

**Пример — настройка сервера (`backend/index.ts`):**

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())                            // Разрешить кросс-доменные запросы
app.use(express.json())                    // Парсить JSON из тела запроса
app.use('/uploads', express.static('uploads'))  // Статические файлы

// Маршруты
app.use('/api/auth', authRoutes)
app.use('/api/track', trackRoutes)
app.use('/api/admin', adminRoutes)
// ... 27 маршрутов

app.listen(3001, () => console.log('Server on :3001'))
```

**Пример — маршрут получения трека (`backend/routes/track.ts`):**

```typescript
router.get('/:id', async (req, res) => {
  const trackId = parseInt(req.params.id)

  const track = await getOne(
    `SELECT t.*, u.username as artist_name, a.title as album_title
     FROM tracks t
     JOIN users u ON t.artist_id = u.id
     LEFT JOIN albums a ON t.album_id = a.id
     WHERE t.id = ?`,
    [trackId]
  )

  if (!track) return res.status(404).json({ error: 'Трек не найден' })
  res.json(track)
})
```

---

### 3.2. SQLite

**Что это:** Лёгкая реляционная база данных, хранящая данные в одном файле. Не требует отдельного сервера.

**Зачем в проекте:** Хранит всех пользователей, треки, альбомы, плейлисты, транзакции.

**Пример — подключение и хелперы (`backend/db/index.ts`):**

```typescript
import sqlite3 from 'sqlite3'

const db = new sqlite3.Database('../database/miyu.db')
db.run('PRAGMA foreign_keys = ON;')  // Включить внешние ключи

// Обёртки для async/await
export function getOne<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row as T)
    })
  })
}

export function getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows as T[])
    })
  })
}
```

**Пример SQL-запроса с JOIN:**

```sql
SELECT t.id, t.title, t.duration, u.username as artist_name
FROM tracks t
JOIN users u ON t.artist_id = u.id
WHERE t.status = 'approved'
ORDER BY t.play_count DESC
LIMIT 20
```

---

### 3.3. JWT — аутентификация

**Что это:** JSON Web Token — способ идентификации пользователя. Сервер выдаёт зашифрованный токен, клиент отправляет его в заголовке каждого запроса.

**Зачем в проекте:** Проверка личности пользователя. Два токена: короткоживущий access (7 дней) и долгоживущий refresh (30 дней).

**Пример — генерация токенов (`backend/middleware/auth.ts`):**

```typescript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'miyu-secret'

export function generateTokens(user: { id: number; email: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
  return { accessToken, refreshToken }
}
```

**Пример — middleware проверки токена:**

```typescript
export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Нет токена' })
  }

  const token = authHeader.substring(7)  // Убрать "Bearer "
  try {
    const user = jwt.verify(token, JWT_SECRET)
    req.user = user   // Прикрепить данные пользователя к запросу
    next()            // Продолжить обработку
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' })
  }
}
```

**Как защитить маршрут:**

```typescript
// Только для авторизованных
router.get('/profile', authenticateToken, async (req, res) => {
  const user = await getOne('SELECT * FROM users WHERE id = ?', [req.user.id])
  res.json(user)
})

// Только для админов
router.delete('/user/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  await runQuery('DELETE FROM users WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})
```

---

### 3.4. bcryptjs — хеширование паролей

**Что это:** Библиотека для безопасного хеширования паролей. Пароль преобразуется в необратимую строку, которую нельзя расшифровать обратно.

**Зачем в проекте:** Пароли пользователей хранятся в захешированном виде.

```typescript
import bcrypt from 'bcryptjs'

// При регистрации — хешировать пароль
const passwordHash = await bcrypt.hash(password, 10)  // 10 — соль (сложность)
await runQuery(
  'INSERT INTO users (email, password_hash) VALUES (?, ?)',
  [email, passwordHash]
)

// При входе — сравнить введённый пароль с хешем
const isValid = await bcrypt.compare(inputPassword, storedHash)
if (!isValid) return res.status(401).json({ error: 'Неверный пароль' })
```

---

### 3.5. Multer — загрузка файлов

**Что это:** Middleware для обработки multipart/form-data — загрузка файлов (треки, обложки, аватары).

**Зачем в проекте:** Артисты загружают музыку, пользователи — аватары.

```typescript
import multer from 'multer'

const storage = multer.diskStorage({
  destination: 'uploads/tracks/',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB

// В маршруте
router.post('/upload', authenticateToken, upload.single('audio'), async (req, res) => {
  const filePath = req.file.filename  // Путь к загруженному файлу
  await runQuery('INSERT INTO tracks (artist_id, file_path) VALUES (?, ?)', [req.user.id, filePath])
  res.json({ ok: true })
})
```

---

### 3.6. Fire-and-forget к AI-сервису

**Паттерн:** Backend отправляет задачу в AI-сервис и не ждёт ответа. Это позволяет не блокировать запрос пользователя.

**Пример (`backend/services/aiService.ts`):**

```typescript
const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001'

// Асинхронная отправка (не блокирует ответ клиенту)
export function enqueueAnalyzeTrackAndForget(trackId: number, filePath?: string): void {
  fetch(`${AI_URL}/analyze/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: trackId, file_path: filePath }),
  })
    .then(r => console.log(`[ai] enqueued track=${trackId}`))
    .catch(e => console.warn(`[ai] failed track=${trackId}:`, e.message))
}

// В маршруте загрузки трека:
router.post('/upload', upload.single('audio'), async (req, res) => {
  const result = await runQuery('INSERT INTO tracks ...', [...])
  enqueueAnalyzeTrackAndForget(result.lastID, req.file.filename)  // Фоновая задача
  res.json({ ok: true })  // Ответ сразу, не дожидаясь AI
})
```

---

## 4. AI-сервис — аналитика и рекомендации

### 4.1. FastAPI

**Что это:** Современный веб-фреймворк для Python с автоматической документацией и валидацией через Pydantic.

**Зачем в проекте:** API для анализа треков и рекомендаций.

**Пример — настройка приложения (`ai-service/app/main.py`):**

```python
from fastapi import FastAPI

app = FastAPI(
    title="Miyu AI Service",
    description="Анализ треков, модерация и рекомендации.",
    version="0.2.0",
)

app.include_router(analysis_router, tags=["analysis"])
app.include_router(recsys_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

**Пример — эндпоинт анализа (`ai-service/app/api/analysis_router.py`):**

```python
from pydantic import BaseModel

class AnalyzeRequest(BaseModel):
    track_id: int
    file_path: str | None = None

class AnalyzeResponse(BaseModel):
    track_id: int
    ai_score: float
    ai_flags: list[str]
    decision: str  # "approve" | "pending" | "flag"

@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_sync(req: AnalyzeRequest) -> AnalyzeResponse:
    result = pipeline.analyze_track(req.track_id, req.file_path)
    return AnalyzeResponse(**result)
```

---

### 4.2. Конфигурация — pydantic-settings

**Что это:** Библиотека для управления настройками через переменные окружения с автоматической валидацией.

**Пример (`ai-service/app/config.py`):**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MIYU_AI_")

    whisper_model: str = "small"           # tiny|base|small|medium
    whisper_compute_type: str = "int8"     # CPU-only
    auto_approve_threshold: float = 0.20   # Порог автоодобрения
    recsys_half_life_days: int = 30        # Период полураспада рекомендаций
    recsys_mmr_lambda: float = 0.7         # Баланс релевантность/разнообразие

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # Синглтон
```

---

### 4.3. librosa — анализ аудио

**Что это:** Python-библиотека для извлечения признаков из аудио: темп, тональность, энергия, спектр.

**Зачем в проекте:** Определяет BPM, тональность, энергичность, танцевальность каждого трека.

**Пример (`ai-service/app/analysis/`):**

```python
import librosa

audio, sr = librosa.load(file_path, sr=22050, mono=True)

tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)           # BPM
chroma = librosa.feature.chroma_stft(y=audio, sr=sr)          # Тональность
rms = librosa.feature.rms(y=audio)[0]                         # Громкость
spectral_centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)  # Яркость звука
```

---

### 4.4. PANNs CNN14 — тегирование и эмбеддинги

**Что это:** Нейросеть, обученная на AudioSet (527 классов звука). Из аудио извлекает теги (жанр, настроение) и векторное представление (эмбеддинг 2048 чисел).

**Зачем в проекте:** Автоматическое определение жанра и настроения трека. Эмбеддинги используются для поиска похожих треков.

**Пример (`ai-service/app/analysis/tagging.py`):**

```python
from panns_inference import AudioTagging

_MODEL = None  # Lazy loading — загружается при первом вызове

def _load():
    global _MODEL
    if _MODEL is None:
        _MODEL = AudioTagging(checkpoint_path=None, device="cpu")
    return _MODEL

def predict(file_path: str) -> dict:
    audio, _ = librosa.load(file_path, sr=32000, mono=True)
    model = _load()

    clipwise_output, embedding = model.inference(audio[None, :])
    # clipwise_output — вероятности для 527 классов
    # embedding — вектор из 2048 чисел

    probs = clipwise_output[0]
    top_indices = np.argsort(-probs)[:15]  # Топ-15 тегов

    return {
        "raw_tags": [{"tag": LABELS[i], "prob": float(probs[i])} for i in top_indices],
        "genre_tags": map_to_genres(top_indices, probs),
        "mood_tags": map_to_moods(top_indices, probs),
        "embedding": embedding[0].astype(np.float32),  # 2048-d вектор
    }
```

**Что такое эмбеддинг:** Это массив из 2048 чисел, который «описывает» звучание трека. Два трека с похожими эмбеддингами звучат похоже. Используется для рекомендаций.

---

### 4.5. faster-whisper — транскрипция

**Что это:** Быстрая реализация Whisper (модель OpenAI для распознавания речи) на CTranslate2. Работает на CPU.

**Зачем в проекте:** Распознаёт текст песни (лирику), чтобы проверить на нецензурную лексику.

**Пример (`ai-service/app/analysis/transcription.py`):**

```python
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")

segments, info = model.transcribe(file_path, beam_size=5, language=None)
# beam_size=5 — перебирает 5 вариантов для точности
# language=None — автоопределение языка

full_text = " ".join(segment.text for segment in segments)
```

---

### 4.6. Detoxify — модерация текста

**Что это:** Модель для определения токсичности текста. Возвращает оценки: toxicity, severe_toxicity, obscene, threat, insult, identity_hate.

**Зачем в проекте:** Проверяет текст трека (лирику) на токсичность.

**Пример (`ai-service/app/analysis/text_moderation.py`):**

```python
from detoxify import Detoxify

result = Detoxify('multilingual').predict(text)
# result = {
#   'toxicity': 0.05,
#   'severe_toxicity': 0.01,
#   'obscene': 0.02,
#   'threat': 0.001,
#   'insult': 0.03,
#   'identity_hate': 0.01
# }
```

---

### 4.7. sentence-transformers — текстовые эмбеддинги

**Что это:** Библиотека для превращения текста в вектор (массив чисел). Тексты с похожим смыслом дают похожие векторы.

**Зачем в проекте:** Эмбеддинги текстов треков используются для поиска похожего контента.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("intfloat/multilingual-e5-small")
embedding = model.encode("Текст песни про любовь и надежду")
# embedding — массив из 384 чисел
```

---

### 4.8. HNSW — быстрый поиск соседей

**Что это:** Алгоритм приближённого поиска ближайших соседей (ANN). Находит похожие векторы за миллисекунды даже среди миллионов.

**Зачем в проекте:** Поиск треков с похожим звучанием по эмбеддингам PANNs.

**Пример (`ai-service/app/recsys/index.py`):**

```python
import hnswlib

index = hnswlib.Index(space='cosine', dim=2048)
index.init_index(max_elements=100000, ef_construction=200, M=16)

# Добавить все треки
index.add_items(embeddings, track_ids)

# Найти 50 похожих на трек #42
labels, distances = index.knn_query(query_embedding, k=50)
```

**Параметры:**
- `M=16` — количество связей на узел (больше = точнее, но больше памяти)
- `ef_construction=200` — качество построения индекса
- `cosine` — косинусное расстояние (лучше для текстов и аудио)

---

### 4.9. implicit — коллаборативная фильтрация

**Что это:** Библиотека для рекомендаций на основе поведения пользователей. «Пользователи, которые слушали X, также слушали Y».

**Зачем в проекте:** Item-Item CF — находит похожие треки по паттернам прослушиваний.

**Пример (`ai-service/app/recsys/itemcf.py`):**

```python
# Формула схожести:
# sim(i, j) = co(i, j) / sqrt(count(i) * count(j))
# где co(i, j) — количество пользователей, слушавших и i, и j

def compute_similarity(co_occurrence: dict, item_counts: dict) -> dict:
    similarities = {}
    for (i, j), co in co_occurrence.items():
        sim = co / (item_counts[i] * item_counts[j]) ** 0.5
        similarities.setdefault(i, {})[j] = sim
    return similarities
```

---

### 4.10. MMR — разнообразие в рекомендациях

**Что это:** Maximal Marginal Relevance — алгоритм, который балансирует релевантность и разнообразие. Без него все рекомендации были бы одного жанра.

**Зачем в проекте:** Реранжирует кандидатов, чтобы в ленте были разные артисты и жанры.

**Пример (`ai-service/app/recsys/reranker.py`):**

```python
def mmr_select(candidates, embeddings, limit, lambda_diversity=0.7):
    """
    score(c) = lambda * relevance(c) - (1-lambda) * max_similarity_to_selected(c)

    lambda=1.0 — только релевантность (без разнообразия)
    lambda=0.0 — только разнообразие (игнорирует релевантность)
    lambda=0.7 — баланс (по умолчанию)
    """
    selected = []
    while candidates and len(selected) < limit:
        best_score = -float('inf')
        best_item = None

        for track_id, relevance in candidates:
            # Максимальное сходство с уже выбранными
            penalty = max(cosine_sim(embeddings[track_id], embeddings[s])
                         for s in selected) if selected else 0.0

            score = lambda_diversity * relevance - (1 - lambda_diversity) * penalty

            if score > best_score:
                best_score = score
                best_item = (track_id, relevance)

        selected.append(best_item)
        candidates.remove(best_item)

    return selected
```

---

### 4.11. RQ + Redis — фоновые задачи

**Что это:** RQ (Redis Queue) — очередь задач на Redis. Позволяет выполнять тяжёлые операции (анализ трека ~30 сек) в фоне.

**Зачем в проекте:** Загрузка трека → ответ клиенту → AI-сервис анализирует трек в фоне → результат записывается в БД.

**Пример — постановка в очередь (`ai-service/app/workers/queue.py`):**

```python
from rq import Queue
from redis import Redis

redis_conn = Redis.from_url(settings.redis_url)
queue = Queue("miyu-ai", connection=redis_conn)

def enqueue_analyze(track_id: int, file_path: str) -> Job:
    return queue.enqueue(
        "app.workers.tasks.analyze_track_job",  # Путь к функции
        track_id, file_path,
        job_id=f"analyze:{track_id}",
        result_ttl=86400,     # Хранить результат 24 часа
    )
```

**Пример — выполнение задачи (`ai-service/app/workers/tasks.py`):**

```python
def analyze_track_job(track_id: int, file_path: str) -> dict:
    # Записать в БД, что задача началась
    execute("INSERT INTO ai_jobs (track_id, status) VALUES (?, 'running')", [track_id])

    result = pipeline.analyze_track(track_id, file_path)

    # Записать результат
    execute("UPDATE ai_jobs SET status='done' WHERE track_id=?", [track_id])
    return result
```

---

### 4.12. Prometheus — метрики

**Что это:** Система сбора метрик. Считает количество запросов, время обработки, размер индексов.

**Зачем в проекте:** Мониторинг производительности AI-сервиса через Grafana.

**Пример (`ai-service/app/metrics.py`):**

```python
from prometheus_client import Counter, Histogram, Gauge

worker_jobs_total = Counter(
    'miyu_ai_worker_jobs_total',
    'Total worker jobs',
    ['job_type', 'status']  # label: analyze_track/done/failed
)

recsys_feed_latency = Histogram(
    'miyu_ai_recsys_feed_latency_seconds',
    'Feed generation latency',
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)
```

---

### 4.13. Transcription Configs — A/B тестирование

**Что это:** Набор из 14 предустановленных конфигураций транскрипции в `app/analysis/transcription_params.py`. Каждый конфиг меняет параметры VAD, beam search, температуры, hotwords и фильтров.

**Зачем в проекте:** Позволяет быстро переключаться между стратегиями транскрипции для разных жанров (поп, рэп, микс) и условий (шум, фоновая музыка).

**Пример — структура конфига:**

```python
@dataclass
class TranscriptionConfig:
    name: str
    vad_enabled: bool = True          # Voice Activity Detection
    beam_size: int = 8                # Ширина beam search
    best_of: int = 8                  # Количество кандидатов
    patience: float = 1.0             # Терпение поиска
    temperature: list[float] = ...    # Температуры декодирования
    hotwords: str = ""                # Слова для приоритета
    compression_ratio_threshold: float = 2.4
    log_prob_threshold: float = -1.0
    no_speech_threshold: float = 0.5
```

**Ключевые конфиги:**
- `music_polish` — beam=15, patience=2, максимальное качество
- `music_precise` — beam=12, для сложных треков
- `music_hybrid_ru` — русский + английский, hotwords на обоих языках
- `music_rap_focused` — без фильтра повторов (для рэпа)
- `baseline` — стандартный production-конфиг

---

### 4.14. Phonetic Corrections — автокоррекция

**Что это:** Словарь из 200+ regex-паттернов в `app/analysis/phonetic_corrections.py` для исправления типичных ошибок Whisper при распознавании русских песен.

**Зачем в проекте:** Whisper часто ошибается в фонетически сложных местах (похожие созвучия, непривычные слова). Паттерны исправляют эти ошибки на уровне текста и сегментов.

**Пример — исправления для трека «Пустите меня на танцпол»:**

```python
PHONETIC_CORRECTIONS = [
    (re.compile(r"\bсенч[ае]\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bнавеселен\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bконспол\b", re.IGNORECASE), "танцпол"),
    # ... 200+ паттернов
]
```

Паттерны организованы по трекам: track_34 (HammAli), track_36 (JONY), track_52 (Баста), track_110 (Дора), track_46 (Zivert), track_59 (МакSим), track_77 (Cream Soda). Также есть общие патерны для пунктуации и пробелов.

---

### 4.15. Profanity Dictionary — словарь цензуры

**Что это:** Регулярные выражения для 9 категорий триггерного контента в `app/analysis/profanity_dict.py`. Полная замена Detoxify — не требует ML-модели, работает быстрее.

**Зачем в проекте:** Поиск и классификация нежелательного контента в текстах песен.

**Категории и веса:**
| Категория | Вес | Описание |
|-----------|-----|----------|
| sex | 1.0 | Сексуальный контент |
| drugs | 1.0 | Наркотики |
| racism | 1.0 | Расизм (red-flag) |
| fascism | 1.0 | Фашизм (red-flag) |
| profanity | 1.0 | Мат |
| violence | 0.9 | Насилие |
| nationalism | 0.8 | Национализм |
| alcohol | 0.6 | Алкоголь |
| smoking | 0.6 | Курение |

**Пример использования:**

```python
result = check_all("Текст песни для проверки")
# result = {
#     "is_18plus": True,
#     "categories": {"profanity": 3, "alcohol": 1},
#     "total_weighted": 3.6,
#     "density": 0.15,
#     "has_red_flag": False,
# }
```

---

### 4.16. Text Moderation — MMR скоринг

**Что это:** Система оценки контента в `app/analysis/text_moderation.py`. На основе результатов profanity_dict вычисляет MMR-оценку (0..1).

**Зачем в проекте:** Автоматическое принятие решения: approve / pending / flag.

**Правила MMR:**
1. Любой триггер → `is_18plus = True`
2. Базовая оценка = weighted_density / word_count * 3.0
3. Категорийные минимумы: мат ≥ 0.15, расизм/фашизм ≥ 0.85, секс ≥ 0.5, наркотики ≥ 0.4, насилие ≥ 0.3

```python
result = text_moderation.analyze(lyrics_text)
# result.mmr_score -> 0.0..1.0
# result.is_18plus -> True/False
# result.has_red_flag -> True/False
```

---

### 4.17. Benchmark System — оценка транскрипции

**Что это:** Тестовая система в `tests/test_benchmark.py` для сравнения качества транскрипции с эталонными текстами.

**Зачем в проекте:** Объективная оценка улучшений при изменении параметров транскрипции.

**Метрики:**
- **WER** (Word Error Rate) — процент ошибок на уровне слов
- **CER** (Character Error Rate) — процент ошибок на уровне символов
- **Recall** — сколько слов эталона найдено
- **Precision** — сколько распознанных слов верны
- **F1** — гармоническое среднее recall и precision
- **Coverage** — процент времени трека, покрытый речью

**Эталонные тексты:** 9 треков в `tests/ground_truth/` — вручную выверенные тексты песен.

```bash
# Запуск с одним конфигом
python tests/test_benchmark.py --track 34 --config baseline

# Сравнение всех конфигов
python tests/test_benchmark.py --track 34 --all-configs
```

Результат сохраняется как JSON в `tests/benchmark_results/`.

---

### 4.18. Pipeline — полный анализ трека

**Что это:** Оркестратор всех этапов анализа в `app/analysis/pipeline.py`. Выполняет 9 шагов последовательно, каждый защищён try/except.

**Зачем в проекте:** Единая точка входа для полного анализа трека, от загрузки аудио до финального решения.

**Шаги pipeline:**
```
1. Pre-flight (длительность, валидность)
2. Аудио-признаки (librosa: BPM, тональность, энергия)
3. Tagging (PANNs: жанр, настроение, эмбеддинг)
4. Транскрипция (faster-whisper + phonetic corrections)
5. Текстовая модерация (9 категорий + MMR + text embed)
6. NSFW-обложка (opennsfw2)
7. Fingerprint (chromaprint) + дубликаты
8. Aggregator → ai_score / ai_flags / decision
9. Запись в БД (track_analysis + moderation_queue)
```

```python
result = pipeline.analyze_track(track_id=42)
# result = {
#   "track_id": 42,
#   "ai_score": 0.85,
#   "ai_flags": ["high_energy", "pop"],
#   "decision": "approve",
#   "moderation": {...},
#   "features": {...},
# }
```

---

## 5. Инфраструктура

### 5.1. Docker

**Что это:** Платформа контейнеризации. Упаковывает приложение со всеми зависимостями в изолированный контейнер.

**Зачем в проекте:** Гарантирует, что сервис работает одинаково на любом компьютере.

**Пример — Dockerfile backend (`backend/Dockerfile`):**

```dockerfile
FROM node:20-alpine        # Базовый образ
WORKDIR /app
COPY package*.json ./
RUN npm ci                  # Установить зависимости
COPY . .
RUN npm run build           # Скомпилировать TypeScript
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Docker Compose для разработки (`database/docker-compose.yml`):**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  ai-service:
    build: ../ai-service
    ports: ["8001:8001"]
    environment:
      MIYU_AI_REDIS_URL: redis://redis:6379

  ai-worker:
    build: ../ai-service
    command: python worker.py
    environment:
      MIYU_AI_REDIS_URL: redis://redis:6379
```

---

### 5.2. Nginx — reverse proxy

**Что это:** Веб-сервер, который распределяет входящие запросы между сервисами.

**Зачем в проекте:** Единая точка входа для продакшена.

**Пример (`deploy/nginx/default.conf`):**

```nginx
server {
    listen 80;

    location /api/ {
        proxy_pass http://backend:3001;     # → Express
    }

    location /ai/ {
        proxy_pass http://ai-service:8001;  # → FastAPI
    }

    location /uploads/ {
        root /data;                          # → Статические файлы
    }

    location / {
        proxy_pass http://frontend:80;       # → React
    }
}
```

---

### 5.3. Redis

**Что это:** Хранилище данных в оперативной памяти. Быстрое, но не персистентное (по умолчанию).

**Зачем в проекте:** Очередь задач RQ для AI-сервиса.

---

### 5.4. Grafana — мониторинг

**Что это:** Панель визуализации метрик. Показывает графики из Prometheus.

**Зачем в проекте:** Наглядное отображение: сколько треков проанализировано, среднее время анализа, размер индексов рекомендаций.

---

## Сводная таблица

| Слой | Технология | Версия | Назначение |
|------|-----------|--------|------------|
| Frontend | React | 18.3 | UI-компоненты |
| Frontend | TypeScript | 5.5 | Типизация |
| Frontend | Vite | 5.4 | Сборка и dev-сервер |
| Frontend | Tailwind CSS | 3.4 | Стилизация |
| Frontend | React Router | 6.26 | Маршрутизация |
| Frontend | Framer Motion | 12.38 | Анимации |
| Frontend | Lucide React | 1.8 | Иконки |
| Frontend | Recharts | 3.8 | Графики |
| Backend | Express | 5.2 | Веб-фреймворк |
| Backend | TypeScript | 6.0 | Типизация |
| Backend | SQLite | 6.0 | База данных |
| Backend | jsonwebtoken | 9.0 | Аутентификация |
| Backend | bcryptjs | 3.0 | Хеширование паролей |
| Backend | multer | 2.1 | Загрузка файлов |
| AI | FastAPI | 0.115 | Веб-фреймворк |
| AI | Python | 3.11 | Язык программирования |
| AI | librosa | 0.10 | Анализ аудио |
| AI | PANNs CNN14 | — | Тегирование + эмбеддинги |
| AI | faster-whisper | 1.0 | Транскрипция |
| AI | Detoxify | 0.5 | Модерация текста |
| AI | hnswlib | 0.8 | ANN-индекс |
| AI | implicit | 0.7 | Коллаборативная фильтрация |
| AI | RQ | 1.16 | Очередь задач |
| AI | Prometheus | 0.21 | Метрики |
| Инфра | Docker | — | Контейнеризация |
| Инфра | Nginx | — | Reverse proxy |
| Инфра | Redis | 7 | Очередь задач |
| Инфра | TranscriptionConfigs | — | 14 configs for A/B testing |
| AI | Phonetic Corrections | — | 200+ regex patterns for lyrics |
| AI | Profanity Dict | — | 9 categories, regex-based censorship |
| AI | Text Moderation | — | MMR scoring, replaces Detoxify |
| AI | Benchmark | — | WER/CER/F1 evaluation with ground truth |
| Инфра | Grafana | — | Мониторинг |
