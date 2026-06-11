import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAll, getOne, runQuery } from '../db';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;

    const transactions = await getAll<any>(
      `SELECT id, type, amount, currency, status, payment_method, created_at, completed_at
       FROM transactions
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const formattedTransactions = transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency || 'RUB',
      status: t.status,
      payment_method: t.payment_method,
      created_at: t.created_at,
      completed_at: t.completed_at,
      description: getTransactionDescription(t.type)
    }));

    res.json(formattedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/subscription', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;

    const subscription = await getOne<any>(
      `SELECT id, plan, status, started_at, expires_at, auto_renew, created_at
       FROM subscriptions
       WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!subscription) {
      return res.json({
        plan: 'free',
        status: 'active',
        features: ['С рекламой', '96 kbps', 'Ограниченные пропуски']
      });
    }

    const planDetails = getPlanDetails(subscription.plan);

    res.json({
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      started_at: subscription.started_at,
      expires_at: subscription.expires_at,
      auto_renew: !!subscription.auto_renew,
      ...planDetails
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/subscription/mock-pay', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user!.id;
  const plan = String(req.body?.plan || 'pro');
  const paymentMethod = String(req.body?.payment_method || 'mock_card');

  const planDetails = getPlanDetails(plan);
  if (plan === 'free' || !planDetails.price) {
    return res.status(400).json({ error: 'Некорректный тариф для оплаты' });
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  try {
    await runQuery('BEGIN TRANSACTION');

    await runQuery(
      `UPDATE subscriptions
       SET status = 'cancelled'
       WHERE user_id = ? AND status = 'active'`,
      [userId],
    );

    await runQuery(
      `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, auto_renew)
       VALUES (?, ?, 'active', ?, ?, 1)`,
      [userId, plan, now.toISOString(), expiresAt.toISOString()],
    );

    const tx = await runQuery(
      `INSERT INTO transactions (user_id, type, amount, currency, status, payment_method, external_id, metadata, completed_at)
       VALUES (?, 'subscription', ?, 'RUB', 'completed', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        userId,
        planDetails.price,
        paymentMethod,
        `mock-sub-${userId}-${Date.now()}`,
        JSON.stringify({ plan, simulated: true }),
      ],
    );

    await runQuery(
      `UPDATE users
       SET is_premium = 1,
           premium_expires_at = ?
       WHERE id = ?`,
      [expiresAt.toISOString(), userId],
    );

    await runQuery('COMMIT');

    res.status(201).json({
      message: 'Подписка успешно оформлена',
      transactionId: tx.lastID,
      plan,
      amount: planDetails.price,
      premium_expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    await runQuery('ROLLBACK');
    console.error('Mock subscription payment error:', error);
    res.status(500).json({ error: 'Не удалось провести оплату подписки' });
  }
});

function getTransactionDescription(type: string): string {
  switch (type) {
    case 'subscription':
      return 'Подписка Premium';
    case 'ticket':
      return 'Билет на концерт';
    case 'donation':
      return 'Донат артисту';
    case 'promotion':
      return 'Продвижение трека';
    case 'refund':
      return 'Возврат средств';
    default:
      return 'Платеж';
  }
}

function getPlanDetails(plan: string) {
  switch (plan) {
    case 'pro':
      return {
        name: 'Pro',
        price: 299,
        features: ['Без рекламы', '320 kbps', 'Неограниченные пропуски']
      };
    case 'ultra':
      return {
        name: 'Ultra',
        price: 499,
        features: ['Всё из Pro', 'NFT-билеты', 'Чат с артистами']
      };
    default:
      return {
        name: 'Free',
        price: 0,
        features: ['С рекламой', '96 kbps', 'Ограниченные пропуски']
      };
  }
}

export default router;
