import { kv } from '@vercel/kv';
import crypto from 'crypto';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Код обязателен' });
  }

  const cleanCode = code.toUpperCase().trim();
  
  // Находим username по коду
  const username = await kv.get(`bid:code:${cleanCode}`);
  if (!username) {
    return res.status(404).json({ error: 'Неверный код' });
  }

  const entry = await kv.get(`bid:${username}`);
  if (!entry) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  // Если уже есть токен — вернём его
  if (entry.token) {
    res.setHeader('Set-Cookie', `build_token=${entry.token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ ok: true, already: true });
  }

  // Генерируем новый токен
  const token = generateToken();
  entry.token = token;
  entry.updatedAt = new Date().toISOString();
  
  await kv.set(`bid:${username}`, entry);
  await kv.set(`bid:token:${token}`, username);
  
  res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
  
  return res.status(200).json({ ok: true });
}