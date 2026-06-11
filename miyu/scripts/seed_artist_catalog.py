from __future__ import annotations

import re
import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "database" / "miyu.db"

TRANSLIT_MAP = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya", "і": "i", "ї": "yi", "є": "ie", "ґ": "g", "қ": "k", "ң": "ng", "ү": "u",
    "ұ": "u", "һ": "h", "ә": "a", "ө": "o",
})

ARTIST_GROUPS: dict[str, list[str]] = {
    "pop_modern": [
        "МакSим", "Zivert", "ANNA ASTI", "Artik & Asti", "JONY", "HammAli & Navai", "Егор Крид", "Мот",
        "Miyagi", "Andy Panda", "Скриптонит", "Баста", "MACAN", "A.V.G", "Jakone", "INSTASAMKA",
        "Клава Кока", "NILETTO", "Дора", "Мари Краймбрери", "Люся Чеботина", "Gayazovs Brothers",
        "Ramil’", "Xolidayboy", "Amirchik", "Элджей", "Feduk", "Pharaoh", "Slava Marlow", "Моргенштерн",
        "OG Buda", "Big Baby Tape", "Bushido Zho", "Soda Luv", "OBLADAET", "THRILL PILL", "Toxi$",
        "MAYOT", "SEEMEE", "Yanix", "LOVV66", "Friendly Thug 52 NGG", "Saluki", "CMH", "GONE.Fludd",
        "Heronwater", "Lida", "Mary Gu", "polnalyubvi", "Асия", "Тося Чайкина", "Три дня дождя",
        "MIA BOYKA", "IOWA", "MONA", "Ольга Серябкина", "Ханна", "Юлианна Караулова", "Ваня Дмитриенко",
        "Dabro", "Filatov & Karas", "Burito", "Звонкий", "Bahh Tee", "ELMAN", "Andro", "Idris & Leos",
        "Akmal’", "Kamazz", "Gafur", "Jah Khalib", "The Limba", "Dose", "CAPTOWN", "Truwer",
        "Каспийский груз", "Мэвл", "Rauf & Faik", "Моя Мишель", "Анет Сай", "JANAGA", "VAVAN",
        "Konfuz", "escape", "Нюша", "Елка", "PIZZA", "RSAC", "Cream Soda", "Tesla Boy",
        "Мальбэк и Сюзанна", "SEREBRO", "t.A.T.u.", "Время и Стекло", "Quest Pistols", "MOZGI",
        "Open Kids", "KAZKA", "MONATIK", "Alekseev", "Макс Барских", "Вера Брежнева", "Loboda",
        "Потап и Настя", "NK", "Океан Ельзи", "Бумбокс", "The Hardkiss", "Артем Пивоваров",
        "DOROFEEVA", "Melovin", "Ivan NAVI", "Pianoбой", "Антитела", "ТНМК", "5’nizza", "Сергей Бабкин",
        "Скрябін", "Джамала", "Тіна Кароль", "Ірина Білик", "Оля Полякова", "Руслана", "A’Studio",
        "Батырхан Шукенов",
    ],
    "regional_alt": [
        "Димаш Кудайберген", "Кайрат Нуртас", "Moldanazar", "Ninety One", "Dequine", "Yenlik", "M’Dee",
        "Hiro", "АИГЕЛ", "IC3PEAK", "Shortparis", "Noize MC", "Oxxxymiron", "ATL", "Хаски", "Кравц",
        "ST", "L’One", "Тимати", "Джиган", "T-Killah", "Серега", "Dino MC47", "Градусы", "Uma2rman",
    ],
    "legacy_25_plus": [
        "Би-2", "Сплин", "Звери", "Мумий Тролль", "Земфира", "Ленинград", "Агата Кристи", "Чайф",
        "Смысловые Галлюцинации", "Танцы Минус", "Ночные Снайперы", "Brainstorm", "Animal ДжаZ",
        "Король и Шут", "Кино", "ДДТ", "Nautilus Pompilius", "Ария", "Алиса", "Машина времени",
        "Воскресение", "Аквариум", "Пикник", "Руки Вверх!", "Иванушки International", "Отпетые мошенники",
        "Дискотека Авария", "Hi‑Fi", "Smash!!", "Вирус", "Demo", "Гости из будущего", "Блестящие",
        "Фабрика", "ВИА Гра", "Reflex", "5sta Family", "Банд’Эрос", "Челси", "Корни", "Премьер-министр",
        "На-На", "Комбинация", "Кар-Мэн", "Ласковый май", "Мираж", "Технология", "Любэ", "Линда",
        "Андрей Губин",
    ],
    "classic": [
        "Алла Пугачева", "София Ротару", "Валерий Леонтьев", "Филипп Киркоров", "Николай Басков",
        "Григорий Лепс", "Стас Михайлов", "Ирина Аллегрова", "Лев Лещенко", "Иосиф Кобзон", "Михаил Круг",
        "Любовь Успенская", "Надежда Кадышева", "Александр Серов", "Игорь Николаев", "Ирина Дубцова",
        "Валерия", "Ани Лорак", "Наташа Королёва", "Лолита", "Татьяна Буланова", "Кристина Орбакайте",
        "Александр Буйнов", "Юрий Антонов", "Олег Газманов", "Владимир Пресняков", "Леонид Агутин",
        "Анжелика Варум", "Дмитрий Маликов", "Сосо Павлиашвили", "Михаил Шуфутинский", "Александр Розенбаум",
        "Валерий Меладзе", "Emin", "Авраам Руссо", "Слава", "Жасмин", "Анита Цой", "Натали", "Шура",
        "Влад Сташевский", "Женя Белоусов", "Кай Метов", "Игорь Саруханов", "Мурат Насыров",
        "Ирина Салтыкова", "Вика Цыганова", "Андрей Державин", "Александр Маршал", "Сергей Пенкин",
    ],
    "world": [
        "Michael Jackson", "Madonna", "Queen", "The Beatles", "ABBA", "Elvis Presley", "Whitney Houston",
        "Celine Dion", "Bryan Adams", "Bon Jovi", "Scorpions", "Modern Talking", "Roxette", "Ace of Base",
        "Dr. Alban", "Haddaway", "Corona", "Eiffel 65", "Los del Río", "Shakira", "Ricky Martin",
        "Jennifer Lopez", "Britney Spears", "Christina Aguilera", "Lady Gaga", "Rihanna", "Beyoncé", "Adele",
        "Sia", "Dua Lipa", "Ed Sheeran", "Justin Timberlake", "Justin Bieber", "Bruno Mars", "The Weeknd",
        "Imagine Dragons", "Coldplay", "Maroon 5", "Linkin Park", "Eminem", "50 Cent", "Dr. Dre",
        "Black Eyed Peas", "Pharrell Williams", "Daft Punk", "David Guetta", "Avicii", "PSY", "Luis Fonsi",
        "Daddy Yankee",
    ],
}

