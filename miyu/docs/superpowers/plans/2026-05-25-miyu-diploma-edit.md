# MiYu Diploma Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a separate edited `.docx` diploma for the topic “Разработка музыкального веб-сервиса «Мийу»” while preserving the formatting of the approved sample document.

**Architecture:** Work from the existing formatted DOCX `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_по_образцу.docx`, not from the legacy `.doc`. Use the legacy `genreport/Диплом гайнутдинов23.doc` only as a structure reference. Because `safe-docx` currently fails in this environment with a JSON schema validation error, inspect and edit DOCX internals through Python `zipfile` + XML parsing and save a copy instead of overwriting originals.

**Tech Stack:** Microsoft Word DOCX package, Python standard library (`zipfile`, `xml.etree.ElementTree`, `shutil`, `re`), existing project materials (`TECH_STACK.md`, `docs/PROJECT_ARCHITECTURE.md`, `docs/AI_ARCHITECTURE.md`, `docs/PAGES_CHECKLIST.md`).

---

## File Structure

- Source sample: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_по_образцу.docx`
  - Read-only input; contains existing formatting and likely current draft content.
- Structure reference: `C:/Users/Денис/Desktop/miyu/genreport/Диплом гайнутдинов23.doc`
  - Read-only legacy Word file; use for high-level chapter order only.
- Project references:
  - `C:/Users/Денис/Desktop/miyu/TECH_STACK.md`
  - `C:/Users/Денис/Desktop/miyu/docs/PROJECT_ARCHITECTURE.md`
  - `C:/Users/Денис/Desktop/miyu/docs/AI_ARCHITECTURE.md`
  - `C:/Users/Денис/Desktop/miyu/docs/PAGES_CHECKLIST.md`
- Output document:
  - Create: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`
- Temporary inspection files:
  - Create/delete as needed under `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/`

## Task 1: Inspect Document Text and Chapter Map

**Files:**
- Read: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_по_образцу.docx`
- Read: `C:/Users/Денис/Desktop/miyu/genreport/Диплом гайнутдинов23.doc`
- Read: `C:/Users/Денис/Desktop/miyu/TECH_STACK.md`
- Create: `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/document-text.txt`
- Create: `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/chapter-map.txt`

- [ ] **Step 1: Extract DOCX paragraph text**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

base = Path('C:/Users/Денис/Desktop/miyu')
src = base / 'Диплом_Клименко_Денис_Мийу_по_образцу.docx'
work = base / '.openclaude-diploma-work'
work.mkdir(exist_ok=True)
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

with ZipFile(src) as z:
    xml = z.read('word/document.xml')
root = ET.fromstring(xml)
lines = []
for idx, p in enumerate(root.findall('.//w:p', ns), start=1):
    text = ''.join(t.text or '' for t in p.findall('.//w:t', ns))
    if text.strip():
        lines.append(f'{idx}: {text}')
(work / 'document-text.txt').write_text('\n'.join(lines), encoding='utf-8')
print(f'Extracted {len(lines)} non-empty paragraphs')
PY
```
Expected: prints a positive paragraph count and creates `document-text.txt`.

- [ ] **Step 2: Extract legacy DOC structure reference**

Run:
```bash
antiword "C:/Users/Денис/Desktop/miyu/genreport/Диплом гайнутдинов23.doc" > "C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/legacy-structure.txt"
```
Expected: creates `legacy-structure.txt`; mojibake is acceptable if headings/pages are not fully readable, because it is only a secondary reference.

- [ ] **Step 3: Build chapter map manually from extracted text**

Open/read `document-text.txt` and write `chapter-map.txt` with this exact structure:
```text
Title page: paragraphs <ids>
Contents: paragraphs <ids>
Introduction: paragraphs <ids>
Chapter 1: paragraphs <ids>
Chapter 2: paragraphs <ids>
Chapter 3: paragraphs <ids>
Testing / implementation chapter: paragraphs <ids>
Conclusion: paragraphs <ids>
References: paragraphs <ids>
Appendices: paragraphs <ids>
Foreign-topic or outdated paragraphs to replace: <ids and short reason>
Missing MiYu-specific sections to add: <section names>
```
Expected: `chapter-map.txt` lists exact paragraph IDs or clearly states if a section is missing.

## Task 2: Create a Safe Working Copy

**Files:**
- Read: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_по_образцу.docx`
- Create: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`

- [ ] **Step 1: Copy the source DOCX**

