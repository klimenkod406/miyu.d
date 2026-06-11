# Diploma Report Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a ready `.docx` diploma report for Denis Klimenko's Miyu project using the selected report examples as structural references.

**Architecture:** Create a focused Python generator that reads project documentation and emits a new Word document with academic Russian content, consistent headings, margins, typography, tables, and sections. Do not modify the source examples in `genreport/`; use them only as references for expected structure.

**Tech Stack:** Python 3, `python-docx`, existing Markdown/project files, generated `.docx` output.

---

## File Structure

- Create: `tools/generate_diploma_report.py` — single-purpose generator for the Miyu diploma report.
- Read: `docs/PROJECT_ARCHITECTURE.md` — factual architecture source.
- Read: `docs/PAGES_CHECKLIST.md` — page/scope source if needed.
- Reference only: `genreport/МАКЕТ ДП ВЕБ (2026).doc` — template/structure reference, never modified.
- Reference only: `genreport/Диплом гайнутдинов23.doc` — finished report style reference, never modified.
- Create: `Диплом_Клименко_Денис_Мийу.docx` — final Word report.

## Task 1: Create generator skeleton and document helpers

**Files:**
- Create: `tools/generate_diploma_report.py`
- Output: `Диплом_Клименко_Денис_Мийу.docx`

- [ ] **Step 1: Create `tools/generate_diploma_report.py` with imports, constants, and style helpers**

```python
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Диплом_Клименко_Денис_Мийу.docx"
PROJECT_DOC = ROOT / "docs" / "PROJECT_ARCHITECTURE.md"
PAGES_DOC = ROOT / "docs" / "PAGES_CHECKLIST.md"

AUTHOR = "Клименко Денис"
PROJECT_NAME = "Мийу"
PROJECT_FULL_NAME = "Разработка музыкального стримингового сервиса «Мийу»"


def set_cell_text(cell, text: str, bold: bool = False) -> None:
    cell.text = ""
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.bold = bold


def set_paragraph_format(paragraph, *, align=None, first_line=True, space_after=0) -> None:
    paragraph.paragraph_format.line_spacing = 1.5
    paragraph.paragraph_format.space_after = Pt(space_after)
    if first_line:
        paragraph.paragraph_format.first_line_indent = Cm(1.25)
    if align is not None:
        paragraph.alignment = align


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    fld_char_1 = OxmlElement("w:fldChar")
    fld_char_1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char_2 = OxmlElement("w:fldChar")
    fld_char_2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char_1)
    run._r.append(instr_text)
    run._r.append(fld_char_2)


def configure_document(document: Document) -> None:
    section = document.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(3)
    section.right_margin = Cm(1.5)

    styles = document.styles
    styles["Normal"].font.name = "Times New Roman"
    styles["Normal"].font.size = Pt(14)

    for style_name in ["Heading 1", "Heading 2", "Heading 3"]:
        style = styles[style_name]
        style.font.name = "Times New Roman"
        style.font.bold = True
        style.font.size = Pt(14)

    add_page_number(section.footer.paragraphs[0])
```

- [ ] **Step 2: Run syntax check**

Run: `python -m py_compile tools/generate_diploma_report.py`
Expected: command exits with code 0 and no output.

## Task 2: Add content building functions

**Files:**
- Modify: `tools/generate_diploma_report.py`

- [ ] **Step 1: Add heading and paragraph helpers**

```python
def add_centered(document: Document, text: str, *, bold: bool = False, size: int = 14) -> None:
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.line_spacing = 1.5
    run = paragraph.add_run(text)
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.bold = bold


def add_text(document: Document, text: str) -> None:
    paragraph = document.add_paragraph(text)
    set_paragraph_format(paragraph, align=WD_ALIGN_PARAGRAPH.JUSTIFY)


def add_section_title(document: Document, title: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(12)
    paragraph.paragraph_format.space_after = Pt(12)
    run = paragraph.add_run(title.upper())
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.bold = True


def add_subtitle(document: Document, title: str) -> None:
    paragraph = document.add_paragraph()
    set_paragraph_format(paragraph, first_line=False, space_after=6)
    run = paragraph.add_run(title)
    run.font.name = "Times New Roman"
    run.font.size = Pt(14)
    run.bold = True


def add_bullets(document: Document, items: list[str]) -> None:
    for item in items:
        paragraph = document.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.line_spacing = 1.5
        paragraph.paragraph_format.left_indent = Cm(1.25)
        run = paragraph.add_run(item)
        run.font.name = "Times New Roman"
        run.font.size = Pt(14)
```

