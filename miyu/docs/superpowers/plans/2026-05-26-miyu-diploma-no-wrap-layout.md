# Miyu Diploma No-Wrap Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a new DOCX diploma report from `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx` while restoring the first-page and template-sheet manual line breaks from `genreport/МАКЕТ ДП ВЕБ (2026).docx`.

**Architecture:** Work directly at DOCX XML level: copy the current report to a new output, patch only text nodes that affect title/template pages, and preserve all Word styles, tables, section settings, and paragraph properties. Add a focused checker for wrapping-prone first-page text, missing required Miyu terms, and forbidden old-template terms.

**Tech Stack:** Python standard library (`zipfile`, `xml.etree.ElementTree`, `shutil`, `json`, `re`), Safe Docx MCP for read-back inspection, optional `python-docx` only for independent validation.

---

## File Structure

- Read: `genreport/МАКЕТ ДП ВЕБ (2026).docx` — authoritative layout for title pages and template sheets.
- Read: `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx` — source text/content selected by Denis.
- Create: `.openclaude-diploma-work/fix_no_wrap_layout.py` — XML patcher that copies the source report and restores no-wrap/manual-break text.
- Create: `.openclaude-diploma-work/check_no_wrap_layout.py` — validation script for required content and no-wrap first pages.
- Create: `genreport/Диплом_Клименко_Мийу_без_автопереносов.docx` — final output.

## Task 1: Write failing no-wrap validation

**Files:**
- Create: `.openclaude-diploma-work/check_no_wrap_layout.py`

- [ ] **Step 1: Create validation script**

```python
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile
import sys
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ROOT = Path('C:/Users/Денис/Desktop/miyu')
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'genreport' / 'Диплом_Клименко_Мийу_без_автопереносов.docx'
REQUIRED = [
    'Разработка музыкального веб-сервиса',
    '«Мийу»',
    'Клименко Денису',
    'Д. С. Клименко',
    'ЗАДАНИЕ',
    'План графика выполнения дипломного проекта',
    'СОДЕРЖАНИЕ',
    'ВВЕДЕНИЕ',
    'React',
    'Express',
    'FastAPI',
    'SQLite',
]
FORBIDDEN = ['Ukmas', 'И. И. Иванов', 'Бикмуллина', 'управления,информационных', 'Гайнутдинов', 'MY TODOLIST']
NO_WRAP_EXACT = [
    'Министерство цифрового развития государственного управления,\nинформационных технологий и связи Республики Татарстан\nгосударственное автономное профессиональное образовательное учреждение\n«Международный центр компетенций -\nКазанский техникум информационных технологий и связи»',
    'Исполнитель,\nВыпускник группы',
    '\nгосударственное автономное профессиональное образовательное учреждение\n«Международный центр компетенций –',
    'Казанский техникум информационных технологий и связи»',
]
SHORT_TITLE_LINES = ['Разработка музыкального веб-сервиса', '«Мийу»']


def root_from_docx(path: Path) -> ET.Element:
    assert path.exists(), f'missing output: {path}'
    with ZipFile(path) as zf:
        assert zf.testzip() is None
        return ET.fromstring(zf.read('word/document.xml'))


def paragraph_texts(root: ET.Element) -> list[str]:
    texts = []
    for paragraph in root.findall('.//w:p', NS):
        text = ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS))
        if text.strip():
            texts.append(text)
    return texts


def main() -> None:
    root = root_from_docx(OUTPUT)
    paragraphs = paragraph_texts(root)
    all_text = '\n'.join(paragraphs)

    for term in REQUIRED:
        assert term in all_text, f'missing required term: {term}'
    for term in FORBIDDEN:
        assert term.lower() not in all_text.lower(), f'forbidden term remains: {term}'
    for exact in NO_WRAP_EXACT:
        assert exact in paragraphs, f'manual-break paragraph missing or changed: {exact!r}'
    for title in SHORT_TITLE_LINES:
        assert title in paragraphs, f'title line must stay as its own short paragraph: {title}'

    assert all('управления,информационных' not in p for p in paragraphs[:60])
    assert len(paragraphs) >= 430, f'too few non-empty paragraphs: {len(paragraphs)}'
    assert len(root.findall('.//w:tbl', NS)) >= 8
    print('no-wrap layout PASS', OUTPUT)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run test to verify it fails before output exists**

Run:
```bash
python .openclaude-diploma-work/check_no_wrap_layout.py
```

Expected: FAIL with `missing output` for `genreport/Диплом_Клименко_Мийу_без_автопереносов.docx`.

## Task 2: Implement no-wrap XML patcher

**Files:**
- Create: `.openclaude-diploma-work/fix_no_wrap_layout.py`
- Create: `genreport/Диплом_Клименко_Мийу_без_автопереносов.docx`

- [ ] **Step 1: Create patcher**

```python
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w', W)
NS = {'w': W}
ROOT = Path('C:/Users/Денис/Desktop/miyu')
SOURCE = ROOT / 'genreport' / 'Диплом_Клименко_Мийу_по_макету_2026.docx'
OUTPUT = ROOT / 'genreport' / 'Диплом_Клименко_Мийу_без_автопереносов.docx'


def q(tag: str) -> str:
    return f'{{{W}}}{tag}'


def paragraph_text(paragraph: ET.Element) -> str:
    return ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS))


