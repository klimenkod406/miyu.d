# MiYu Diploma Report Formatting Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Продолжить редактирование дипломного отчёта `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`, сохранив строгое соответствие макету `genreport/МАКЕТ ДП ВЕБ (2026).docx` и фактическому проекту MiYu.

**Architecture:** Работа выполняется малыми партиями через safe-docx MCP: чтение целевых абзацев, замена текста в существующих узлах, вставка новых абзацев рядом с узлами макета, сохранение и повторная проверка. Макет используется как эталон структуры и форматирования; текущий отчёт редактируется как рабочий файл без прямого изменения DOCX через Python/JS/архив.

**Tech Stack:** safe-docx MCP для всех операций с DOCX; проектное содержание MiYu: React 18, Vite, TypeScript, Tailwind CSS, React Router, JWT/refresh-token паттерн, mock payment/ЮKassa imitation, музыкальный веб-сервис с пользователями, артистами, треками, альбомами, подписками, рекомендациями, лирикой и администрированием.

---

## File Structure

- Modify via MCP only: `C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx` — рабочий дипломный отчёт.
- Read via MCP only: `C:/Users/Денис/Desktop/miyu/genreport/МАКЕТ ДП ВЕБ (2026).docx` — эталон структуры и форматирования.
- Do not modify: `C:/Users/Денис/Desktop/miyu/genreport/МАКЕТ ДП ВЕБ (2026).docx` — исходный макет должен остаться неизменным.
- Do not use for DOCX editing: Python, JavaScript, zipfile, python-docx, LibreOffice automation, manual unzip/rezip.

---

### Task 1: Audit Current Report Structure Through MCP

**Files:**
- Read: `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`
- Read: `genreport/МАКЕТ ДП ВЕБ (2026).docx`

- [ ] **Step 1: Read the title/task section of the report**

Use safe-docx `read_file`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "offset": 1,
  "limit": 120,
  "format": "toon",
  "show_formatting": true
}
```
Expected: the report title already says `Проектирование и разработка музыкального веб-сервиса «MiYu»`; student data says `Клименко Денису Ярославовичу`; requirements describe a music service.

- [ ] **Step 2: Read the corresponding macro-layout in the template**

Use safe-docx `read_file`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/МАКЕТ ДП ВЕБ (2026).docx",
  "offset": 1,
  "limit": 120,
  "format": "toon",
  "show_formatting": true
}
```
Expected: same paragraph/table sequence and styles as the report.

- [ ] **Step 3: Read the main body in pages of 120 paragraphs**

Use safe-docx `read_file` on the report with offsets `121`, `241`, `361`, and `481`, each with `limit: 120`.
Expected: identify paragraphs that still describe Ukmas/shop/cart/order/product content, and identify where MiYu sections are incomplete or too generic.

---

### Task 2: Remove Old Ukmas/Shop Wording Safely

**Files:**
- Modify: `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`

- [ ] **Step 1: Search old project markers**

Use safe-docx `grep`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "patterns": ["Ukmas", "интернет-магаз", "корзин", "заказ", "товар", "персональн.*компьют"],
  "case_sensitive": false,
  "max_results": 200,
  "context_chars": 120,
  "dedupe_by_paragraph": true,
  "include_context": true
}
```
Expected: each result has a paragraph id, old text, and context.

- [ ] **Step 2: Replace only confirmed old-project paragraphs**

For each result that describes the old project rather than a general comparison, use safe-docx `replace_text` with the exact paragraph id and exact old string from `read_file`/`grep`.

Canonical replacements:
```text
интернет-магазин персональных компьютеров «Ukmas» -> музыкальный веб-сервис «MiYu»
интернет-магазин -> музыкальный веб-сервис
каталог товаров -> каталог треков, альбомов и видеоклипов
корзина -> плейлисты и избранное
оформление заказов -> прослушивание и управление музыкальным контентом
товары -> музыкальные композиции
административная панель для управления товарами, заказами и пользователями -> административная панель для модерации контента, управления пользователями и проверки публикаций артистов
```
Expected: no blind global replacements; each change is anchored to a specific paragraph id.

- [ ] **Step 3: Save the report**

Use safe-docx `save`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "save_format": "clean",
  "allow_overwrite": true,
  "clean_bookmarks": false
}
```
Expected: clean save succeeds; bookmarks remain available for continued edits.

