import { kv } from '@vercel/kv';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I for readability
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username обязателен' });

  const clean = username.toLowerCase().replace(/^@/, '');
  const entry = await kv.get(`bid:${clean}`);
  if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
  if (entry.status !== 'pending') return res.status(409).json({ error: `Нельзя активировать: статус уже "${entry.status}"` });

  // Generate unique code
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    const existing = await kv.get(`bid:code:${code}`);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  const updated = { ...entry, status: 'ready', code, updatedAt: new Date().toISOString() };
  await kv.set(`bid:${clean}`, updated);
  await kv.set(`bid:code:${code}`, clean); // index: code → username

  return res.status(200).json({ ok: true, code });
}