- [ ] **Step 2: Add title page function**

```python
def add_title_page(document: Document) -> None:
    add_centered(document, "Министерство образования и науки Республики Татарстан", size=14)
    add_centered(document, "ГАПОУ «Казанский техникум информационных технологий и связи»", size=14)
    document.add_paragraph("\n\n\n")
    add_centered(document, "ПОЯСНИТЕЛЬНАЯ ЗАПИСКА", bold=True, size=16)
    add_centered(document, "к дипломному проекту", size=14)
    document.add_paragraph("\n")
    add_centered(document, PROJECT_FULL_NAME, bold=True, size=16)
    document.add_paragraph("\n\n")

    table = document.add_table(rows=4, cols=2)
    table.autofit = True
    rows = [
        ("Студент", AUTHOR),
        ("Группа", ""),
        ("Руководитель", ""),
        ("Специальность", "09.02.07 Информационные системы и программирование"),
    ]
    for row, (left, right) in zip(table.rows, rows):
        set_cell_text(row.cells[0], left, bold=True)
        set_cell_text(row.cells[1], right)

    document.add_paragraph("\n\n\n")
    add_centered(document, "Казань, 2026", size=14)
    document.add_page_break()
```

- [ ] **Step 3: Run syntax check**

Run: `python -m py_compile tools/generate_diploma_report.py`
Expected: command exits with code 0 and no output.

## Task 3: Add report sections with factual Miyu content

**Files:**
- Modify: `tools/generate_diploma_report.py`

- [ ] **Step 1: Add `add_intro` function**

```python
def add_intro(document: Document) -> None:
    add_section_title(document, "Введение")
    add_text(document, "Современные музыкальные сервисы являются важной частью цифровой среды. Пользователю недостаточно простого хранения аудиофайлов: востребованы персональные рекомендации, удобная библиотека, социальные функции, клипы, концерты, монетизация и инструменты для артистов. Поэтому разработка веб-приложения, объединяющего прослушивание музыки, управление контентом и интеллектуальный анализ треков, является актуальной задачей.")
    add_text(document, "Цель дипломного проекта — разработать музыкальный стриминговый сервис «Мийу», обеспечивающий прослушивание треков, работу с альбомами и плейлистами, взаимодействие пользователей и артистов, администрирование контента, модерацию и использование AI-сервиса для анализа музыкальных материалов.")
    add_text(document, "Для достижения цели были поставлены следующие задачи:")
    add_bullets(document, [
        "проанализировать предметную область музыкальных онлайн-сервисов;",
        "спроектировать архитектуру frontend, backend, базы данных и AI-сервиса;",
        "разработать пользовательский интерфейс веб-приложения;",
        "реализовать серверную часть с REST API и авторизацией;",
        "создать структуру базы данных для пользователей, треков, альбомов, плейлистов, концертов и AI-аналитики;",
        "описать механизмы модерации, рекомендаций и тестирования работоспособности системы.",
    ])
    add_text(document, "Объектом исследования является процесс разработки веб-сервиса для музыкального стриминга. Предметом исследования являются программные средства и архитектурные решения, применяемые при создании сервиса «Мийу».")
```

- [ ] **Step 2: Add architecture and technology functions**

