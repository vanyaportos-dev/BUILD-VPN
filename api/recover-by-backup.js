import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { backupCode } = req.body || {};
  if (!backupCode) return res.status(400).json({ error: 'Резервный код обязателен' });

  const cleanCode = backupCode.toUpperCase().trim();
  
  const username = await kv.get(`bid:backup:${cleanCode}`);
  if (!username) {
    return res.status(404).json({ error: 'Неверный резервный код' });
  }

  const entry = await kv.get(`bid:${username}`);
  if (!entry || entry.status !== 'active') {
    return res.status(404).json({ error: 'Пользователь не найден или не активирован' });
  }

  return res.status(200).json({ 
    found: true, 
    code: entry.code,
    username: entry.username,
    nick: entry.nick
  });
}