---

### Task 3: Align Table of Contents and Section Headings

**Files:**
- Modify: `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`

- [ ] **Step 1: Locate contents and headings**

Use safe-docx `grep`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "patterns": ["СОДЕРЖАНИЕ", "ВВЕДЕНИЕ", "АНАЛИТИЧЕСКАЯ ЧАСТЬ", "ПРОЕКТИРОВАНИЕ", "РАЗРАБОТКА", "ТЕСТИРОВАНИЕ", "РУКОВОДСТВО", "ЗАКЛЮЧЕНИЕ", "СПИСОК"],
  "case_sensitive": false,
  "max_results": 200,
  "context_chars": 80,
  "dedupe_by_paragraph": true,
  "include_context": true
}
```
Expected: paragraph ids for contents rows and actual headings.

- [ ] **Step 2: Ensure this report structure is present**

Use MCP replacements/insertions to align text to this structure while preserving existing heading styles:
```text
ВВЕДЕНИЕ
1 АНАЛИТИЧЕСКАЯ ЧАСТЬ
1.1 Анализ предметной области
1.2 Обзор аналогов музыкальных сервисов
2 ПРОЕКТИРОВАНИЕ МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА «MIYU»
2.1 Определение требований к системе
2.2 Архитектура системы
2.3 Проектирование базы данных
2.4 Проектирование пользовательского интерфейса
2.5 Диаграмма вариантов использования
2.6 Обоснование выбора технологий разработки
3 РАЗРАБОТКА МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА «MIYU»
3.1 Создание дизайна веб-сервиса
3.2 Разработка клиентской части
3.3 Разработка серверной части
3.4 Разработка AI-сервиса, анализа лирики и рекомендаций
4 ТЕСТИРОВАНИЕ МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА «MIYU»
4.1 Основные понятия и принципы тестирования
4.2 Тестирование методом «белого ящика»
4.3 Тестирование методом «черного ящика»
4.4 Тестирование методом Test Case
5 РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ
5.1 Руководство для пользователя
5.2 Руководство для артиста
5.3 Руководство для администратора и модератора
ЗАКЛЮЧЕНИЕ
СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ
ПРИЛОЖЕНИЕ А
ПРИЛОЖЕНИЕ Б
ПРИЛОЖЕНИЕ В
```
Expected: section titles match MiYu; no shop-specific headings remain.

- [ ] **Step 3: Save and re-read affected area**

Use safe-docx `save`, then `read_file` around the contents and heading paragraphs.
Expected: title order remains readable and formatting tags/styles remain consistent with the template.

---

### Task 4: Continue Main Body Content With MiYu-Specific Text

**Files:**
- Modify: `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`

- [ ] **Step 1: Fill or replace introduction paragraphs**

Use safe-docx `replace_text`/`insert_paragraph` near the `ВВЕДЕНИЕ` heading. The introduction must cover:
```text
Актуальность: рост музыкальных веб-сервисов, потребность в едином интерфейсе для слушателей и артистов.
Цель: проектирование и разработка музыкального веб-сервиса «MiYu».
Объект: процессы публикации, поиска, прослушивания и модерации музыкального контента.
Предмет: веб-приложение и интерфейсы взаимодействия пользователей, артистов и администраторов.
Задачи: анализ предметной области, выбор технологий, проектирование структуры данных и интерфейса, разработка клиентской части, описание серверной логики и AI-функций, проверка работоспособности.
Результат: адаптивный музыкальный сервис с треками, альбомами, подписками, рекомендациями, лирикой, ролями пользователя/артиста/администратора и mock payment по сценарию ЮKassa imitation.
```
Expected: introduction describes MiYu, not an online shop.

- [ ] **Step 2: Fill analytical and design sections**

Use existing section paragraphs as anchors and replace generic/shop text with MiYu content:
```text
Аналоги: Spotify, Яндекс Музыка, VK Музыка, SoundCloud.
Functional comparison: поиск, рекомендации, артистские кабинеты, социальные функции, модерация, тексты песен.
Requirements: регистрация, JWT/refresh-token pattern, просмотр треков/альбомов/артистов, подписки на артистов, лента обновлений, плейлисты, лайки, админка, модерация, mock payment.
Architecture: frontend React/Vite/TypeScript/Tailwind, React Router, компоненты плеера и визуализатора; backend/API concept; SQLite database; AI-service for lyrics/analysis/recommendations.
Database concepts: users, artist profiles, tracks, albums, playlists, follows, likes, lyrics/analysis, admin/moderation entities.
```
Expected: content matches current project instructions and memory; no invented production deployment claims.

- [ ] **Step 3: Fill development, testing, and user guide sections**

Use existing section paragraphs as anchors and replace generic/shop text with MiYu content:
```text
Development: frontend pages/components, playback UX, artist subscriptions, track and album pages, admin/moderation screens, mock payment scenario.
Testing: frontend build as required verification, lint if available, route rendering, authentication flows, playback interactions, upload/moderation scenarios, recommendation/feed scenarios.
User guide: listener registration/login, search/listen/like/playlist/subscription flows; artist publication flow; admin/moderator review flow.
Conclusion: achieved web-service design and implementation description, future improvements include backend hardening, production storage, richer recommendation models and deployment preparation.
```
Expected: report remains diploma-style and fact-based.

- [ ] **Step 4: Save after each edited section group**

Use safe-docx `save` after introduction, after design sections, and after final sections.
Expected: each save succeeds before moving to the next group.

---

### Task 5: Verify Formatting and Content Through MCP

**Files:**
- Verify: `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`
- Read: `genreport/МАКЕТ ДП ВЕБ (2026).docx`

- [ ] **Step 1: Verify old wording is gone**

Use safe-docx `grep`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "patterns": ["Ukmas", "интернет-магаз", "корзин", "оформление заказ", "каталог товаров", "персональн.*компьют"],
  "case_sensitive": false,
  "max_results": 200,
  "context_chars": 100,
  "dedupe_by_paragraph": true,
  "include_context": true
}
```
Expected: zero results, except intentional mentions if a section explicitly compares old and new topics; such mentions should normally be removed.

