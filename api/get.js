import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, id, username, code, token } = req.query;

  // ========== BUILD ID ==========
  if (action === 'get-my-code') {
    if (!username) return res.status(400).json({ error: 'Username обязателен' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry) return res.status(404).json({ found: false });
    return res.status(200).json({ found: true, status: entry.status, code: entry.code, createdAt: entry.createdAt });
  }

  if (action === 'get-profile') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const user = await kv.get(`bid:token:${token}`);
    if (!user) return res.status(401).json({ error: 'Неверный токен' });
    const entry = await kv.get(`bid:${user}`);
    if (!entry || entry.status !== 'active') return res.status(404).json({ found: false });
    return res.status(200).json({ found: true, username: entry.username, nick: entry.nick, code: entry.code, createdAt: entry.createdAt, activatedAt: entry.activatedAt });
  }

  if (action === 'get-profile-by-token') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry || entry.status !== 'active') return res.status(404).json({ found: false });
    return res.status(200).json({ found: true, username: entry.username, nick: entry.nick, code: entry.code, createdAt: entry.createdAt, activatedAt: entry.activatedAt });
  }

  // ========== ЗАЯВКИ BUILD ID (АДМИНКА) ==========
  if (action === 'get-requests') {
    const pwd = req.headers['x-admin-password'];
    if (!pwd || pwd !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
    const list = (await kv.get('bid:list')) || [];
    const requests = [];
    for (const username of list) {
      const entry = await kv.get(`bid:${username}`);
      if (entry) requests.push(entry);
    }
    return res.status(200).json({ requests });
  }

  // ========== ТИКЕТЫ ==========
  if (action === 'get-my-tickets') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const ticketIds = (await kv.get(`tickets:user:${username}`)) || [];
    const tickets = [];
    for (const ticketId of ticketIds) {
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (ticket) {
        tickets.push({ id: ticket.id, topic: ticket.topic, status: ticket.status, createdAt: ticket.createdAt, lastMessage: ticket.messages[ticket.messages.length - 1]?.text });
      }
    }
    return res.status(200).json({ tickets });
  }

  if (action === 'get-ticket') {
    if (!id) return res.status(400).json({ error: 'ID обязателен' });
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const ticket = await kv.get(`ticket:${id}`);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (ticket.userId !== username) return res.status(403).json({ error: 'Доступ запрещён' });
    return res.status(200).json(ticket);
  }

  if (action === 'admin-get-tickets') {
    const pwd = req.headers['x-admin-password'];
    if (!pwd || pwd !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
    const ticketIds = (await kv.get('tickets:list')) || [];
    const tickets = [];
    for (const ticketId of ticketIds) {
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (ticket) {
        tickets.push({ id: ticket.id, topic: ticket.topic, status: ticket.status, userId: ticket.userId, userNick: ticket.userNick, createdAt: ticket.createdAt, lastMessage: ticket.messages[ticket.messages.length - 1]?.text });
      }
    }
    return res.status(200).json({ tickets });
  }

  return res.status(400).json({ error: 'Неизвестное действие' });
          }