Run:
```bash
python - <<'PY'
from pathlib import Path
import shutil
base = Path('C:/Users/Денис/Desktop/miyu')
src = base / 'Диплом_Клименко_Денис_Мийу_по_образцу.docx'
out = base / 'Диплом_Клименко_Денис_Мийу_отредактированный.docx'
shutil.copy2(src, out)
print(out)
PY
```
Expected: output file exists; original source file remains unchanged.

- [ ] **Step 2: Verify copy is a valid DOCX archive**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
out = Path('C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx')
with ZipFile(out) as z:
    names = set(z.namelist())
required = {'[Content_Types].xml', 'word/document.xml'}
missing = required - names
assert not missing, missing
print('valid docx')
PY
```
Expected: `valid docx`.

## Task 3: Rewrite Topic-Specific Narrative

**Files:**
- Modify: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`
- Read: `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/chapter-map.txt`
- Read: `C:/Users/Денис/Desktop/miyu/TECH_STACK.md`
- Read: `C:/Users/Денис/Desktop/miyu/docs/PROJECT_ARCHITECTURE.md`
- Read: `C:/Users/Денис/Desktop/miyu/docs/AI_ARCHITECTURE.md`

- [ ] **Step 1: Prepare replacement text blocks**

Create a replacement plan in memory or a temporary JSON file with exact Russian text for these sections:
```text
Введение:
- актуальность музыкального веб-сервиса;
- цель: разработать музыкальный веб-сервис «Мийу»;
- задачи: анализ предметной области, проектирование архитектуры, разработка интерфейса, реализация функциональности, тестирование;
- объект: процесс предоставления доступа к музыкальному контенту через веб-приложение;
- предмет: веб-сервис с каталогом, плеером, авторизацией и рекомендательными возможностями.

Глава 1:
- предметная область музыкальных стриминговых сервисов;
- обзор аналогов и обоснование разработки «Мийу»;
- требования к интерфейсу, навигации, воспроизведению и личному кабинету.

Глава 2:
- архитектура проекта: React + Vite frontend, Express backend, FastAPI AI-service, SQLite;
- проектирование страниц, компонентов и маршрутов;
- описание базы данных без Django-таблиц, если они встречаются;
- описание AI-рекомендаций как отдельного сервиса.

Глава 3:
- реализация интерфейса, плеера, каталога, авторизации, страниц треков/альбомов/плейлистов;
- используемые технологии: TypeScript, Tailwind CSS, React Router, Zustand или фактические state hooks по проекту;
- сборка и запуск через npm scripts.

Тестирование:
- проверка сборки frontend;
- ручная проверка основных пользовательских сценариев;
- проверка адаптивности и корректности отображения.

Заключение:
- достигнута цель разработки;
- перечислены реализованные возможности;
- указаны направления развития: реальные платежи, расширение backend, улучшение рекомендаций.
```
Expected: replacement text avoids references to `MY TODOLIST`, Django schema, unrelated authors, unrelated screenshots.

- [ ] **Step 2: Replace foreign-topic text while preserving runs where possible**

Run a Python XML edit script that:
1. Opens output DOCX as zip.
2. Parses `word/document.xml`.
3. Finds paragraphs by text from `chapter-map.txt`.
4. Replaces whole paragraph text by clearing existing `w:t` nodes and writing replacement text into the first run.
5. Keeps paragraph properties (`w:pPr`) intact.
6. Writes the archive back to a temporary DOCX, then replaces output.

Expected: formatting such as page margins, paragraph styles, numbering, and section breaks remain from the source document.

- [ ] **Step 3: Verify forbidden topic strings are gone**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

out = Path('C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx')
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(out) as z:
    xml = z.read('word/document.xml')
root = ET.fromstring(xml)
text = '\n'.join(''.join(t.text or '' for t in p.findall('.//w:t', ns)) for p in root.findall('.//w:p', ns))
forbidden = ['MY TODOLIST', 'My TodoList', 'todo', 'Django', 'Гайнутдинов']
found = [s for s in forbidden if s.lower() in text.lower()]
assert not found, found
print('forbidden strings absent')
PY
```
Expected: `forbidden strings absent`. If a forbidden word appears only in a valid bibliography title or unavoidable context, inspect it and decide whether to keep or replace.

## Task 4: Add Missing MiYu-Specific Sections

**Files:**
- Modify: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`
- Read: `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/chapter-map.txt`
- Read: `C:/Users/Денис/Desktop/miyu/docs/PAGES_CHECKLIST.md`

- [ ] **Step 1: Identify insertion anchors**

