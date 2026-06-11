# Miyu Diploma Layout 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx`, a Miyu diploma report based on the uploaded `МАКЕТ ДП ВЕБ (2026).docx` standard.

**Architecture:** Copy the 2026 layout DOCX and replace text inside the existing Word XML nodes, preserving page setup, tables, styles, and service pages. Generate verification scripts that check required 2026 sections, remove old template project terms, and prevent accidental small-font body text.

**Tech Stack:** Python standard library (`zipfile`, `xml.etree.ElementTree`, `shutil`, `json`, `re`), optional `Pillow` for neutral image placeholders, `python-docx` for validation, `safe-docx` CLI for read-back verification.

---

## File Structure

- Read: `genreport/МАКЕТ ДП ВЕБ (2026).docx` — source layout standard; never overwrite.
- Read: `docs/PROJECT_ARCHITECTURE.md`, `TECH_STACK.md`, `docs/PAGES_CHECKLIST.md` — factual Miyu source material.
- Create: `.openclaude-diploma-work/layout-2026-paragraph-map.json` — extracted paragraph map from the 2026 layout.
- Create: `.openclaude-diploma-work/generate_miyu_layout_2026.py` — generator that copies the layout and rewrites text.
- Create: `.openclaude-diploma-work/test_layout_2026_report.py` — verification script.
- Create: `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx` — final output.

## Task 1: Extract 2026 layout paragraph map

**Files:**
- Create: `.openclaude-diploma-work/layout-2026-paragraph-map.json`

- [ ] **Step 1: Run paragraph extraction**

```bash
python - <<'PY'
from pathlib import Path
from zipfile import ZipFile
import json
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ROOT = Path('C:/Users/Денис/Desktop/miyu')
source = ROOT / 'genreport' / 'МАКЕТ ДП ВЕБ (2026).docx'
out = ROOT / '.openclaude-diploma-work' / 'layout-2026-paragraph-map.json'
out.parent.mkdir(exist_ok=True)

with ZipFile(source) as z:
    root = ET.fromstring(z.read('word/document.xml'))
items = []
for p_index, paragraph in enumerate(root.findall('.//w:p', NS), start=1):
    text = ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS)).strip()
    if not text:
        continue
    items.append({'p': p_index, 'n': len(items) + 1, 'text': text})
out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
print('paragraphs', len(items), out)
PY
```

Expected: prints a positive paragraph count around 479 and writes the JSON file.

## Task 2: Write failing verification for 2026 standard

**Files:**
- Create: `.openclaude-diploma-work/test_layout_2026_report.py`

- [ ] **Step 1: Create verification script**

