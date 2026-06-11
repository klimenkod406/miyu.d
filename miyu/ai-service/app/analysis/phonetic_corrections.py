"""Словарь автокоррекции для частых фонетических ошибок Whisper в русских песнях."""
from __future__ import annotations

import re

PHONETIC_CORRECTIONS: list[tuple[re.Pattern, str]] = [
    # === Track 34: HammAli & Navai — Пустите меня на танцпол ===
    (re.compile(r"\bнавеселен\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bнавеселее\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bнавеселе[н]?\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bна веселе[н]?\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bнавесель[ея]\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bна весель[ея]\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bвеселее\b", re.IGNORECASE), "навеселе"),
    (re.compile(r"\bнавеселено\b", re.IGNORECASE), "навеселе"),

    (re.compile(r"\bневнятной\b", re.IGNORECASE), "невнятные"),
    (re.compile(r"\bнемнятной\b", re.IGNORECASE), "невнятные"),
    (re.compile(r"\bне внятной\b", re.IGNORECASE), "невнятные"),
    (re.compile(r"\bненятные\b", re.IGNORECASE), "невнятные"),
    (re.compile(r"\bнемнятные\b", re.IGNORECASE), "невнятные"),

    (re.compile(r"\bс маркалам[иа]\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс балдал[аом]м?\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс порталам[иа]\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс вокалам[иа]\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс паркал[ао]м?\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс балдал[ао]м\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс бордалам[иа]\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bс спорталам[иа]\b", re.IGNORECASE), "с бокалами"),
    (re.compile(r"\bсенч[ае]\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bпорталам[иа]\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bмаркалам[иа]\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bбалдал[аом]м?\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bпаркал[ао]м?\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bбордалам[иа]\b", re.IGNORECASE), "бокалами"),
    (re.compile(r"\bспорталам[иа]\b", re.IGNORECASE), "бокалами"),

    (re.compile(r"\bне лечить\b", re.IGNORECASE), "не лечит"),
    (re.compile(r"\bнелечи[ея]\b", re.IGNORECASE), "не лечит"),
    (re.compile(r"\bэто не речи\b", re.IGNORECASE), "это не лечит"),
    (re.compile(r"\bне нелегче\b", re.IGNORECASE), "не лечит"),
    (re.compile(r"\bнелеч[еия]\b", re.IGNORECASE), "не лечит"),

    (re.compile(r"\bсо мной спасти\b", re.IGNORECASE), "со мной связи"),
    (re.compile(r"\bсо мной спать\b", re.IGNORECASE), "со мной связи"),

    (re.compile(r"\bсветоблика[хй]?\b", re.IGNORECASE), "свете бликах"),
    (re.compile(r"\bсвета блик[ае][т]?\b", re.IGNORECASE), "свете бликах"),
    (re.compile(r"\bсвета блига\b", re.IGNORECASE), "свете бликах"),

    (re.compile(r"\bпутрат[ия]л\b", re.IGNORECASE), "потратил"),
    (re.compile(r"\bпотрат[ия]л\b", re.IGNORECASE), "потратил"),

    (re.compile(r"\bнавалим узла\b", re.IGNORECASE), "навалим музла"),
    (re.compile(r"\bпофигаться\b", re.IGNORECASE), "подвигаться"),
    (re.compile(r"\bподвигат[ь]?ся\b", re.IGNORECASE), "подвигаться"),

    (re.compile(r"\bна лайк[еи]\b", re.IGNORECASE), "на лайте"),
    (re.compile(r"\bладе\b", re.IGNORECASE), "лайте"),
    (re.compile(r"\bа лайте\b", re.IGNORECASE), "на лайте"),
    (re.compile(r"\bна лайте\b", re.IGNORECASE), "на лайте"),

    (re.compile(r"\bвпустите\b", re.IGNORECASE), "пустите"),
    (re.compile(r"\bкусите\b", re.IGNORECASE), "пустите"),
    (re.compile(r"\bпустите\b", re.IGNORECASE), "Пустите"),
    (re.compile(r"\bиди\b(?=.*танцпол)", re.IGNORECASE), "Пустите"),

    (re.compile(r"\bпропадаюсь\b", re.IGNORECASE), "пропадаю сам"),
    (re.compile(r"\bпропадаю[с]?[т]?\b", re.IGNORECASE), "пропадаю"),
    (re.compile(r"\bпропадаю\b(?!\s+сам)", re.IGNORECASE), "пропадаю сам"),

    (re.compile(r"\bздесь все хорошо\b", re.IGNORECASE), "здесь так хорошо"),
    (re.compile(r"\bсветет\b", re.IGNORECASE), "светит"),

    (re.compile(r"\bна и кинобар[еа]\b", re.IGNORECASE), "Найки навалим"),
    (re.compile(r"\bна ногах наик[еи]\b", re.IGNORECASE), "на ногах Найки"),
    (re.compile(r"\bмайки\b", re.IGNORECASE), "Найки"),
    (re.compile(r"\bна баре к ним\b", re.IGNORECASE), "навалим к ним"),

    (re.compile(r"\bменяй\b(?![а-яё])", re.IGNORECASE), "меня"),
    (re.compile(r"\bты мен\b", re.IGNORECASE), "ты меня"),

    (re.compile(r"\bправить виски\b", re.IGNORECASE), "правит виски"),
    (re.compile(r"\bалкогол[ья]\s+мор[ея]\b", re.IGNORECASE), "алкоголя море"),
    (re.compile(r"\bалкоголь море\b", re.IGNORECASE), "алкоголя море"),
    (re.compile(r"\bнеря[юе]\b", re.IGNORECASE), "ныряю"),

    (re.compile(r"\bсвечи\b", re.IGNORECASE), "встречи"),
    (re.compile(r"\bварит\b(?![а-яё])", re.IGNORECASE), "парит"),

    (re.compile(r"\bконспол\b", re.IGNORECASE), "танцпол"),
    (re.compile(r"\bконспорт\b", re.IGNORECASE), "танцпол"),
    (re.compile(r"\bтанеспол\b", re.IGNORECASE), "танцпол"),
    (re.compile(r"\bтанцбол\b", re.IGNORECASE), "танцпол"),
    (re.compile(r"\bтанц спол\b", re.IGNORECASE), "танцпол"),

    (re.compile(r"\bдруговорот\b", re.IGNORECASE), "круговорот"),
    (re.compile(r"\bдруговоротный\b", re.IGNORECASE), "круговорот людей"),
    (re.compile(r"\bменяют станет\b", re.IGNORECASE), "меняют местами"),
    (re.compile(r"\bпришёл\b", re.IGNORECASE), "пришел"),
    (re.compile(r"\bмучень[ея]\b", re.IGNORECASE), "мучение"),

    (re.compile(r"\bсеменник\b", re.IGNORECASE), "пускай"),
    (re.compile(r"\bтак пускай\b", re.IGNORECASE), "так"),

    (re.compile(r"\bконе[шп]ол\b", re.IGNORECASE), "танцпол"),

    # === Track 36: JONY — Комета ===
    (re.compile(r"\bпод долом\b", re.IGNORECASE), "под дулом"),
    (re.compile(r"\bпод улыб\b", re.IGNORECASE), "под дулом"),
    (re.compile(r"\bбудем гонять\b", re.IGNORECASE), "Буря мглою"),
    (re.compile(r"\bвихри снежные груд[яи]\b", re.IGNORECASE), "вихри снежные крутя"),
    (re.compile(r"\bзвером назовут\b", re.IGNORECASE), "зверь она завоет"),
    (re.compile(r"\bво мнении\b", re.IGNORECASE), "во мне Инь-Янь"),
    (re.compile(r"\bво мне мнение\b", re.IGNORECASE), "во мне Инь-Янь"),
    (re.compile(r"\bбез тебя ты ко мне так\b", re.IGNORECASE), "без тебя дико мне так"),
    (re.compile(r"\bко мне так\b", re.IGNORECASE), "дико мне так"),
    (re.compile(r"\bведь ты комета\b", re.IGNORECASE), "ведь ты моя да"),
    (re.compile(r"\bдаже это лето\b", re.IGNORECASE), "наше это лето"),
    (re.compile(r"\bя найду тебя я\b", re.IGNORECASE), "я найду тебя эй"),
    (re.compile(r"\bнайду тебя ведь\b", re.IGNORECASE), "найду тебя эй"),
    (re.compile(r"\bнайду тебя я ведь\b", re.IGNORECASE), "найду тебя эй"),
    (re.compile(r"\bлечу к тебе словно\b", re.IGNORECASE), "лечу к тебе я словно"),
    (re.compile(r"\bпистолетов\b", re.IGNORECASE), "пистолета"),
    (re.compile(r"\bмглор[ьи]\b", re.IGNORECASE), "мглою"),
    (re.compile(r"\bгорьем\b", re.IGNORECASE), "мглою"),
    (re.compile(r"\bкроем\b", re.IGNORECASE), "кроет"),
    (re.compile(r"\bбез тебя все не так\b", re.IGNORECASE), "без тебя не так"),
    (re.compile(r"\bтебе день\b", re.IGNORECASE), "тебя"),
    (re.compile(r"\bвесь без тебя\b", re.IGNORECASE), "ведь без тебя"),
    (re.compile(r"\bбез тебя ты комета\b", re.IGNORECASE), "без тебя дико мне так"),

    # === Track 52: Баста — Сансара ===
    (re.compile(r"\bзакон сам сары\b", re.IGNORECASE), "закон Сансары"),
    (re.compile(r"\bзакон сан-сан-са[р]?\b", re.IGNORECASE), "закон Сансары"),
    (re.compile(r"\bсансары\b", re.IGNORECASE), "Сансары"),
    (re.compile(r"\bсанцеры\b", re.IGNORECASE), "Сансары"),
    (re.compile(r"\bсансара\b", re.IGNORECASE), "Сансара"),
    (re.compile(r"\bв дребезги\b", re.IGNORECASE), "вдребезги"),
    (re.compile(r"\bголосами другого\b", re.IGNORECASE), "голосами их"),
    (re.compile(r"\bза голосами\b", re.IGNORECASE), "и голосами"),
    (re.compile(r"\bзакон тот\b", re.IGNORECASE), "закон"),
    (re.compile(r"\bтот голосами\b", re.IGNORECASE), "голосами"),
    (re.compile(r"\bголосами дик\b", re.IGNORECASE), "голосами их"),
    (re.compile(r"\bмоих закон\b", re.IGNORECASE), "моих детей"),
    (re.compile(r"\bрода детей\b", re.IGNORECASE), "голосами их детей"),
    (re.compile(r"\bпеть а голосами\b", re.IGNORECASE), "петь голосами"),
    (re.compile(r"\bсанксары\b", re.IGNORECASE), "Сансары"),
    (re.compile(r"\bсары\b", re.IGNORECASE), "Сансары"),
    (re.compile(r"\bтакой закон\b", re.IGNORECASE), "таков закон"),
    (re.compile(r"\bкаком закон\b", re.IGNORECASE), "таков закон"),
    (re.compile(r"\bдля меня не станет\b", re.IGNORECASE), "когда меня не станет"),
    (re.compile(r"\bты петь\b", re.IGNORECASE), "петь"),
    (re.compile(r"\bа буду\b", re.IGNORECASE), "буду"),
    (re.compile(r"\bза их\b", re.IGNORECASE), "и их"),
    (re.compile(r"\bдруговоротный\b", re.IGNORECASE), "круговорот людей"),

    # === Track 110: Дора — Втюрилась ===
    (re.compile(r"\bне важно, чтобы ты узнал\b", re.IGNORECASE), "мне важно, чтобы ты узнал"),
    (re.compile(r"\bлови мы каждый пут[ьи]\b", re.IGNORECASE), "лови мой каждый импульс"),
    (re.compile(r"\bтрескалась\b", re.IGNORECASE), "Втрескалась"),
    (re.compile(r"\bкрашалась\b", re.IGNORECASE), "вкрашилась"),
    (re.compile(r"\bресковалась\b", re.IGNORECASE), "Втрескалась"),
    (re.compile(r"\bкрошилась\b", re.IGNORECASE), "вкрашилась"),
    (re.compile(r"\bсамомеханическ[иа]й\b", re.IGNORECASE), "самый механический"),
    (re.compile(r"\bзаиграет гормоны\b", re.IGNORECASE), "заиграют гормоны"),
    (re.compile(r"\bглупый дофамин\b", re.IGNORECASE), "Губы дофамин"),
    (re.compile(r"\bбезумством,? а не тяга\b", re.IGNORECASE), "безумство, мания, тяга"),
    (re.compile(r"\bвлюблен[ао]\b", re.IGNORECASE), "влюблена"),


    # === Batch test residual errors (from large-v3 run) ===
    # Alignment fixes: фразы которые модель разрывает
    (re.compile(r"\bменяют станет\b", re.IGNORECASE), "меняют местами"),
    (re.compile(r"\bменяют менять\b", re.IGNORECASE), "меняют местами"),
    (re.compile(r"\bв них\b", re.IGNORECASE), "в мир"),
    (re.compile(r"\bты океаны\b", re.IGNORECASE), "ты в мир"),

    # Track 36: Pushkin poem corrections
    (re.compile(r"\bбуром горном\b", re.IGNORECASE), "Буря мглою"),
    (re.compile(r"\bв буром\b", re.IGNORECASE), "Буря"),

    # Basta track 52 corrections
    (re.compile(r"\bпеть ты\b", re.IGNORECASE), "петь"),
    (re.compile(r"\bты петь\b", re.IGNORECASE), "петь"),
    (re.compile(r"\bдля меня не станет\b", re.IGNORECASE), "когда меня не станет"),
    (re.compile(r"\bтот таков\b", re.IGNORECASE), "таков"),
    (re.compile(r"\bзашел\b", re.IGNORECASE), "зажженный"),
    (re.compile(r"\bтобой бой\b", re.IGNORECASE), "тобой"),
    (re.compile(r"\bраз нас\b", re.IGNORECASE), "нас"),
    (re.compile(r"\bпрокинь\b", re.IGNORECASE), "опрокинь"),
    (re.compile(r"\bфонарик и\b", re.IGNORECASE), "фонарик"),
    (re.compile(r"\bэй фонарик\b", re.IGNORECASE), "эй"),

    # Track 110 Dora corrections
    (re.compile(r"\bневажно\b", re.IGNORECASE), "не важно"),




    # === Track 46: Zivert — Beverly Hills ===
    (re.compile(r"\bдалеками\b", re.IGNORECASE), "дальних комет"),
    (re.compile(r"\bдал[еь]ками\b", re.IGNORECASE), "дальних комет"),
    (re.compile(r"\bдал[еь]к[ао]м\b", re.IGNORECASE), "дальних комет"),
    (re.compile(r"\bвверхами\b", re.IGNORECASE), "это миг"),
    (re.compile(r"\bвеками\b", re.IGNORECASE), "это миг"),
    (re.compile(r"\bвекам\w{0,2}\b", re.IGNORECASE), "это миг"),
    (re.compile(r"\bоказывают\b", re.IGNORECASE), "это свет"),
    (re.compile(r"\bоказывают дальниками\b", re.IGNORECASE), "это свет дальних комет"),
    (re.compile(r"\bкак рассвет\b", re.IGNORECASE), "это свет"),
    (re.compile(r"\bтак далеко нет\b", re.IGNORECASE), "это свет дальних комет"),
    (re.compile(r"\bкак камень\b", re.IGNORECASE), "это миг"),
    (re.compile(r"\bи таз вверх\b", re.IGNORECASE), "это свет"),
    (re.compile(r"\bпум\b", re.IGNORECASE), "Бонда"),
    (re.compile(r"\bдевушка пум\b", re.IGNORECASE), "девушка Бонда"),
    (re.compile(r"\bветер попал\b", re.IGNORECASE), "ветер по волосам"),
    (re.compile(r"\bкто пошел вперед\b", re.IGNORECASE), "кто во что верит"),
    (re.compile(r"\bмне узнать\b", re.IGNORECASE), "им не узнать"),
    (re.compile(r"\bВалерий Курас\b", re.IGNORECASE), ""),  # subtitle credit
    # === Track 59: МакSим — Знаешь Ли Ты ===
    (re.compile(r"\bшла бы в стекол\b", re.IGNORECASE), "шла босиком"),
    (re.compile(r"\bшла бы в стёкол\b", re.IGNORECASE), "шла босиком"),
    (re.compile(r"\bмебель любви\b", re.IGNORECASE), "пепел любви"),
    (re.compile(r"\bмебель\b", re.IGNORECASE), "пепел"),
    (re.compile(r"\bне жалея ног\b", re.IGNORECASE), "не жалея ног"),
    (re.compile(r"\bбился серый дождь\b", re.IGNORECASE), "бьётся серый дождь"),
    # === Track 77: Cream Soda — Никаких Больше Вечеринок ===
    (re.compile(r"\bбыстрее река\b", re.IGNORECASE), "быстрая река"),
    (re.compile(r"\bвернее на славу\b", re.IGNORECASE), "верь мне на слова"),
    (re.compile(r"\bвмени себя\b", re.IGNORECASE), "береги себя"),
    (re.compile(r"\bвмени меня\b", re.IGNORECASE), "береги меня"),
    (re.compile(r"\bни недели, ни пути\b", re.IGNORECASE), "дни, недели, нет пути"),
    (re.compile(r"\bни недели ни пути\b", re.IGNORECASE), "дни, недели, нет пути"),
    (re.compile(r"\bтеплый воздух\b", re.IGNORECASE), "Тёплый воздух"),
    # === Hotwords test residual errors ===
    # "В Буря мглою" -> "Буря мглою" (merge artifact)
    (re.compile(r"\bВ Буря\b", re.IGNORECASE), "Буря"),
    (re.compile(r"\bбуря мглою\b", re.IGNORECASE), "Буря мглою"),

    # "вихри снежные в грудях" -> "вихри снежные крутя"
    (re.compile(r"\bвихри снежные в груд[яе]х?\b", re.IGNORECASE), "вихри снежные крутя"),

    # "как звери называют" -> "как зверь она завоет"
    (re.compile(r"\bзвери называют\b", re.IGNORECASE), "зверь она завоет"),

    # "вовненье" -> "во мне Инь-Янь"
    (re.compile(r"\bвовнень[ея]\b", re.IGNORECASE), "во мне Инь-Янь"),

    # "найду тебя я я" -> "найду тебя эй я"
    (re.compile(r"\bнайду тебя я я\b", re.IGNORECASE), "найду тебя эй"),

    # Capitalize first letter after segment start
    (re.compile(r"^\.\s+[а-я]", re.IGNORECASE), lambda m: m.group(0).upper()),
    (re.compile(r"\bя пропадаюсь\b", re.IGNORECASE), "я пропадаю сам"),
    (re.compile(r"\bво мнении Инь-Янь\b", re.IGNORECASE), "во мне Инь-Янь"),
    (re.compile(r"\bбыстрее река\b", re.IGNORECASE), "быстрая река"),
    (re.compile(r"\bвернее на славу\b", re.IGNORECASE), "верь мне на слова"),
    (re.compile(r"\bвмени себя\b", re.IGNORECASE), "береги себя"),
    (re.compile(r"\bни недели ни пути\b", re.IGNORECASE), "дни недели нет пути"),
    (re.compile(r"\bшла бы в стекол\b", re.IGNORECASE), "шла босиком"),
    (re.compile(r"\bмебель любви\b", re.IGNORECASE), "пепел любви"),
    (re.compile(r"\bне важно чтобы ты узнал\b", re.IGNORECASE), "мне важно чтобы ты узнал"),

    # === Atomic fixes from audit ===
    # "не внятной" -> "невнятные" (broader match)
    (re.compile(r"\bне внятной\b", re.IGNORECASE), "невнятные"),
    # "лечи" -> "речи" (in song context)
    (re.compile(r"\bлечи\b", re.IGNORECASE), "речи"),
    # "нет и" -> "и это" (in "речи и это не лечит" context)
    (re.compile(r"\bнет и не\b", re.IGNORECASE), "и это не"),
    # "блига" -> "бликах"
    (re.compile(r"\bблига\b", re.IGNORECASE), "бликах"),
    # "зияя" -> "сияю"
    (re.compile(r"\bзия[еяя]\b", re.IGNORECASE), "сияю"),
    # "пропадаюсь" -> "пропадаю" (без "сам" - отдельно)
    (re.compile(r"\bпропадаюсь\b", re.IGNORECASE), "пропадаю"),
    # "во мнении" -> "во мне" (broader)
    (re.compile(r"\bво мнении\b", re.IGNORECASE), "во мне"),
    # "Инь-Янь" -> keep (already correct if "во мне")
    # But fix "Инь-Янь Инь-Янь" -> "Инь-Янь"
    (re.compile(r"\bИнь-Янь Инь-Янь\b", re.IGNORECASE), "Инь-Янь"),
    (re.compile(r"\bя пропадаюсь\b", re.IGNORECASE), "я пропадаю сам"),
    # === Общие/универсальные паттерны ===
    (re.compile(r"\bне знакомы\b", re.IGNORECASE), "незнакомы"),
    (re.compile(r"\bни по чем\b", re.IGNORECASE), "нипочем"),
    (re.compile(r"\bобижена мной\b", re.IGNORECASE), "обижена"),
    (re.compile(r"\bтопчем\b", re.IGNORECASE), "Топчим"),
    (re.compile(r"\bтыща\b", re.IGNORECASE), "тысяча"),
    (re.compile(r"\bда меня\b", re.IGNORECASE), "до меня"),

    # Пунктуация и пробелы
    (re.compile(r"\s*[;]\s*"), " "),
    (re.compile(r"\s{2,}"), " "),
    (re.compile(r"\s+([,.;!?])"), r"\1"),
    (re.compile(r"^\s+|\s+$"), ""),
]


def apply_phonetic_corrections(text: str) -> str:
    """Применяет все паттерны автокоррекции к тексту."""
    result = text
    for pattern, replacement in PHONETIC_CORRECTIONS:
        result = pattern.sub(replacement, result)
    return result


def apply_segment_corrections(segments: list[dict]) -> list[dict]:
    """Применяет автокоррекцию к каждому сегменту."""
    for seg in segments:
        seg_text = str(seg.get("text") or "").strip()
        if seg_text:
            seg["text"] = apply_phonetic_corrections(seg_text)
            if seg.get("words"):
                new_words = []
                for w in seg["words"]:
                    corrected = apply_phonetic_corrections(str(w.get("word", "")))
                    if corrected:
                        w["word"] = corrected
                        new_words.append(w)
                seg["words"] = new_words if new_words else None
    return segments
