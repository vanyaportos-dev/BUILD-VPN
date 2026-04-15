import { kv } from '@vercel/kv';
import crypto from 'crypto';

function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function generateCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]; return code; }
function generateBackupCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 8; i++) { if (i === 4) code += '-'; else code += chars[Math.floor(Math.random() * chars.length)]; } return code; }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  // ========== BUILD ID ==========
  if (action === 'save-request') {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username обязателен' });
    const clean = username.toLowerCase().replace(/^@/, '');
    const existing = await kv.get(`bid:${clean}`);
    if (existing) {
      if (existing.status === 'active') return res.status(409).json({ error: 'BUILD ID уже активирован' });
      if (existing.status === 'ready') return res.status(409).json({ error: 'Код уже готов' });
      if (existing.status === 'pending') return res.status(409).json({ error: 'Заявка уже подана' });
    }
    const entry = { username: clean, createdAt: new Date().toISOString(), status: 'pending', code: null, nick: null };
    await kv.set(`bid:${clean}`, entry);
    const list = (await kv.get('bid:list')) || [];
    if (!list.includes(clean)) { list.unshift(clean); await kv.set('bid:list', list); }
    return res.status(200).json({ ok: true });
  }

  if (action === 'activate-code') {
    const { username } = req.body;
    const pwd = req.headers['x-admin-password'];
    if (!pwd || pwd !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
    const clean = username.toLowerCase().replace(/^@/, '');
    const entry = await kv.get(`bid:${clean}`);
    if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
    if (entry.status !== 'pending') return res.status(409).json({ error: 'Нельзя активировать' });
    let code; let attempts = 0;
    do { code = generateCode(); attempts++; } while (await kv.get(`bid:code:${code}`) && attempts < 10);
    const updated = { ...entry, status: 'ready', code, updatedAt: new Date().toISOString() };
    await kv.set(`bid:${clean}`, updated);
    await kv.set(`bid:code:${code}`, clean);
    return res.status(200).json({ ok: true, code });
  }

  if (action === 'verify-code') {
    const { code, nick } = req.body;
    if (!code || !nick) return res.status(400).json({ error: 'Код и ник обязательны' });
    const cleanCode = code.toUpperCase().trim();
    const username = await kv.get(`bid:code:${cleanCode}`);
    if (!username) return res.status(404).json({ error: 'Неверный код' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
    if (entry.status !== 'ready') return res.status(409).json({ error: 'Код ещё не активирован' });
    const backupCode = generateBackupCode();
    const token = generateToken();
    const updated = { ...entry, status: 'active', nick: nick.trim(), activatedAt: new Date().toISOString(), token, backupCode };
    await kv.set(`bid:${username}`, updated);
    await kv.set(`bid:token:${token}`, username);
    await kv.set(`bid:backup:${backupCode}`, username);
    res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true, username, nick, code: cleanCode, backupCode });
  }

  if (action === 'add-token') {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Код обязателен' });
    const cleanCode = code.toUpperCase().trim();
    const username = await kv.get(`bid:code:${cleanCode}`);
    if (!username) return res.status(404).json({ error: 'Неверный код' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry) return res.status(404).json({ error: 'Пользователь не найден' });
    if (entry.token) {
      res.setHeader('Set-Cookie', `build_token=${entry.token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
      return res.status(200).json({ ok: true });
    }
    const token = generateToken();
    entry.token = token;
    await kv.set(`bid:${username}`, entry);
    await kv.set(`bid:token:${token}`, username);
    res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true });
  }

  if (action === 'generate-backup') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry) return res.status(404).json({ error: 'Пользователь не найден' });
    const backupCode = generateBackupCode();
    entry.backupCode = backupCode;
    await kv.set(`bid:${username}`, entry);
    await kv.set(`bid:backup:${backupCode}`, username);
    return res.status(200).json({ backupCode });
  }

  if (action === 'recover-by-backup') {
    const { backupCode } = req.body;
    if (!backupCode) return res.status(400).json({ error: 'Резервный код обязателен' });
    const cleanCode = backupCode.toUpperCase().trim();
    const username = await kv.get(`bid:backup:${cleanCode}`);
    if (!username) return res.status(404).json({ error: 'Неверный резервный код' });
    const entry = await kv.get(`bid:${username}`);
    if (!entry || entry.status !== 'active') return res.status(404).json({ error: 'Пользователь не найден' });
    return res.status(200).json({ found: true, code: entry.code });
  }

  // ========== ТИКЕТЫ ==========
  if (action === 'create-ticket') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const user = await kv.get(`bid:${username}`);
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'Пользователь не найден' });
    const { topic, message } = req.body;
    if (!topic || !message) return res.status(400).json({ error: 'Тема и сообщение обязательны' });
    const id = 'ticket_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const ticket = { id, userId: username, userNick: user.nick || username, topic: topic.trim(), status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [{ from: 'user', text: message.trim(), createdAt: new Date().toISOString() }] };
    await kv.set(`ticket:${id}`, ticket);
    const allTickets = (await kv.get('tickets:list')) || [];
    allTickets.unshift(id); await kv.set('tickets:list', allTickets);
    const userTickets = (await kv.get(`tickets:user:${username}`)) || [];
    userTickets.unshift(id); await kv.set(`tickets:user:${username}`, userTickets);
    return res.status(200).json({ ok: true, id });
  }

  if (action === 'send-message') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const { ticketId, message } = req.body;
    if (!ticketId || !message) return res.status(400).json({ error: 'ID и сообщение обязательны' });
    const ticket = await kv.get(`ticket:${ticketId}`);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (ticket.userId !== username) return res.status(403).json({ error: 'Доступ запрещён' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Тикет закрыт' });
    ticket.messages.push({ from: 'user', text: message.trim(), createdAt: new Date().toISOString() });
    ticket.updatedAt = new Date().toISOString();
    await kv.set(`ticket:${ticketId}`, ticket);
    return res.status(200).json({ ok: true });
  }

  if (action === 'close-ticket') {
    const token = req.cookies?.build_token;
    if (!token) return res.status(401).json({ error: 'Не авторизован' });
    const username = await kv.get(`bid:token:${token}`);
    if (!username) return res.status(401).json({ error: 'Неверный токен' });
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ID обязателен' });
    const ticket = await kv.get(`ticket:${ticketId}`);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    if (ticket.userId !== username) return res.status(403).json({ error: 'Доступ запрещён' });
    ticket.status = 'closed';
    ticket.updatedAt = new Date().toISOString();
    await kv.set(`ticket:${ticketId}`, ticket);
    return res.status(200).json({ ok: true });
  }

  if (action === 'admin-reply') {
    const pwd = req.headers['x-admin-password'];
    if (!pwd || pwd !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Неверный пароль' });
    const { ticketId, message } = req.body;
    if (!ticketId || !message) return res.status(400).json({ error: 'ID и сообщение обязательны' });
    const ticket = await kv.get(`ticket:${ticketId}`);
    if (!ticket) return res.status(404).json({ error: 'Тикет не найден' });
    ticket.messages.push({ from: 'admin', text: message.trim(), createdAt: new Date().toISOString() });
    ticket.updatedAt = new Date().toISOString();
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await kv.set(`ticket:${ticketId}`, ticket);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Неизвестное действие' });
}