GROUP_META = {
    "pop_modern": {"genre": "Поп", "country": "Россия/СНГ", "verified": 1},
    "regional_alt": {"genre": "Альтернатива", "country": "СНГ", "verified": 1},
    "legacy_25_plus": {"genre": "Рок/Поп", "country": "Россия/СНГ", "verified": 1},
    "classic": {"genre": "Эстрада", "country": "Россия/СНГ", "verified": 1},
    "world": {"genre": "International", "country": "International", "verified": 1},
}

CONCERT_ARTISTS = [
    "МакSим", "Zivert", "ANNA ASTI", "Егор Крид", "Баста", "Клава Кока", "Три дня дождя", "MONATIK",
    "Димаш Кудайберген", "Noize MC", "Би-2", "Звери", "Король и Шут", "Руки Вверх!", "Любэ",
    "Григорий Лепс", "Алла Пугачева", "Валерий Меладзе", "Michael Jackson", "Coldplay",
]

VENUES = [
    ("Лужники", "Москва", "Россия", "Лужнецкая набережная, 24", "stadium"),
    ("VK Stadium", "Москва", "Россия", "Ленинградский проспект, 80 к17", "arena"),
    ("Газпром Арена", "Санкт-Петербург", "Россия", "Футбольная аллея, 1", "stadium"),
    ("Minsk Arena", "Минск", "Беларусь", "пр. Победителей, 111", "arena"),
    ("Алматы Арена", "Алматы", "Казахстан", "мкр. Нуркент, 7", "arena"),
]

TICKET_PRESETS = [
    [("VIP", 15000, 300, "vip"), ("Фан-зона", 7000, 2500, "fan"), ("Трибуна", 3500, 5000, "stand")],
    [("Партер", 9000, 800, "parterre"), ("Танцпол", 5000, 2200, "floor"), ("Балкон", 2800, 900, "balcony")],
    [("Meet & Greet", 20000, 120, "meet"), ("Premium", 10000, 600, "premium"), ("Standard", 4500, 3000, "standard")],
]


def slugify(value: str) -> str:
    value = value.lower()
    value = value.translate(TRANSLIT_MAP)
    value = re.sub(r"[^a-z0-9'&+]+", "-", value, flags=re.IGNORECASE)
    value = value.strip("-")
    if not value:
        return "artist"
    return value[:48]


def unique_email(name: str, index: int) -> str:
    base = slugify(name).replace("'", "").replace("&", "and")
    return f"artist{index:03d}-{base}@miyu.local"