- [ ] **Step 2: Verify MiYu key content exists**

Use safe-docx `grep`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "patterns": ["MiYu", "музыкальн.*веб-сервис", "React", "Vite", "TypeScript", "Tailwind", "JWT", "плейлист", "артист", "альбом", "трек", "рекомендац", "лирик|текст.*пес", "модерац", "ЮKassa|ЮКасса"],
  "case_sensitive": false,
  "max_results": 300,
  "context_chars": 80,
  "dedupe_by_paragraph": true,
  "include_context": true
}
```
Expected: all major project concepts appear in relevant sections.

- [ ] **Step 3: Compare structural samples with the template**

Use safe-docx `read_file` on both files at the same offsets: `1`, `121`, `241`, `361`, `481` with `limit: 40`.
Expected: the report keeps the same broad paragraph/table flow as the template and does not lose title/task/table blocks.

- [ ] **Step 4: Final MCP save**

Use safe-docx `save`:
```json
{
  "file_path": "C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_MiYu_по_макету_2026.docx",
  "save_format": "clean",
  "allow_overwrite": true,
  "clean_bookmarks": false
}
```
Expected: final save succeeds and the working file remains at `genreport/Диплом_Клименко_MiYu_по_макету_2026.docx`.

---

## Self-Review

- Spec coverage: план покрывает чтение текущего отчёта и макета, точечное удаление старого Ukmas/shop-содержания, выравнивание структуры, продолжение содержательных разделов по проекту MiYu и финальную проверку.
- Placeholder scan: нет `TBD`, `TODO`, `implement later`, неопределённых файлов или размытых команд; все DOCX-операции явно выполняются через safe-docx MCP.
- Type/path consistency: используется один рабочий DOCX и один DOCX-макет; прямое редактирование DOCX через скрипты запрещено, что соответствует требованию пользователя.
- Scope check: план относится только к продолжению дипломного отчёта и не меняет код проекта.