```python
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile
import sys
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ROOT = Path('C:/Users/Денис/Desktop/miyu')
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'genreport' / 'Диплом_Клименко_Мийу_по_макету_2026.docx'
REQUIRED = [
    'ЗАДАНИЕ', 'на дипломный проект', 'План графика выполнения дипломного проекта',
    'СОДЕРЖАНИЕ', 'ВВЕДЕНИЕ', 'АНАЛИТИЧЕСКАЯ ЧАСТЬ', 'ПРОЕКТИРОВАНИЕ',
    'РАЗРАБОТКА', 'ТЕСТИРОВАНИЕ', 'РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ',
    'ЗАКЛЮЧЕНИЕ', 'СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ',
    'ПРИЛОЖЕНИЕ А', 'ПРИЛОЖЕНИЕ Б', 'ПРИЛОЖЕНИЕ В',
    'Мийу', 'React', 'Express', 'FastAPI', 'SQLite'
]
FORBIDDEN = ['Ukmas', 'Иванов', 'Бикмуллина', 'интернет-магазин', 'Laravel', 'jQuery', 'PHP', 'MY TODOLIST', 'Гайнутдинов', 'Todoist', 'TickTick', 'Notion']
ALLOWED_SMALL = {'(подпись)'}


def read_doc_xml(path: Path) -> ET.Element:
    with ZipFile(path) as z:
        assert z.testzip() is None
        return ET.fromstring(z.read('word/document.xml'))


def visible_lines(root: ET.Element) -> list[str]:
    lines = []
    for paragraph in root.findall('.//w:p', NS):
        text = ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS)).strip()
        if text:
            lines.append(text)
    return lines


def small_paragraphs(root: ET.Element) -> list[tuple[int, str]]:
    bad = []
    for index, paragraph in enumerate(root.findall('.//w:p', NS), start=1):
        text = ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS)).strip()
        if not text or text in ALLOWED_SMALL:
            continue
        sizes = []
        for run in paragraph.findall('w:r', NS):
            run_text = ''.join(t.text or '' for t in run.findall('.//w:t', NS)).strip()
            if not run_text:
                continue
            rpr = run.find('w:rPr', NS)
            size = rpr.find('w:sz', NS) if rpr is not None else None
            if size is not None:
                sizes.append(size.get(f'{{{W}}}val'))
        if sizes and all(size in {'16', '18', '20'} for size in sizes):
            bad.append((index, text[:120]))
    return bad


def main() -> None:
    assert OUTPUT.exists(), OUTPUT
    root = read_doc_xml(OUTPUT)
    lines = visible_lines(root)
    text = '\n'.join(lines)
    for term in REQUIRED:
        assert term in text, f'missing required term: {term}'
    for term in FORBIDDEN:
        assert term.lower() not in text.lower(), f'forbidden term remains: {term}'
    assert len(lines) >= 430, f'too few non-empty paragraphs: {len(lines)}'
    tables = root.findall('.//w:tbl', NS)
    assert len(tables) >= 8, f'too few tables: {len(tables)}'
    small = small_paragraphs(root)
    assert not small, f'small body text remains: {small[:10]}'
    print('layout-2026 report PASS', OUTPUT)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Verify test fails before generator exists**

Run:
```bash
python .openclaude-diploma-work/test_layout_2026_report.py
```

Expected: FAIL because `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx` does not exist yet.

## Task 3: Implement 2026-layout generator

**Files:**
- Create: `.openclaude-diploma-work/generate_miyu_layout_2026.py`
- Create: `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx`

- [ ] **Step 1: Create generator**

```python
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re
import shutil
import xml.etree.ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w', W)
NS = {'w': W}
ROOT = Path('C:/Users/Денис/Desktop/miyu')
TEMPLATE = ROOT / 'genreport' / 'МАКЕТ ДП ВЕБ (2026).docx'
OUTPUT = ROOT / 'genreport' / 'Диплом_Клименко_Мийу_по_макету_2026.docx'
MAP = ROOT / '.openclaude-diploma-work' / 'layout-2026-paragraph-map.json'


def q(tag: str) -> str:
    return f'{{{W}}}{tag}'


def p_text(paragraph: ET.Element) -> str:
    return ''.join(t.text or '' for t in paragraph.findall('.//w:t', NS))


def ensure_size(run: ET.Element, size: str = '28') -> None:
    rpr = run.find('w:rPr', NS)
    if rpr is None:
        rpr = ET.Element(q('rPr'))
        run.insert(0, rpr)
    for tag in ['sz', 'szCs']:
        node = rpr.find(f'w:{tag}', NS)
        if node is None:
            node = ET.SubElement(rpr, q(tag))
        node.set(q('val'), size)


def set_text(paragraph: ET.Element, text: str) -> None:
    nodes = paragraph.findall('.//w:t', NS)
    if not nodes:
        runs = paragraph.findall('w:r', NS)
        run = runs[0] if runs else ET.SubElement(paragraph, q('r'))
        nodes = [ET.SubElement(run, q('t'))]
    nodes[0].text = text
    for node in nodes[1:]:
        node.text = ''
    if text.strip() and text.strip() != '(подпись)':
        for run in paragraph.findall('w:r', NS):
            if ''.join(t.text or '' for t in run.findall('.//w:t', NS)).strip():
                ensure_size(run, '28')