Use `chapter-map.txt` to choose exact paragraph anchors for missing sections:
```text
2.x Архитектура веб-сервиса «Мийу» -> insert after last existing design subsection in Chapter 2
2.x Проектирование базы данных -> insert after architecture subsection
3.x Реализация пользовательского интерфейса -> insert in implementation chapter
3.x Реализация музыкального плеера -> insert after UI implementation
3.x Проверка работоспособности -> insert before conclusion or testing chapter
```
Expected: every insertion has a real existing paragraph anchor.

- [ ] **Step 2: Insert new paragraphs by cloning nearby paragraph style**

Run a Python XML script that clones an existing normal body paragraph or heading paragraph near each anchor, replaces its text, and inserts it after the anchor. For section headings, clone a heading paragraph from the same chapter. For body text, clone a body paragraph from the same chapter.

Expected: newly inserted headings and paragraphs visually match surrounding content.

- [ ] **Step 3: Keep additions concise**

Each new subsection should contain 2-4 paragraphs. Do not add speculative features that are not present in the project materials. The text must describe the actual project state: React frontend is active; backend/AI/database descriptions should follow current project docs and not invent production deployment if not documented.

Expected: document is longer and more complete, but not bloated.

## Task 5: Update Title Page, Contents, and References

**Files:**
- Modify: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`
- Read: `C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work/document-text.txt`

- [ ] **Step 1: Update visible title/theme occurrences**

Replace old topic names with:
```text
Разработка музыкального веб-сервиса «Мийу»
```
Expected: title page and repeated topic references use the MiYu theme.

- [ ] **Step 2: Update author/student fields only when already present**

If the source document contains the student name, keep or normalize it as:
```text
Клименко Денис
```
Do not invent group number, supervisor name, or organization fields if they are not already available in the document.
Expected: no fabricated personal/college metadata.

- [ ] **Step 3: Update contents text without recalculating Word page numbers**

If the table of contents is plain text, update section names to match the edited document. If it is a Word field, leave the field structure intact and only update heading paragraphs; Word can refresh the TOC later.
Expected: section names match the edited headings; field codes are not broken.

- [ ] **Step 4: Update references list**

Keep appropriate general web development sources if present. Remove sources that only relate to the old unrelated topic. Add concise relevant sources only if the document already has a bibliography section:
```text
1. React Documentation. URL: https://react.dev/
2. Vite Documentation. URL: https://vite.dev/
3. TypeScript Documentation. URL: https://www.typescriptlang.org/docs/
4. Tailwind CSS Documentation. URL: https://tailwindcss.com/docs
5. Express Documentation. URL: https://expressjs.com/
6. FastAPI Documentation. URL: https://fastapi.tiangolo.com/
```
Expected: bibliography remains formatted like the sample document and supports the technologies described.

## Task 6: Formatting and Content Verification

**Files:**
- Read: `C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx`

- [ ] **Step 1: Verify DOCX opens structurally**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
out = Path('C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx')
with ZipFile(out) as z:
    bad = z.testzip()
assert bad is None, bad
print('zip structure ok')
PY
```
Expected: `zip structure ok`.

- [ ] **Step 2: Verify formatting-critical XML parts still exist**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
out = Path('C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx')
with ZipFile(out) as z:
    names = set(z.namelist())
for part in ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/settings.xml']:
    assert part in names, part
print('formatting parts present')
PY
```
Expected: `formatting parts present`.

- [ ] **Step 3: Extract edited text and inspect required terms**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
out = Path('C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx')
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(out) as z:
    root = ET.fromstring(z.read('word/document.xml'))
text = '\n'.join(''.join(t.text or '' for t in p.findall('.//w:t', ns)) for p in root.findall('.//w:p', ns))
required = ['Мийу', 'музыкального веб-сервиса', 'React', 'Vite', 'TypeScript']
missing = [s for s in required if s not in text]
assert not missing, missing
print('required terms present')
PY
```
Expected: `required terms present`.

- [ ] **Step 4: Manually inspect in Word or LibreOffice if available**

If LibreOffice is installed, run:
```bash
soffice --headless --convert-to pdf --outdir "C:/Users/Денис/Desktop/miyu/.openclaude-diploma-work" "C:/Users/Денис/Desktop/miyu/Диплом_Клименко_Денис_Мийу_отредактированный.docx"
```
Expected: PDF export succeeds. If `soffice` is not installed, report that XML-level verification passed and visual verification must be done by opening the file in Word.

## Self-Review

- Spec coverage: the plan preserves formatting, uses the current MiYu DOCX as the working file, uses the old DOC only as a reference, writes a separate output copy, updates the diploma topic/content, and verifies the result.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation placeholders remain.
- Type consistency: all scripts use Python standard library, `Path`, `ZipFile`, and the same output path consistently.
