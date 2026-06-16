import express, { Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getAll, getOne, runQuery } from '../db';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';

const router = express.Router();

const uploadDir = path.resolve(__dirname, '..', '..', 'uploads/support');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeSupportPath(fileName: string) {
  if (!fileName) return null;
  if (fileName.startsWith('http') || fileName.startsWith('/uploads/')) return fileName;
  return `/uploads/support/${fileName}`;
}

router.post('/', authenticateToken, upload.array('screenshots', 5), async (req: AuthRequest, res: Response) => {
  try {
    const issueAreasRaw = Array.isArray(req.body?.issue_area)
      ? req.body.issue_area
      : typeof req.body?.issue_area === 'string'
        ? req.body.issue_area.split('||').map((item: string) => item.trim()).filter(Boolean)
        : [];
    const issueArea = issueAreasRaw.join(', ');
    const description = String(req.body?.description || '').trim();
    const files = Array.isArray(req.files) ? req.files : [];

    if (!issueArea || !description) {
      return res.status(400).json({ error: 'Укажите область проблемы и описание' });
    }

    const attachments = files.map((file: any) => normalizeSupportPath(file.filename));

    const result = await runQuery(
      `INSERT INTO support_tickets (user_id, issue_area, description, attachments, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [req.user!.id, issueArea, description, JSON.stringify(attachments)],
    );

    const ticket = await getOne<any>('SELECT id, user_id, issue_area, description, attachments, status, admin_response, reviewed_by, reviewed_at, created_at, updated_at FROM support_tickets WHERE id = ?', [result.lastID]);
    res.status(201).json({
      ...ticket,
      attachments,
    });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await getAll<any>(
      `SELECT id, issue_area, description, attachments, status, admin_response, reviewed_at, created_at, updated_at
       FROM support_tickets
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user!.id],
    );

    res.json(tickets.map((ticket) => ({
      ...ticket,
      attachments: ticket.attachments ? JSON.parse(ticket.attachments) : [],
    })));
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/admin', authenticateToken, authorizeRole(['admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const tickets = await getAll<any>(`
      SELECT st.*, u.username, u.email, reviewer.username as reviewed_by_username
      FROM support_tickets st
      JOIN users u ON u.id = st.user_id
      LEFT JOIN users reviewer ON reviewer.id = st.reviewed_by
      ORDER BY CASE st.status WHEN 'open' THEN 0 ELSE 1 END, st.created_at DESC
    `);

    res.json(tickets.map((ticket) => ({
      ...ticket,
      attachments: ticket.attachments ? JSON.parse(ticket.attachments) : [],
    })));
  } catch (error) {
    console.error('Admin support tickets error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/admin/:id/close', authenticateToken, authorizeRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id as string, 10);
    const responseText = String(req.body?.response || '').trim();

    if (!responseText) {
      return res.status(400).json({ error: 'Укажите ответ пользователю' });
    }

    const ticket = await getOne<any>('SELECT id, user_id, issue_area FROM support_tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    await runQuery(
      `UPDATE support_tickets
       SET status = 'closed', admin_response = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [responseText, req.user!.id, ticketId],
    );

    await createNotification(
      ticket.user_id,
      'support_resolved',
      null,
      'support_ticket',
      ticketId,
      `Служба поддержки рассмотрела вашу проблему в области «${ticket.issue_area}». Принятые меры: ${responseText}`,
    );

    res.json({ message: 'Заявка закрыта' });
  } catch (error) {
    console.error('Close support ticket error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