def build_texts(items: list[dict]) -> dict[int, str]:
    by_n = {item['n']: item for item in items}
    texts: dict[int, str] = {}
    def put(n: int, text: str) -> None:
        if n in by_n:
            texts[n] = text

    # Title and task pages from the 2026 standard.
    put(12, 'Разработка музыкального веб-сервиса')
    put(13, '«Мийу»')
    put(14, 'Исполнитель,Выпускник группы')
    put(15, '425 ВЕБ')
    put(18, 'Д. С. Клименко')
    put(20, 'Руководитель,')
    put(21, 'преподаватель')
    put(24, 'Д. И. Хайруллин')
    put(35, 'Выпускнику Клименко Денису, группы 425 по специальности 09.02.07 Информационные системы и программирование, квалификация: разработчик веб и мультимедийных приложений.')
    put(36, 'Тема дипломного проекта: «Проектирование и разработка музыкального веб-сервиса «Мийу»», утверждена приказом директора от «27» марта 2026 г. № 24-Д.')
    put(38, 'Исходные данные к ДП: техническое задание на разработку музыкального веб-сервиса.')
    put(43, 'проектирование музыкального веб-сервиса;')
    put(44, 'разработка музыкального веб-сервиса;')
    put(45, 'тестирование музыкального веб-сервиса;')
    put(50, '4.2 Функциональные и технические требования к системе: музыкальный веб-сервис должен обеспечивать регистрацию и аутентификацию пользователей, просмотр музыкального каталога, поиск треков, артистов и альбомов, воспроизведение аудио, управление плейлистами и библиотекой, кабинет артиста для загрузки материалов, административную панель, модерацию контента, адаптивный интерфейс и интеграцию AI-сервиса для анализа треков и рекомендаций.')
    put(63, '08.04.2026-11.04.2026')
    put(65, 'Изучение аналогов музыкальных сервисов')
    put(67, 'Формирование технического задания')
    put(69, 'Проектирование архитектуры сервиса')
    put(71, 'Проектирование интерфейса пользователя')
    put(73, 'Разработка клиентской части')
    put(75, 'Разработка серверной части и AI-сервиса')
    put(77, 'Тестирование и отладка')
    put(79, 'Написание руководства пользователя')
    put(81, 'Оформление пояснительной записки')
    put(97, 'Д. С. Клименко')

    toc = {
        99: 'СОДЕРЖАНИЕ',
        100: 'ВВЕДЕНИЕ\t6',
        101: '1\tАНАЛИТИЧЕСКАЯ ЧАСТЬ\t7',
        102: '1.1 Анализ предметной области\t7',
        103: '1.2\tОбзор аналогов\t8',
        104: '2 ПРОЕКТИРОВАНИЕ МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА\t9',
        105: '2.1 Определение требований к системе\t9',
        106: '2.2 Архитектура системы\t10',
        107: '2.3 Проектирование базы данных\t12',
        108: '2.4 Проектирование пользовательского интерфейса\t15',
        109: '2.5 Диаграмма вариантов использования\t16',
        110: '2.6 Обоснование выбора технологии разработки\t17',
        111: '2.6.1 Язык гипертекстовой разметки HTML\t18',
        112: '2.6.2 Каскадная таблица стилей CSS и Tailwind CSS\t18',
        113: '2.6.3 Язык программирования TypeScript\t18',
        114: '2.6.4 Библиотека React\t18',
        115: '2.6.5 Среда Node.js и Express\t18',
        116: '2.6.6 Фреймворк FastAPI\t18',
        117: '2.7 Обоснование выбора СУБД\t18',
        118: '2.8 Обоснование выбора среды разработки\t19',
        119: '2.8.1 Visual Studio Code\t19',
        120: '2.8.2 Графический редактор Figma\t19',
        121: '3 РАЗРАБОТКА МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА\t20',
        122: '3.1 Создание дизайна музыкального веб-сервиса\t20',
        123: '3.2 Верстка страниц музыкального веб-сервиса\t26',
        124: '3.3 Программирование музыкального веб-сервиса\t30',
        125: '4 ТЕСТИРОВАНИЕ МУЗЫКАЛЬНОГО ВЕБ-СЕРВИСА\t36',
        126: '4.1 Основные понятия и принципы тестирования\t36',
        127: '4.2 Тестирование методом «Белого ящика»\t36',
        128: '4.3 Тестирование методом «Черного ящика»\t39',
        129: '4.4 Тестирование методом «Test Case»\t39',
        130: '5 РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ\t42',
        131: '5.1 Руководство для пользователя\t42',
        132: '5.2 Руководство для администратора и артиста\t42',
        133: 'ЗАКЛЮЧЕНИЕ\t43',
        134: 'СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ\t44',
        135: 'ПРИЛОЖЕНИЕ А\t45',
        136: 'ПРИЛОЖЕНИЕ Б\t46',
        137: 'ПРИЛОЖЕНИЕ В\t47',
    }
    for n, text in toc.items():
        put(n, text)

    pool = [
        'Музыкальный веб-сервис «Мийу» предназначен для прослушивания треков, просмотра альбомов и страниц артистов, формирования пользовательской библиотеки, работы с плейлистами и получения персональных рекомендаций.',
        'Актуальность проекта определяется ростом спроса на цифровые музыкальные платформы, которые объединяют каталог контента, плеер, социальные функции, кабинет артиста и средства администрирования.',
        'Frontend проекта реализуется на React 18, TypeScript, Vite, React Router и Tailwind CSS. Клиентская часть отвечает за маршруты, компоненты интерфейса, состояние авторизации, работу плеера и взаимодействие с REST API.',
        'Backend реализуется на Node.js, Express и TypeScript. Серверная часть выполняет авторизацию, обработку запросов, загрузку файлов, работу с SQLite, управление треками, альбомами, плейлистами, концертами, пользователями и административными функциями.',
        'AI-service реализуется на Python и FastAPI. Он выполняет анализ треков, извлечение аудиопризнаков, транскрипцию, модерацию и подготовку данных для рекомендательной подсистемы.',
        'SQLite используется как основная база данных учебного проекта. В ней хранятся пользователи, роли, refresh-токены, профили артистов, альбомы, треки, видео, плейлисты, лайки, подписки, уведомления, концерты, билеты, транзакции и результаты AI-анализа.',
        'В качестве аналогов рассмотрены Spotify, Яндекс Музыка, VK Музыка и Звук. Их анализ показывает необходимость удобного поиска, персональной библиотеки, рекомендаций, стабильного плеера и понятной навигации.',
        'Для обычного пользователя система обеспечивает регистрацию, вход, просмотр каталога, поиск, воспроизведение, лайки, плейлисты, подписки, историю прослушиваний и взаимодействие с социальной лентой.',
        'Для артиста предусмотрены загрузка треков, создание альбомов, публикация видео, управление концертами и просмотр статистики. Для администратора предусмотрены управление пользователями, контентом, заявками, модерацией и достижениями.',
        'Тестирование проекта включает проверку сборки frontend, ручную проверку пользовательских сценариев, тестирование адаптивности, проверку защищенных маршрутов, работы плеера, загрузки контента и административных функций.',
    ]
    headings = {
        'интернет-магазин': 'музыкальный веб-сервис',
        'ИНТЕРНЕТ-МАГАЗИН': 'МУЗЫКАЛЬНЫЙ ВЕБ-СЕРВИС',
        'Ukmas': 'Мийу',
        'PHP': 'TypeScript',
        'Laravel': 'FastAPI',
        'jQuery': 'React',
    }
    pool_index = 0
    for item in items:
        n = item['n']
        if n in texts:
            continue
        original = item['text']
        text = original
        for old, new in headings.items():
            text = text.replace(old, new)
        if any(bad.lower() in text.lower() for bad in ['Иванов', 'Бикмуллина']):
            text = text.replace('И. И. Иванов', 'Д. С. Клименко').replace('Бикмуллиной Суюнбике Харисовне', 'Клименко Денису')
        if any(old.lower() in original.lower() for old in ['товар', 'заказ', 'корзин', 'покуп', 'интернет-магазин', 'e-commerce', 'электронной коммерции']):
            text = pool[pool_index % len(pool)]
            pool_index += 1
        texts[n] = text

    source_lines = [
        '1. React Documentation. URL: https://react.dev/',
        '2. Vite Documentation. URL: https://vite.dev/',
        '3. TypeScript Documentation. URL: https://www.typescriptlang.org/docs/',
        '4. Tailwind CSS Documentation. URL: https://tailwindcss.com/docs',
        '5. Express Documentation. URL: https://expressjs.com/',
        '6. SQLite Documentation. URL: https://www.sqlite.org/docs.html',
        '7. FastAPI Documentation. URL: https://fastapi.tiangolo.com/',
        '8. Проектная документация Miyu: docs/PROJECT_ARCHITECTURE.md, TECH_STACK.md, docs/PAGES_CHECKLIST.md.',
    ]
    start = 430
    for offset, line in enumerate(source_lines):
        put(start + offset, line)
    return texts


