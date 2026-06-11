
import express, { Request } from 'express';
import QRCode from 'qrcode';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getAll, getOne, runQuery } from '../db';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), 'uploads/concerts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, uploadDir),
  filename: (_req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('/uploads/')) return url;
  return `/uploads/concerts/${url}`;
}

// Helper: load co-artists for a list of concert ids → Map<concertId, Artist[]>
async function loadCoArtistsMap(concertIds: number[]): Promise<Map<number, any[]>> {
  const map = new Map<number, any[]>();
  if (concertIds.length === 0) return map;
  const placeholders = concertIds.map(() => '?').join(',');
  const rows = await getAll<any>(
    `SELECT ca.concert_id, u.id, u.username, u.avatar_url
     FROM concert_artists ca
     JOIN users u ON ca.artist_id = u.id
     WHERE ca.concert_id IN (${placeholders})`,
    concertIds
  );
  for (const r of rows) {
    const list = map.get(r.concert_id) || [];
    list.push({ id: r.id, name: r.username, avatar_url: r.avatar_url });
    map.set(r.concert_id, list);
  }
  return map;
}

// GET /api/concerts - Get all concerts
router.get('/', async (_req, res) => {
  try {
    const concerts = await getAll<any>(`
      SELECT
        c.id, c.title, c.description, c.venue, c.city, c.country, c.address,
        c.event_date as datetime, c.event_time as time, c.cover_url,
        c.total_seats, c.available_seats, c.status, c.is_in_banner, c.venue_plan_id,
        json_object('id', u.id, 'name', u.username, 'avatar_url', u.avatar_url) as artist
      FROM concerts c
      JOIN users u ON c.artist_id = u.id
      WHERE c.status NOT IN ('pending', 'cancelled', 'rejected')
      ORDER BY c.event_date DESC
    `);
    const ticketTypes = await getAll<any>(`
      SELECT id, concert_id, name, price, quantity, sold, zone_id FROM ticket_types
    `);
    const coArtistsMap = await loadCoArtistsMap(concerts.map(c => c.id));
    const concertsWithTickets = concerts.map(concert => {
      const relatedTicketTypes = ticketTypes
        .filter(tt => tt.concert_id === concert.id)
        .map(tt => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          available: tt.quantity - tt.sold,
          zone_id: tt.zone_id
        }));
      let frontendStatus: 'available' | 'soon' | 'soldout' = 'available';
      if (concert.status === 'soldout' || concert.available_seats <= 0) {
        frontendStatus = 'soldout';
      } else if (new Date(concert.datetime) > new Date()) {
        frontendStatus = 'soon';
      }
      if (concert.status === 'available') {
        frontendStatus = 'available'
      }
      const primaryArtist = JSON.parse(concert.artist);
      const coArtists = coArtistsMap.get(concert.id) || [];
      return {
        ...concert,
        cover_url: normalizeCoverUrl(concert.cover_url),
        artist: primaryArtist,
        artists: [primaryArtist, ...coArtists],
        tickets: relatedTicketTypes,
        date: new Date(concert.datetime).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        status: frontendStatus
      };
    });
    res.json(concertsWithTickets);
  } catch (error) {
    console.error('Get concerts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/concerts/banner - Get all concerts in the banner
router.get('/banner', async (_req, res) => {
  try {
    const bannerConcerts = await getAll<any>(`
      SELECT
        c.id, c.title, c.venue, c.city, c.event_date as datetime, c.event_time as time, c.cover_url, c.status,
        c.available_seats,
        json_object('id', u.id, 'name', u.username) as artist
      FROM concerts c
      JOIN users u ON c.artist_id = u.id
      WHERE c.is_in_banner = 1 AND c.status NOT IN ('pending', 'cancelled', 'rejected')
      ORDER BY c.event_date DESC
    `);

    const ticketTypes = await getAll<any>(`
      SELECT id, concert_id, name, price, quantity, sold, zone_id FROM ticket_types
    `);

    const processedBanners = bannerConcerts.map(concert => {
        const parsedArtist = JSON.parse(concert.artist);
        const relatedTicketTypes = ticketTypes
          .filter(tt => tt.concert_id === concert.id)
          .map(tt => ({
            id: tt.id,
            name: tt.name,
            price: tt.price,
            available: tt.quantity - tt.sold,
            zone_id: tt.zone_id
          }));
        let frontendStatus: 'available' | 'soon' | 'soldout' = 'available';
        if (concert.status === 'soldout' || concert.available_seats <= 0) {
          frontendStatus = 'soldout';
        } else if (new Date(concert.datetime) > new Date()) {
          frontendStatus = 'soon';
        }
        if (concert.status === 'available') {
          frontendStatus = 'available';
        }
        return {
            ...concert,
            cover_url: normalizeCoverUrl(concert.cover_url),
            artist: parsedArtist,
            artists: [parsedArtist],
            tickets: relatedTicketTypes,
            date: new Date(concert.datetime).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
            status: frontendStatus
        };
    });

    res.json(processedBanners);
  } catch (error) {
    console.error('Get banner concerts error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/concerts/banner/:id - Add a concert to the banner
router.post('/banner/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery('UPDATE concerts SET is_in_banner = 1 WHERE id = ?', [id]);
    res.json({ message: 'Концерт добавлен в баннер' });
  } catch (error) {
    console.error(`Add concert ${id} to banner error:`, error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/concerts/banner/:id - Remove a concert from the banner
router.delete('/banner/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await runQuery('UPDATE concerts SET is_in_banner = 0 WHERE id = ?', [id]);
    res.json({ message: 'Концерт убран из баннера' });
  } catch (error) {
    console.error(`Remove concert ${id} from banner error:`, error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/concerts/:id - Get a single concert by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const concert = await getOne<any>(`
      SELECT
        c.id, c.artist_id, c.title, c.description, c.venue, c.city, c.country, c.address,
        c.event_date as datetime, c.event_time as time, c.cover_url,
        c.total_seats, c.available_seats, c.status, c.is_in_banner, c.venue_plan_id,
        json_object('id', u.id, 'name', u.username, 'avatar_url', u.avatar_url) as artist
      FROM concerts c
      JOIN users u ON c.artist_id = u.id
      WHERE c.id = ?
    `, [id]);
    if (!concert) return res.status(404).json({ error: 'Концерт не найден' });
    if (['pending', 'cancelled', 'rejected'].includes(concert.status)) {
      return res.status(404).json({ error: 'Концерт не найден' });
    }
    const ticketTypes = await getAll<any>(`
      SELECT id, name, price, quantity, sold, zone_id FROM ticket_types WHERE concert_id = ?
    `, [id]);
    const relatedTicketTypes = ticketTypes.map(tt => ({
      id: tt.id,
      name: tt.name,
      price: tt.price,
      available: tt.quantity - tt.sold,
      zone_id: tt.zone_id
    }));
    let frontendStatus: 'available' | 'soon' | 'soldout' = 'available';
    if (concert.status === 'soldout' || concert.available_seats <= 0) {
      frontendStatus = 'soldout';
    } else if (new Date(concert.datetime) > new Date()) {
      frontendStatus = 'soon';
    }
     if (concert.status === 'available') {
        frontendStatus = 'available'
      }
    const coArtistsMap = await loadCoArtistsMap([Number(id)]);
    const primaryArtist = JSON.parse(concert.artist);
    const coArtists = coArtistsMap.get(Number(id)) || [];
    const result = {
      ...concert,
      cover_url: normalizeCoverUrl(concert.cover_url),
      artist: primaryArtist,
      artists: [primaryArtist, ...coArtists],
      tickets: relatedTicketTypes,
      date: new Date(concert.datetime).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      status: frontendStatus,
    };
    res.json(result);
  } catch (error) {
    console.error(`Get concert ${id} error:`, error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/concerts - Create a new concert
router.post(
  '/',
  authenticateToken,
  authorizeRole(['admin', 'artist']),
  upload.single('cover'),
  async (req: AuthRequest & { file?: any }, res) => {
    const {
      title, description, venue, city, country, address,
      datetime, time, venue_plan_id,
      status = 'pending'
    } = req.body as Record<string, string>;

    let ticket_types: Array<{ name: string; price: number; quantity: number; zone_id?: string }> = [];
    try {
      ticket_types = typeof req.body.ticket_types === 'string'
        ? JSON.parse(req.body.ticket_types)
        : (req.body.ticket_types || []);
    } catch {
      return res.status(400).json({ error: 'Некорректный формат ticket_types' });
    }

    let co_artist_ids: number[] = [];
    try {
      const raw = req.body.co_artist_ids;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) co_artist_ids = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
      }
    } catch {
      // ignore — invalid co_artist_ids treated as none
    }

    if (!title || !datetime || !Array.isArray(ticket_types) || ticket_types.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    const total_seats = ticket_types.reduce((sum, tt) => sum + Number(tt.quantity || 0), 0);
    if (total_seats <= 0) {
      return res.status(400).json({ error: 'Сумма мест должна быть больше 0' });
    }

    const cover_url = req.file ? `/uploads/concerts/${req.file.filename}` : null;
    const artist_id = req.user!.id;

    try {
      await runQuery('BEGIN TRANSACTION');
      const concertResult = await runQuery(
        `INSERT INTO concerts
          (artist_id, title, description, venue, city, country, address, event_date, event_time, cover_url, total_seats, available_seats, status, venue_plan_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [artist_id, title, description || null, venue || null, city || null, country || null, address || null,
         datetime, time || null, cover_url, total_seats, total_seats, status, venue_plan_id || null]
      );
      const concertId = concertResult.lastID;
      for (const tt of ticket_types) {
        await runQuery(
          `INSERT INTO ticket_types (concert_id, name, price, quantity, zone_id) VALUES (?, ?, ?, ?, ?)`,
          [concertId, tt.name, Number(tt.price) || 0, Number(tt.quantity) || 0, tt.zone_id || null]
        );
      }
      // Add co-artists (excluding the primary artist)
      const uniqueCoIds = Array.from(new Set(co_artist_ids)).filter((aid) => aid !== artist_id);
      for (const aid of uniqueCoIds) {
        const exists = await getOne<any>("SELECT id FROM users WHERE id = ? AND role = 'artist'", [aid]);
        if (exists) {
          await runQuery(
            `INSERT OR IGNORE INTO concert_artists (concert_id, artist_id) VALUES (?, ?)`,
            [concertId, aid]
          );
        }
      }
      await runQuery('COMMIT');
      res.status(201).json({ id: concertId, message: 'Концерт успешно создан' });
    } catch (error) {
      await runQuery('ROLLBACK');
      console.error('Create concert error:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
);

// PUT /api/concerts/:id/co-artists - Replace co-artists (owner or admin)
router.put('/:id/co-artists', authenticateToken, authorizeRole(['admin', 'artist']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const concertId = Number(id);
  const { co_artist_ids } = req.body as { co_artist_ids?: number[] };
  if (!Array.isArray(co_artist_ids)) {
    return res.status(400).json({ error: 'co_artist_ids должен быть массивом' });
  }
  try {
    const concert = await getOne<any>('SELECT artist_id FROM concerts WHERE id = ?', [concertId]);
    if (!concert) return res.status(404).json({ error: 'Концерт не найден' });
    if (req.user!.role !== 'admin' && req.user!.id !== concert.artist_id) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const cleaned = Array.from(new Set(co_artist_ids.map(Number).filter(n => Number.isFinite(n) && n > 0)))
      .filter(aid => aid !== concert.artist_id);

    await runQuery('BEGIN TRANSACTION');
    await runQuery('DELETE FROM concert_artists WHERE concert_id = ?', [concertId]);
    for (const aid of cleaned) {
      const exists = await getOne<any>("SELECT id FROM users WHERE id = ? AND role = 'artist'", [aid]);
      if (exists) {
        await runQuery('INSERT OR IGNORE INTO concert_artists (concert_id, artist_id) VALUES (?, ?)', [concertId, aid]);
      }
    }
    await runQuery('COMMIT');
    res.json({ message: 'Список артистов обновлён' });
  } catch (error) {
    await runQuery('ROLLBACK');
    console.error(`Update co-artists for concert ${id} error:`, error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/concerts/:id - Update a concert
router.put('/:id', authenticateToken, authorizeRole(['admin', 'artist']), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { user } = req;
    try {
      const concert = await getOne<any>('SELECT artist_id FROM concerts WHERE id = ?', [id]);
      if (!concert) return res.status(404).json({ error: 'Концерт не найден' });
      if (user!.role !== 'admin' && user!.id !== concert.artist_id) {
        return res.status(403).json({ error: 'Нет прав' });
      }
      const fields = ['title', 'description', 'venue', 'city', 'country', 'address', 'event_date', 'event_time', 'cover_url', 'total_seats', 'available_seats', 'status', 'is_in_banner'];
      const updates: string[] = [];
      const values: any[] = [];
      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Нет данных' });
      values.push(id);
      await runQuery(`UPDATE concerts SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ message: 'Концерт обновлен' });
    } catch (error) {
      console.error(`Update concert ${id} error:`, error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

// DELETE /api/concerts/:id - Delete a concert
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'artist']), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { user } = req;
    try {
      const concert = await getOne<any>('SELECT artist_id FROM concerts WHERE id = ?', [id]);
      if (!concert) return res.status(404).json({ error: 'Концерт не найден' });
      if (user!.role !== 'admin' && user!.id !== concert.artist_id) {
        return res.status(403).json({ error: 'Нет прав' });
      }
      await runQuery('DELETE FROM concerts WHERE id = ?', [id]);
      res.json({ message: 'Концерт удален' });
    } catch (error) {
      console.error(`Delete concert ${id} error:`, error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

// GET /api/concerts/:id/tickets - Get all tickets for a concert (Admin only)
router.get('/:id/tickets', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
      const tickets = await getAll<any>(`
        SELECT
          t.id, t.seat_row, t.seat_number, t.qr_code, t.status as ticket_status, t.purchased_at,
          json_object('id', tt.id, 'name', tt.name, 'price', tt.price) as ticket_type,
          json_object('id', u.id, 'username', u.username, 'email', u.email, 'avatar_url', u.avatar_url) as user
        FROM tickets t
        JOIN ticket_types tt ON t.ticket_type_id = tt.id
        JOIN users u ON t.user_id = u.id
        WHERE tt.concert_id = ?
        ORDER BY t.purchased_at DESC
      `, [id]);
      const parsedTickets = tickets.map((ticket: any) => ({
        ...ticket,
        ticket_type: JSON.parse(ticket.ticket_type),
        user: JSON.parse(ticket.user),
      }));
      res.json(parsedTickets);
    } catch (error) {
      console.error(`Get tickets for concert ${id} error:`, error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// POST /api/concerts/:id/buy-ticket - Purchase tickets for a concert
router.post('/:id/buy-ticket', authenticateToken, async (req: AuthRequest, res) => {
    const { id: concertId } = req.params;
    const { ticket_type_id, quantity } = req.body;
    const userId = req.user!.id;
    if (!ticket_type_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    try {
      await runQuery('BEGIN TRANSACTION');
      const ticketType = await getOne<any>('SELECT * FROM ticket_types WHERE id = ? AND concert_id = ?', [ticket_type_id, concertId]);
      if (!ticketType) {
        await runQuery('ROLLBACK');
        return res.status(404).json({ error: 'Тип билета не найден' });
      }
      if ((ticketType.quantity - ticketType.sold) < quantity) {
        await runQuery('ROLLBACK');
        return res.status(400).json({ error: 'Недостаточно билетов' });
      }
      const concert = await getOne<any>('SELECT * FROM concerts WHERE id = ?', [concertId]);
      if (!concert || concert.available_seats < quantity) {
          await runQuery('ROLLBACK');
          return res.status(400).json({ error: 'Недостаточно мест' });
      }
      const totalAmount = Number(ticketType.price) * Number(quantity);
      const platformCommission = Number((totalAmount * 0.02).toFixed(2));
      const artistEarnings = Number((totalAmount - platformCommission).toFixed(2));
      const createdTickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketResult = await runQuery('INSERT INTO tickets (ticket_type_id, user_id, status) VALUES (?, ?, ?)', [ticket_type_id, userId, 'valid']);
        const ticketId = ticketResult.lastID;
        const qrCodeData = JSON.stringify({ ticketId, concertId, userId, validUntil: concert.event_date });
        const qrCodeUrl = await QRCode.toDataURL(qrCodeData);
        await runQuery('UPDATE tickets SET qr_code = ? WHERE id = ?', [qrCodeUrl, ticketId]);
        createdTickets.push({ id: ticketId, qr_code: qrCodeUrl });
      }
      await runQuery('UPDATE ticket_types SET sold = sold + ? WHERE id = ?', [quantity, ticket_type_id]);
      await runQuery('UPDATE concerts SET available_seats = available_seats - ? WHERE id = ?', [quantity, concertId]);
      await runQuery(
        `INSERT INTO transactions (user_id, type, amount, currency, status, payment_method, external_id, metadata, completed_at)
         VALUES (?, 'ticket', ?, 'RUB', 'completed', 'mock_card', ?, ?, CURRENT_TIMESTAMP)`,
        [
          userId,
          totalAmount,
          `mock-ticket-${concertId}-${userId}-${Date.now()}`,
          JSON.stringify({
            concert_id: Number(concertId),
            ticket_type_id: Number(ticket_type_id),
            quantity: Number(quantity),
            unit_price: Number(ticketType.price),
            platform_commission: platformCommission,
            artist_earnings: artistEarnings,
            simulated: true,
          }),
        ],
      );
      await runQuery(
        `INSERT OR IGNORE INTO artist_profiles (user_id)
         VALUES (?)`,
        [concert.artist_id],
      );
      await runQuery(
        `UPDATE artist_profiles
         SET total_earnings = COALESCE(total_earnings, 0) + ?
         WHERE user_id = ?`,
        [artistEarnings, concert.artist_id],
      );
      await runQuery('COMMIT');
      res.status(201).json({
        message: 'Билеты куплены',
        tickets: createdTickets,
        payment: {
          totalAmount,
          platformCommission,
          artistEarnings,
        },
      });
    } catch (error) {
      await runQuery('ROLLBACK');
      console.error(`Buy ticket error for concert ${concertId}:`, error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
});

export default router;