```python
def add_architecture(document: Document) -> None:
    add_section_title(document, "1 Аналитическая и проектная часть")
    add_subtitle(document, "1.1 Назначение системы")
    add_text(document, "Сервис «Мийу» предназначен для организации цифровой музыкальной платформы. Пользователь может просматривать главную страницу, слушать треки, открывать страницы артистов и альбомов, формировать библиотеку, подписываться на артистов, смотреть клипы, использовать социальные функции и покупать билеты на концерты. Артисты получают кабинет для публикации треков, альбомов, видео и концертов. Администраторы и модераторы управляют пользователями, контентом и заявками.")
    add_subtitle(document, "1.2 Общая архитектура")
    add_text(document, "Архитектура проекта разделена на три основных контура: клиентское приложение, серверное API и отдельный AI-сервис. Такой подход позволяет отделить пользовательский интерфейс от бизнес-логики, а ресурсоемкие операции анализа аудио и текста вынести в независимый Python-сервис.")
    add_bullets(document, [
        "Frontend — React-приложение с маршрутизацией, страницами и UI-компонентами;",
        "Backend — REST API на Node.js и Express для авторизации, каталога, социальных функций, билетов и администрирования;",
        "Database — SQLite-база данных с таблицами пользователей, контента, статистики, платежей и AI-аналитики;",
        "AI-service — отдельный сервис на Python/FastAPI для анализа треков, транскрипции, модерации и рекомендаций.",
    ])
    add_subtitle(document, "1.3 Роли пользователей")
    add_text(document, "В системе предусмотрены роли user, artist, moderator и admin. Обычный пользователь взаимодействует с музыкальным каталогом и социальной частью. Артист публикует и анализирует собственный контент. Модератор проверяет материалы и жалобы. Администратор управляет пользователями, достижениями, концертами и общей статистикой сервиса.")


def add_technology(document: Document) -> None:
    add_section_title(document, "2 Технологическая часть")
    add_subtitle(document, "2.1 Frontend")
    add_text(document, "Клиентская часть реализована на React 18 с использованием TypeScript и сборщика Vite. Для маршрутизации применяется React Router DOM. Стилизация построена на Tailwind CSS, а интерфейс использует темную визуальную концепцию, glassmorphism, неоновые градиенты, анимации плеера и фоновые космические эффекты.")
    add_text(document, "Frontend содержит страницы главной ленты, поиска, треков, альбомов, артистов, клипов, профиля, плейлистов, билетов, статистики, административной панели и кабинета артиста. Компоненты вынесены в каталог `frontend/src/components`, страницы — в `frontend/src/pages`, API-обертки — в `frontend/src/api`, а контексты и хуки — в `frontend/src/hooks`.")
    add_subtitle(document, "2.2 Backend")
    add_text(document, "Серверная часть реализована на Node.js, Express и TypeScript. Backend отвечает за HTTP API, авторизацию, обработку файлов, работу с базой данных, бизнес-логику музыкального каталога, плейлистов, подписок, уведомлений, билетов, платежей, достижений и административных функций.")
    add_text(document, "В backend используются JWT-токены, refresh-токены, bcryptjs для хеширования паролей, multer для загрузки файлов, cors для настройки доступа между клиентом и сервером, dotenv для конфигурации окружения и sqlite3 для работы с локальной базой данных.")
    add_subtitle(document, "2.3 AI-service")
    add_text(document, "AI-сервис реализуется как отдельный Python/FastAPI-контур. Он предназначен для анализа аудиофайлов, извлечения признаков, транскрипции текста песен, текстовой и визуальной модерации, построения похожести треков и персонализированных рекомендаций. Для этих задач применяются библиотеки librosa, torch, faster-whisper, transformers, sentence-transformers, detoxify, hnswlib и другие инструменты анализа данных.")
```

- [ ] **Step 3: Add database, UI, security, testing, conclusion functions**