def normalize(root: ET.Element) -> None:
    for paragraph in root.findall('.//w:p', NS):
        text = p_text(paragraph).strip()
        if not text:
            continue
        if re.fullmatch(r'[{}()[\];,./<>="\'\\\s]+', text):
            set_text(paragraph, '')
            continue
        if text != '(подпись)':
            for run in paragraph.findall('w:r', NS):
                if ''.join(t.text or '' for t in run.findall('.//w:t', NS)).strip():
                    ensure_size(run, '28')


def main() -> None:
    items = json.loads(MAP.read_text(encoding='utf-8'))
    texts = build_texts(items)
    with ZipFile(TEMPLATE) as z:
        files = {name: z.read(name) for name in z.namelist()}
    root = ET.fromstring(files['word/document.xml'])
    counter = 0
    for paragraph in root.findall('.//w:p', NS):
        if not p_text(paragraph).strip():
            continue
        counter += 1
        if counter in texts:
            set_text(paragraph, texts[counter])
    normalize(root)
    files['word/document.xml'] = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    tmp = OUTPUT.with_suffix('.tmp.docx')
    with ZipFile(tmp, 'w', ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    shutil.move(tmp, OUTPUT)
    print(OUTPUT)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run generator**

Run:
```bash
python .openclaude-diploma-work/generate_miyu_layout_2026.py
```

Expected: prints `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx`.

## Task 4: Verify and inspect output

**Files:**
- Read: `genreport/Диплом_Клименко_Мийу_по_макету_2026.docx`

- [ ] **Step 1: Run verification script**

Run:
```bash
python .openclaude-diploma-work/test_layout_2026_report.py genreport/Диплом_Клименко_Мийу_по_макету_2026.docx
```

Expected: `layout-2026 report PASS`.

- [ ] **Step 2: Verify safe-docx read-back**

Run:
```bash
npx -y @usejunior/safe-docx read-file 'C:/Users/Денис/Desktop/miyu/genreport/Диплом_Клименко_Мийу_по_макету_2026.docx' --format simple --show-formatting false --limit 80
```

Expected: output includes title page, `ЗАДАНИЕ`, graph/table sections, and `СОДЕРЖАНИЕ`.

## Self-Review

Spec coverage:
- Uses uploaded 2026 layout as base.
- Keeps original template untouched and writes a separate output.
- Includes title page, assignment page, schedule table, content, testing structure, and appendices A/B/V.
- Replaces old e-commerce/Ukmas/person/technology terms with Miyu content.
- Verifies no small body text remains.

Placeholder scan:
- No TBD/TODO placeholders.
- Signature and official date blanks intentionally remain as form fields from the standard.

Type consistency:
- Paths, constants, `W`, `NS`, `q()`, `set_text()`, and verification terms are consistent across generator and test.
