import { runQuery, getOne } from '../db';

async function seedConcerts() {
  try {
    console.log('Seeding test concerts...');

    // Get artist user
    const artist = await getOne<{ id: number }>("SELECT id FROM users WHERE role = 'artist' LIMIT 1");
    if (!artist) {
      console.error('No artist found. Please create an artist user first.');
      process.exit(1);
    }

    const concerts = [
      {
        artist_id: artist.id,
        title: 'Летний фестиваль 2026',
        description: 'Грандиозное музыкальное событие лета! Лучшие хиты и новые треки в исполнении живого оркестра.',
        venue: 'Лужники',
        city: 'Москва',
        country: 'Россия',
        address: 'Лужнецкая набережная, 24',
        event_date: '2026-07-15',
        event_time: '19:00',
        cover_url: null,
        venue_plan_id: 'stadium',
        status: 'available',
        total_seats: 44500,
        available_seats: 44500,
        ticket_types: [
          { name: 'VIP зона', price: 15000, quantity: 500, zone_id: 'vip' },
          { name: 'Фан-зона', price: 8000, quantity: 5000, zone_id: 'fan-zone' },
          { name: 'Трибуна Север', price: 5000, quantity: 15000, zone_id: 'tribune-north' },
          { name: 'Трибуна Юг', price: 5000, quantity: 15000, zone_id: 'tribune-south' },
          { name: 'Трибуна Запад', price: 3500, quantity: 7000, zone_id: 'tribune-west' },
          { name: 'Трибуна Восток', price: 3500, quantity: 2000, zone_id: 'tribune-east' }
        ]
      },
      {
        artist_id: artist.id,
        title: 'Акустический вечер',
        description: 'Камерный концерт в уютной атмосфере. Только живой звук, душевные песни и близкий контакт с артистом.',
        venue: 'Клуб 16 Тонн',
        city: 'Москва',
        country: 'Россия',
        address: 'ул. Пресненский Вал, 6, стр. 1',
        event_date: '2026-05-20',
        event_time: '20:00',
        cover_url: null,
        venue_plan_id: 'club',
        status: 'available',
        total_seats: 1500,
        available_seats: 1500,
        ticket_types: [
          { name: 'У сцены', price: 5000, quantity: 300, zone_id: 'stage-front' },
          { name: 'Танцпол', price: 3500, quantity: 800, zone_id: 'dance-floor' },
          { name: 'Балкон', price: 2500, quantity: 200, zone_id: 'balcony' },
          { name: 'Барная зона', price: 2000, quantity: 200, zone_id: 'bar-area' }
        ]
      },
      {
        artist_id: artist.id,
        title: 'Arena Tour 2026',
        description: 'Масштабное шоу с потрясающими спецэффектами, лазерами и пиротехникой. Незабываемое зрелище!',
        venue: 'ВТБ Арена',
        city: 'Москва',
        country: 'Россия',
        address: 'Ленинградский проспект, 39, стр. 79',
        event_date: '2026-09-10',
        event_time: '19:30',
        cover_url: null,
        venue_plan_id: 'arena',
        status: 'available',
        total_seats: 17000,
        available_seats: 17000,
        ticket_types: [
          { name: 'Золотой круг', price: 12000, quantity: 1000, zone_id: 'golden-circle' },
          { name: 'Партер', price: 8000, quantity: 3000, zone_id: 'parterre' },
          { name: 'Сектор A', price: 5000, quantity: 4000, zone_id: 'sector-a' },
          { name: 'Сектор B', price: 5000, quantity: 3000, zone_id: 'sector-b' },
          { name: 'Сектор C', price: 4000, quantity: 3000, zone_id: 'sector-c' },
          { name: 'Сектор D', price: 4000, quantity: 3000, zone_id: 'sector-d' }
        ]
      },
      {
        artist_id: artist.id,
        title: 'Open Air Festival',
        description: 'Летний фестиваль под открытым небом. Отличная музыка, свежий воздух и незабываемая атмосфера!',
        venue: 'Парк Горького',
        city: 'Москва',
        country: 'Россия',
        address: 'Крымский Вал, 9',
        event_date: '2026-06-25',
        event_time: '18:00',
        cover_url: null,
        venue_plan_id: 'open-air',
        status: 'available',
        total_seats: 10000,
        available_seats: 10000,
        ticket_types: [
          { name: 'VIP лаунж', price: 10000, quantity: 500, zone_id: 'vip-lounge' },
          { name: 'Передняя зона', price: 6000, quantity: 2500, zone_id: 'front-zone' },
          { name: 'Общая зона', price: 4000, quantity: 5000, zone_id: 'general-admission' },
          { name: 'Газон', price: 2500, quantity: 2000, zone_id: 'lawn' }
        ]
      },
      {
        artist_id: artist.id,
        title: 'Новогодний концерт',
        description: 'Встречаем Новый Год вместе! Праздничная программа, фейерверк и море позитива!',
        venue: 'Олимпийский',
        city: 'Москва',
        country: 'Россия',
        address: 'Олимпийский проспект, 16',
        event_date: '2026-12-31',
        event_time: '22:00',
        cover_url: null,
        venue_plan_id: 'arena',
        status: 'available',
        total_seats: 18000,
        available_seats: 18000,
        ticket_types: [
          { name: 'Золотой круг', price: 20000, quantity: 1000, zone_id: 'golden-circle' },
          { name: 'Партер', price: 15000, quantity: 3000, zone_id: 'parterre' },
          { name: 'Сектор A', price: 10000, quantity: 4000, zone_id: 'sector-a' },
          { name: 'Сектор B', price: 10000, quantity: 4000, zone_id: 'sector-b' },
          { name: 'Сектор C', price: 8000, quantity: 3000, zone_id: 'sector-c' },
          { name: 'Сектор D', price: 8000, quantity: 3000, zone_id: 'sector-d' }
        ]
      }
    ];

    for (const concert of concerts) {
      const { ticket_types, ...concertData } = concert;

      // Insert concert
      const result = await runQuery(`
        INSERT INTO concerts (
          artist_id, title, description, venue, city, country, address,
          event_date, event_time, cover_url, venue_plan_id, status,
          total_seats, available_seats
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        concertData.artist_id,
        concertData.title,
        concertData.description,
        concertData.venue,
        concertData.city,
        concertData.country,
        concertData.address,
        concertData.event_date,
        concertData.event_time,
        concertData.cover_url,
        concertData.venue_plan_id,
        concertData.status,
        concertData.total_seats,
        concertData.available_seats
      ]);

      const concertId = result.lastID;

      // Insert ticket types
      for (const ticketType of ticket_types) {
        await runQuery(`
          INSERT INTO ticket_types (concert_id, name, price, quantity, zone_id)
          VALUES (?, ?, ?, ?, ?)
        `, [concertId, ticketType.name, ticketType.price, ticketType.quantity, ticketType.zone_id]);
      }

      console.log(`✓ Created concert: ${concertData.title}`);
    }

    console.log('All test concerts created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding concerts:', error);
    process.exit(1);
  }
}

seedConcerts();