```python
def add_database(document: Document) -> None:
    add_section_title(document, "3 Описание базы данных")
    add_text(document, "В проекте используется SQLite. База данных хранит сведения о пользователях, ролях, профилях артистов, refresh-токенах, альбомах, треках, видео, плейлистах, лайках, подписках, дружбе, уведомлениях, концертах, билетах, транзакциях, достижениях, модерации и результатах AI-анализа.")
    table = document.add_table(rows=1, cols=2)
    set_cell_text(table.rows[0].cells[0], "Подсистема", bold=True)
    set_cell_text(table.rows[0].cells[1], "Основные таблицы", bold=True)
    data = [
        ("Пользователи", "users, refresh_tokens, artist_profiles"),
        ("Музыкальный каталог", "albums, tracks, track_plays, videos, video_views"),
        ("Библиотека и социальные функции", "playlists, playlist_tracks, likes, album_likes, artist_follows, friendships, notifications"),
        ("Концерты и монетизация", "concerts, ticket_types, tickets, subscriptions, transactions, donations, promotions"),
        ("AI и модерация", "track_analysis, track_similarity, user_taste_profile, recsys_feedback, ai_jobs, moderation_queue, reports"),
    ]
    for subsystem, tables in data:
        row = table.add_row()
        set_cell_text(row.cells[0], subsystem)
        set_cell_text(row.cells[1], tables)
    add_text(document, "Схема использует внешние ключи, каскадное удаление связанных данных, ограничения CHECK для статусов и индексы по часто используемым полям. Миграции выполняются через SQL-файлы и TypeScript-логику backend, что позволяет постепенно расширять структуру данных.")


def add_ui_security_testing(document: Document) -> None:
    add_section_title(document, "4 Пользовательский интерфейс и безопасность")
    add_text(document, "Интерфейс «Мийу» выполнен в темной цветовой схеме с акцентами фиолетового, розового и голубого цветов. Визуальная концепция использует стеклянные панели, плавные анимации, музыкальный визуализатор, персональные палитры пользователя и динамический плеер. Это формирует узнаваемый стиль продукта и усиливает ощущение современного музыкального сервиса.")
    add_text(document, "Безопасность обеспечивается разделением ролей, JWT-авторизацией, refresh-токенами, хешированием паролей, проверкой прав доступа на backend, модерацией контента и административными инструментами. Загружаемые материалы проходят обработку через серверную часть, а AI-сервис помогает анализировать текстовую и визуальную составляющую контента.")
    add_section_title(document, "5 Тестирование")
    add_text(document, "Проверка работоспособности выполняется через запуск frontend-сборки, backend-сервера и основных пользовательских сценариев. Тестируются регистрация и вход, загрузка страниц, работа плеера, поиск, просмотр треков и альбомов, создание плейлистов, подписки, административные разделы, загрузка материалов артистом, модерация и получение рекомендаций.")
    add_text(document, "Для frontend используется команда `npm run build`, которая выполняет TypeScript-проверку и сборку Vite. Для backend применяются TypeScript-компиляция, запуск миграций и ручная проверка REST API. Дополнительно проверяется наличие данных в SQLite и корректность связей между сущностями.")


def add_economics_and_conclusion(document: Document) -> None:
    add_section_title(document, "6 Организационно-экономическая часть")
    add_text(document, "Разработка сервиса «Мийу» может быть организована как учебный программный проект с последующим развитием до коммерческого продукта. Основные затраты связаны с проектированием интерфейса, разработкой frontend и backend, настройкой базы данных, реализацией AI-сервиса, тестированием, размещением на сервере и поддержкой файлового хранилища.")
    add_text(document, "Экономическая эффективность проекта выражается в возможности предоставить пользователям единую платформу для музыки, артистам — инструменты публикации и продвижения, а администрации — механизмы управления контентом и монетизацией. Потенциальные источники дохода включают премиум-подписки, билеты на концерты, донаты, продвижение артистов и партнерские интеграции.")
    add_section_title(document, "Заключение")
    add_text(document, "В ходе выполнения дипломного проекта был спроектирован и описан музыкальный стриминговый сервис «Мийу». В работе рассмотрены предметная область, архитектура приложения, технологический стек, структура базы данных, пользовательский интерфейс, вопросы безопасности, модерации, AI-анализа и тестирования.")
    add_text(document, "Проект демонстрирует комплексный подход к созданию современного веб-сервиса: React-приложение отвечает за удобный интерфейс, Express backend реализует бизнес-логику и API, SQLite хранит данные, а Python AI-service расширяет систему функциями анализа и рекомендаций. Поставленные задачи дипломного проекта можно считать выполненными.")
```

- [ ] **Step 4: Run syntax check**

Run: `python -m py_compile tools/generate_diploma_report.py`
Expected: command exits with code 0 and no output.

## Task 4: Add content assembly, sources, and generation command

**Files:**
- Modify: `tools/generate_diploma_report.py`
- Create: `Диплом_Клименко_Денис_Мийу.docx`

- [ ] **Step 1: Add table of contents placeholder and sources**