def set_paragraph_text(paragraph: ET.Element, text: str) -> None:
    runs = paragraph.findall('w:r', NS)
    if not runs:
        runs = [ET.SubElement(paragraph, q('r'))]
    text_nodes = paragraph.findall('.//w:t', NS)
    if not text_nodes:
        text_nodes = [ET.SubElement(runs[0], q('t'))]
    text_nodes[0].text = text
    if text.startswith(' ') or text.endswith(' ') or '\n' in text:
        text_nodes[0].set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    for node in text_nodes[1:]:
        node.text = ''


def replace_exact(paragraphs: list[ET.Element], old: str, new: str) -> int:
    count = 0
    for paragraph in paragraphs:
        if paragraph_text(paragraph) == old:
            set_paragraph_text(paragraph, new)
            count += 1
    return count


def replace_contains_once(paragraphs: list[ET.Element], needle: str, new: str) -> None:
    for paragraph in paragraphs:
        if needle in paragraph_text(paragraph):
            set_paragraph_text(paragraph, new)
            return
    raise RuntimeError(f'paragraph not found: {needle}')


def main() -> None:
    with ZipFile(SOURCE) as zf:
        files = {name: zf.read(name) for name in zf.namelist()}
    root = ET.fromstring(files['word/document.xml'])
    paragraphs = root.findall('.//w:p', NS)

    replace_contains_once(
        paragraphs,
        'Министерство цифрового развития государственного управления',
        'Министерство цифрового развития государственного управления,\nинформационных технологий и связи Республики Татарстан\nгосударственное автономное профессиональное образовательное учреждение\n«Международный центр компетенций -\nКазанский техникум информационных технологий и связи»',
    )
    replace_exact(paragraphs, 'Исполнитель,Выпускник группы', 'Исполнитель,\nВыпускник группы')
    replace_exact(paragraphs, '425 ВЕБ', '425 ВЕБ')
    replace_exact(paragraphs, 'Разработка музыкального веб-сервиса', 'Разработка музыкального веб-сервиса')
    replace_exact(paragraphs, '«Мийу»', '«Мийу»')
    replace_contains_once(
        paragraphs,
        'государственное автономное профессиональное образовательное учреждение«Международный центр компетенций',
        '\nгосударственное автономное профессиональное образовательное учреждение\n«Международный центр компетенций –',
    )
    replace_exact(paragraphs, 'Казанский техникум информационных технологий и связи»', 'Казанский техникум информационных технологий и связи»')

    text_replacements = {
        'управления,информационных': 'управления,\nинформационных',
        'учреждение«Международный': 'учреждение\n«Международный',
        '425 ВЕБ': '425 ВЕБ',
        'Руководитель,Руководитель,': 'Руководитель,',
    }
    for paragraph in paragraphs:
        text = paragraph_text(paragraph)
        new_text = text
        for old, new in text_replacements.items():
            new_text = new_text.replace(old, new)
        if new_text != text:
            set_paragraph_text(paragraph, new_text)

    files['word/document.xml'] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    tmp = OUTPUT.with_suffix('.tmp.docx')
    with ZipFile(tmp, 'w', ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    shutil.move(tmp, OUTPUT)
    print(OUTPUT)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run patcher**

Run:
```bash
python .openclaude-diploma-work/fix_no_wrap_layout.py
```

Expected: prints `C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_Мийу_без_автопереносов.docx`.

## Task 3: Verify generated DOCX

**Files:**
- Read: `genreport/Диплом_Клименко_Мийу_без_автопереносов.docx`

- [ ] **Step 1: Run no-wrap checker**

Run:
```bash
python .openclaude-diploma-work/check_no_wrap_layout.py genreport/Диплом_Клименко_Мийу_без_автопереносов.docx
```

Expected: `no-wrap layout PASS`.

- [ ] **Step 2: Inspect first 60 paragraphs with Safe Docx**

Use Safe Docx read-back for the new output and inspect paragraphs 1-60.

Expected: first ministry block has manual line breaks; theme is split into `Разработка музыкального веб-сервиса` and `«Мийу»`; executor cell has `Исполнитель,` and `Выпускник группы` on separate lines; second template header has the same manual break pattern as the maket.

- [ ] **Step 3: Compare against maket first-page strings**

Run:
```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS={'w':W}
root=Path('C:/Users/Денис/Desktop/miyu')
out=root/'genreport'/'Диплом_Клименко_Мийу_без_автопереносов.docx'
with ZipFile(out) as z:
    doc=ET.fromstring(z.read('word/document.xml'))
texts=[''.join(t.text or '' for t in p.findall('.//w:t',NS)) for p in doc.findall('.//w:p',NS)]
for i,text in enumerate([t for t in texts if t.strip()][:45],1):
    print(f'{i}: {text!r}')
PY
```

Expected: printed first paragraphs include explicit `\n` in the same service/header blocks as the maket and no `управления,информационных` substring.

## Self-Review

Spec coverage:
- Uses file 3 as the source text.
- Keeps `МАКЕТ ДП ВЕБ (2026).docx` as the layout authority.
- Preserves source and maket files by writing a separate output.
- Focuses specifically on preventing automatic wrapping on title/template pages.
- Checks first pages for glued strings and manual line breaks.

Placeholder scan:
- No TODO/TBD placeholders.
- Official signature/date blanks remain intentionally because they are part of the diploma form.

Type consistency:
- `SOURCE`, `OUTPUT`, `check_no_wrap_layout.py`, and expected output path all reference `Диплом_Клименко_Мийу_без_автопереносов.docx`.
- XML namespace helpers are consistent between patcher and checker.
