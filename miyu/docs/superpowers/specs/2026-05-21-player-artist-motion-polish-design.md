# Дизайн: polish расширенного плеера, страницы артиста, визуализатора и переходов

Дата: 2026-05-21

## Контекст

Проект Miyu — React/Vite/TypeScript/Tailwind frontend музыкального сервиса. Пользователь попросил четыре связанных UI/UX-улучшения:

1. В расширенном плеере сделать названия артиста и плейлиста кликабельными с переходом на соответствующие страницы.
2. Улучшить дизайн карточек контента на странице конкретного артиста.
3. Смягчить резкий переход аудиовизуализатора из idle в active и обратно.
4. Унифицировать плавное исчезновение старой страницы и появление новой при навигации, заменив локальные page-enter анимации на общий стиль.

Выбран подход: целевой polish без большого рефакторинга. Меняем только нужные компоненты и страницы, не создаём отдельную дизайн-систему и не переписываем крупные участки приложения.

## Цели

- Сохранить текущую архитектуру и поведение плеера.
- Улучшить навигацию из expanded player без остановки музыки.
- Сделать страницу артиста визуально более цельной: hero, треки, альбомы и empty state в едином glass/cosmic стиле.
- Использовать палитру из аватарки артиста как ключевой визуальный акцент страницы.
- Сделать реакцию аудиовизуализатора на старт/стоп музыки плавной, но не «ватной».
- Задать единый page transition на уровне общего контейнера страниц.

## Не входит в scope

- Полная дизайн-система `components/ui`.
- Редизайн всех страниц музыкального каталога.
- Изменение backend API.
- Изменение логики воспроизведения, очереди или лайков.
- Новые тестовые фреймворки.

## Файлы для изменения

Основные:

- `frontend/src/components/ExpandedPlayer.tsx`
- `frontend/src/pages/ArtistPage.tsx`
- `frontend/src/components/AudioVisualizer.tsx`
- `frontend/src/components/PageContent.tsx`

Возможные дополнительные:

- `frontend/src/components/MiniAudioVisualizer.tsx`, если после проверки окажется, что mini visualizer имеет такую же резкость.
- `frontend/src/pages/SearchPage.tsx`, если локальная page-level анимация конфликтует с новым глобальным переходом.

## 1. Expanded player links

### Текущее состояние

В `ExpandedPlayer.tsx` строка под названием трека выводит обычный текст:

- имя артиста;
- если есть текущий плейлист — название плейлиста;
- иначе, если есть альбом — название альбома.

### Новое поведение

Под названием трека появляются inline-ссылки:

- артист → `/artist/:id`;
- текущий плейлист → `/playlist/:id`;
- если плейлиста нет, но есть альбом → `/album/:id`.

Если нужного id нет, элемент остаётся обычным текстом.

При клике:

- музыка продолжает играть;
- expanded player сворачивается через `toggleExpanded()`;
- пользователь сразу видит страницу назначения.

### Визуальный стиль

- Ссылки выглядят как muted metadata, а не как браузерные ссылки.
- Base: `text-gray-400` / `text-white/45`.
- Hover: `text-white` или `text-purple-300`.
- Без underline по умолчанию.
- На мобильных сохранить центрирование строки.

## 2. ArtistPage content redesign

### Текущее состояние

`ArtistPage.tsx` уже:

- загружает артиста, треки и альбомы;
- извлекает цвета из аватарки через `extractColorsFromImage`;
- использует `bannerColors` для background и play button;
- показывает hero, список популярных треков и сетку альбомов.

Слабые места:

- контентная зона выглядит проще новых editorial-страниц;
- строки треков и альбомные карточки не образуют единую систему;
- palette change может восприниматься как резкая смена стиля;
- hero и секции используют разные уровни polish.

### Новая структура страницы

Страница остаётся в одном компоненте, без крупного рефакторинга:

1. Animated palette background shell.
2. Hero artist panel.
3. Glass section `Популярные треки`.
4. Glass section `Альбомы`.
5. Unified empty state, если нет треков и альбомов.

### Palette extraction and reveal

Стартовая палитра:

```ts
['#a855f7', '#ec4899', '#3b82f6']
```

Правила:

- если у артиста есть `palette_mode === 'custom'` и три цвета — использовать их;
- иначе если есть `avatar_url` — вызвать `extractColorsFromImage(avatar_url)`;
- если аватарки нет или извлечение упало — оставить дефолт;
- после получения палитры включить состояние `paletteReady`.

Визуальное проявление:

- страница сначала рендерится с дефолтной палитрой;
- затем фоновые `linear-gradient`/`radial-gradient`, border и glow плавно переходят к цветам артиста;
- использовать CSS transition или `motion.div` с `animate`;
- длительность: около `700–1000ms`;
- transition должен быть мягким, без резкой вспышки.

### Hero panel

Hero получает более premium/glass вид:

- большой rounded container (`rounded-[2rem]` или близко);
- layered background:
  - base dark glass;
  - radial highlights от `bannerColors`;
  - subtle border/glow;
- аватарка с gradient ring и shadow;
- имя артиста, verified icon, bio и counters;
- play all button с gradient из палитры;
- secondary more button остаётся.

### Tracks section

Секция `Популярные треки` становится glass-панелью:

- section header с title, subtitle и count;
- строки треков получают:
  - номер;
  - обложку 48–56px;
  - title;
  - дата/metadata;
  - длительность;
  - play/action affordance;
  - current track state;
  - playing bars overlay, если трек играет;