```python
def add_contents(document: Document) -> None:
    add_section_title(document, "Содержание")
    for line in [
        "Введение",
        "1 Аналитическая и проектная часть",
        "2 Технологическая часть",
        "3 Описание базы данных",
        "4 Пользовательский интерфейс и безопасность",
        "5 Тестирование",
        "6 Организационно-экономическая часть",
        "Заключение",
        "Список использованных источников",
        "Приложения",
    ]:
        paragraph = document.add_paragraph(line)
        set_paragraph_format(paragraph, first_line=False)
    document.add_page_break()


def add_sources(document: Document) -> None:
    add_section_title(document, "Список использованных источников")
    sources = [
        "Документация React. Официальный сайт библиотеки React.",
        "Документация Vite. Официальный сайт сборщика Vite.",
        "Документация TypeScript. Официальный сайт языка TypeScript.",
        "Документация Express. Официальный сайт фреймворка Express.",
        "Документация SQLite. Официальный сайт SQLite.",
        "Документация FastAPI. Официальный сайт FastAPI.",
        "Документация Tailwind CSS. Официальный сайт Tailwind CSS.",
        "Проектная документация Miyu: docs/PROJECT_ARCHITECTURE.md.",
    ]
    for index, source in enumerate(sources, start=1):
        paragraph = document.add_paragraph(f"{index}. {source}")
        set_paragraph_format(paragraph, first_line=False)


def add_appendices(document: Document) -> None:
    add_section_title(document, "Приложения")
    add_text(document, "Приложение А. Структура программного проекта Miyu включает каталоги frontend, backend, ai-service, database и docs. Frontend содержит страницы, компоненты, API-обертки и хуки. Backend содержит маршруты, middleware, сервисы, миграции и подключение к базе данных. AI-service содержит Python-модули анализа, модерации, транскрипции и рекомендаций.")
    add_text(document, "Приложение Б. Основные команды разработки: для frontend используется `npm run dev`, `npm run build`, `npm run lint`; для backend — запуск TypeScript/Node.js сервера и миграций; для AI-service — запуск FastAPI-приложения и фоновых задач анализа.")
```

- [ ] **Step 2: Add `build_report` and script entrypoint**

```python
def build_report() -> None:
    document = Document()
    configure_document(document)
    add_title_page(document)
    add_contents(document)
    add_intro(document)
    add_architecture(document)
    add_technology(document)
    add_database(document)
    add_ui_security_testing(document)
    add_economics_and_conclusion(document)
    add_sources(document)
    add_appendices(document)
    document.save(OUTPUT)
    print(f"Generated: {OUTPUT}")


if __name__ == "__main__":
    build_report()
```

- [ ] **Step 3: Run generator**

Run: `python tools/generate_diploma_report.py`
Expected: output contains `Generated: ...Диплом_Клименко_Денис_Мийу.docx`.

## Task 5: Verify generated document

**Files:**
- Read/verify: `Диплом_Клименко_Денис_Мийу.docx`
- Modify if needed: `tools/generate_diploma_report.py`

- [ ] **Step 1: Verify file exists and can be opened by python-docx**

Run: `python - <<'PY'
from docx import Document
from pathlib import Path
p = Path('Диплом_Клименко_Денис_Мийу.docx')
print('exists', p.exists())
print('size', p.stat().st_size if p.exists() else 0)
doc = Document(p)
text = '\n'.join(par.text for par in doc.paragraphs)
for marker in ['Введение', 'Технологическая часть', 'Описание базы данных', 'Заключение', 'Клименко Денис', 'Мийу']:
    print(marker, marker in text)
print('paragraphs', len(doc.paragraphs))
print('tables', len(doc.tables))
PY`
Expected: `exists True`, positive size, all markers `True`, paragraphs greater than 40, tables greater than or equal to 2.

- [ ] **Step 2: Verify no placeholders remain**

Run: `python - <<'PY'
from docx import Document
text = '\n'.join(par.text for par in Document('Диплом_Клименко_Денис_Мийу.docx').paragraphs)
for bad in ['TODO', 'TBD', 'заполнить', 'placeholder']:
    print(bad, bad.lower() in text.lower())
PY`
Expected: every line ends with `False`.

- [ ] **Step 3: If verification fails, fix generator and regenerate**

Run after edits: `python tools/generate_diploma_report.py`
Expected: generated document passes Task 5 Steps 1 and 2.

## Self-Review

Spec coverage:
- Ready `.docx` output: Task 4 and Task 5.
- Source examples untouched: plan only reads/references `genreport/` files.
- Miyu project facts: Task 3 uses architecture from project docs.
- Author data: constants in Task 1 and title page in Task 2.
- Quality check: Task 5.

Placeholder scan:
- No `TBD` or generic implementation placeholders are required in the final document.
- The title page has empty group/supervisor fields because the user only approved personal data and did not provide these values. They are intentionally blank form fields, not generation placeholders.

Type consistency:
- All helper names used in later tasks are defined before use.
- Output path and constants are shared through top-level variables.