def concert_payloads(artist_ids: dict[str, int]) -> list[dict]:
    payloads = []
    for idx, artist_name in enumerate(CONCERT_ARTISTS, start=1):
        venue, city, country, address, venue_plan = VENUES[(idx - 1) % len(VENUES)]
        ticket_types = TICKET_PRESETS[(idx - 1) % len(TICKET_PRESETS)]
        total = sum(item[2] for item in ticket_types)
        payloads.append({
            "artist_id": artist_ids[artist_name],
            "title": f"{artist_name} Live {2026 + (idx % 2)}",
            "description": f"Большой концерт {artist_name} с хитами, премьерой новых треков и полноценным live-шоу.",
            "venue": venue,
            "city": city,
            "country": country,
            "address": address,
            "event_date": f"2026-{(idx % 12) + 1:02d}-{(idx * 2 % 27) + 1:02d}",
            "event_time": f"{18 + (idx % 4):02d}:00",
            "cover_url": None,
            "status": "available",
            "is_in_banner": 1 if idx <= 6 else 0,
            "venue_plan_id": venue_plan,
            "total_seats": total,
            "available_seats": total,
            "ticket_types": ticket_types,
        })
    return payloads


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    password_hash_row = cur.execute(
        "SELECT password_hash FROM users WHERE role = 'artist' ORDER BY id LIMIT 1"
    ).fetchone()
    if not password_hash_row:
        raise RuntimeError("No existing artist password hash found in database")
    password_hash = password_hash_row[0]

    all_artists: list[tuple[str, str]] = []
    for group, names in ARTIST_GROUPS.items():
        for name in names:
            all_artists.append((group, name))

    artist_ids: dict[str, int] = {}
    inserted_artists = 0
    for index, (group, name) in enumerate(all_artists, start=1):
        email = unique_email(name, index)
        meta = GROUP_META[group]
        bio = f"{name} — артист каталога Miyu ({meta['country']})."

        cur.execute(
            """
            INSERT OR IGNORE INTO users (email, username, password_hash, role, bio, is_verified)
            VALUES (?, ?, ?, 'artist', ?, ?)
            """,
            (email, name, password_hash, bio, meta["verified"]),
        )

        if cur.rowcount > 0:
            inserted_artists += 1

        user_id = cur.execute("SELECT id FROM users WHERE username = ?", (name,)).fetchone()[0]
        artist_ids[name] = user_id

        cur.execute(
            """
            INSERT INTO artist_profiles (user_id, stage_name, genre, country, verified_at)
            VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
            ON CONFLICT(user_id) DO UPDATE SET
              stage_name = excluded.stage_name,
              genre = excluded.genre,
              country = excluded.country,
              verified_at = CASE WHEN ? = 1 THEN COALESCE(artist_profiles.verified_at, CURRENT_TIMESTAMP) ELSE artist_profiles.verified_at END
            """,
            (user_id, name, meta["genre"], meta["country"], meta["verified"], meta["verified"]),
        )

    inserted_concerts = 0
    for concert in concert_payloads(artist_ids):
        existing = cur.execute(
            "SELECT id FROM concerts WHERE artist_id = ? AND title = ? AND event_date = ?",
            (concert["artist_id"], concert["title"], concert["event_date"]),
        ).fetchone()
        if existing:
            concert_id = existing[0]
        else:
            cur.execute(
                """
                INSERT INTO concerts (
                    artist_id, title, description, venue, city, country, address,
                    event_date, event_time, cover_url, total_seats, available_seats,
                    status, is_in_banner, venue_plan_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    concert["artist_id"], concert["title"], concert["description"], concert["venue"], concert["city"],
                    concert["country"], concert["address"], concert["event_date"], concert["event_time"], concert["cover_url"],
                    concert["total_seats"], concert["available_seats"], concert["status"], concert["is_in_banner"], concert["venue_plan_id"],
                ),
            )
            concert_id = cur.lastrowid
            inserted_concerts += 1

        for name, price, quantity, zone_id in concert["ticket_types"]:
            cur.execute(
                """
                INSERT OR IGNORE INTO ticket_types (concert_id, name, price, quantity, zone_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (concert_id, name, price, quantity, zone_id),
            )

    conn.commit()

    artist_total = cur.execute("SELECT COUNT(*) FROM users WHERE role = 'artist'").fetchone()[0]
    concert_total = cur.execute("SELECT COUNT(*) FROM concerts").fetchone()[0]

    print(f"Inserted new artists: {inserted_artists}")
    print(f"Total artists in DB: {artist_total}")
    print(f"Inserted new concerts: {inserted_concerts}")
    print(f"Total concerts in DB: {concert_total}")

    conn.close()


if __name__ == "__main__":
    main()