- hover: `bg-white/[0.04]`, border accent, subtle translate или glow;
- active/current: более заметный border/glow на цветах артиста.

Mobile:

- не полагаться только на `grid-cols-12`;
- скрывать второстепенную дату на узких экранах;
- сохранять длительность и название.

### Albums section

Секция `Альбомы` становится glass-панелью с media cards:

- grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` или близко;
- карточки:
  - rounded glass surface;
  - aspect-square cover;
  - gradient fallback с `Disc`;
  - hover overlay с play/open indicator;
  - title и year/type metadata;
- единые радиусы и spacing с tracks section.

### Empty state

Если у артиста нет треков и альбомов:

- не простой текст;
- rounded glass panel;
- иконка `Music`;
- заголовок и muted subtitle;
- цветовой glow из палитры.

## 3. AudioVisualizer smoothing

### Текущее состояние

`AudioVisualizer.tsx` уже не перезапускает RAF-loop на play/pause и имеет smoothing для отдельных частот:

- `smoothBass`
- `smoothMid`
- `smoothTreble`
- `smoothVocal`
- `smoothPresence`
- per-ring smoothing для `ringBands` и `ringVoiceBands`

Проблема: общий переход idle → active и active → idle слишком резкий, особенно если трек стартует на интенсивном моменте.

### Новая модель

Добавить общий envelope, например:

```ts
let activityEnvelope = 0
```

Каждый frame:

- target = `!idle ? 1 : 0`;
- если target выше текущего — attack smoothing;
- если ниже — release smoothing.

Пример коэффициентов:

```ts
const envelopeAttack = 0.045
const envelopeRelease = 0.025
activityEnvelope += (target - activityEnvelope) * (target > activityEnvelope ? envelopeAttack : envelopeRelease)
```

Использование:

- не заменять текущий audio responsiveness полностью;
- умножать на envelope только активные усиления:
  - beat envelope;
  - boosted band/voice contribution;
  - shadow/glow boost;
  - tempo speed;
  - swing/grow активные добавки;
- idle breathing остаётся видимым даже при envelope ≈ 0.

Ожидаемый эффект:

- при старте трека visualizer набирает интенсивность постепенно;
- если старт попал на громкий момент, нет резкого «взрыва» формы;
- при паузе/стопе visualizer мягко возвращается к idle breathing.

### Mini visualizer

Если `MiniAudioVisualizer.tsx` визуально проявляет ту же резкость, применить аналогичный envelope, но с чуть быстрее коэффициентами, чтобы маленький индикатор оставался информативным.

## 4. Unified page transitions

### Текущее состояние

`PageContent.tsx` уже использует `motion.div` keyed by `location.pathname`, но переход короткий:

- enter: opacity + y 8;
- exit: opacity + y -8.

`SearchPage.tsx` имеет собственную page-level entrance-анимацию:

```tsx
<motion.div initial={{ opacity: 0, y: 20 }} ...>
```

`ArtistPage.tsx` имеет `transition-all duration-700` на root, но это не полноценный page transition.

### Новое поведение

Глобальный переход:

- старая страница плавно исчезает;
- новая страница плавно появляется;
- effect похож на SearchPage, но единый для всех страниц;
- без сильного slide, чтобы не конфликтовать с layout.

Рекомендуемые параметры:

```ts
initial: { opacity: 0, y: 18, filter: 'blur(8px)' }
animate: { opacity: 1, y: 0, filter: 'blur(0px)' }
exit: { opacity: 0, y: -12, filter: 'blur(6px)' }
transition: { duration: 0.38-0.48, ease: [0.22, 1, 0.36, 1] }
```

Важно:

- локальные page-level entrance wrappers убрать или сделать neutral, если они конфликтуют;
- tab/content animations внутри страниц не трогать;
- SearchPage tab transition через `AnimatePresence` оставить, потому что это не page transition, а переключение результатов.

## Проверка

После реализации выполнить:

```bash
cd frontend
npm run build
```

Если возможно, также:

```bash
cd frontend
npm run lint
```

Ручная проверка:

1. Expanded player:
   - клик по артисту ведёт на `/artist/:id`;
   - клик по плейлисту ведёт на `/playlist/:id`;
   - если нет плейлиста, клик по альбому ведёт на `/album/:id`;
   - плеер сворачивается, музыка не останавливается.
2. ArtistPage:
   - страница с аватаркой мягко проявляет extracted palette;
   - страница без аватарки остаётся на дефолтной палитре;
   - треки и альбомы выглядят как единая система;
   - mobile layout не ломается.
3. AudioVisualizer:
   - старт на интенсивном моменте не даёт резкого скачка;
   - пауза/стоп мягко возвращает idle-состояние;
   - visualizer остаётся отзывчивым на музыку.
4. Page transitions:
   - переходы между страницами плавные;
   - ArtistPage не имеет отдельной конфликтующей entrance-анимации;
   - SearchPage не дублирует page entrance, но сохраняет анимацию вкладок результатов.

## Acceptance criteria

- Изменения ограничены целевыми frontend-файлами.
- Нет остановки музыки при навигации из expanded player.
- ArtistPage использует palette from avatar/custom palette/default fallback и анимирует её проявление.
- AudioVisualizer имеет общий activity envelope для плавного active/idle перехода.
- PageContent задаёт единый переход между страницами.
- `npm run build` в `frontend` завершается успешно или ошибки явно зафиксированы для исправления.
