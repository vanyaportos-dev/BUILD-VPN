import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username обязателен' });
  }

  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean || clean.length < 2 || clean.length > 32) {
    return res.status(400).json({ error: 'Некорректный Telegram username' });
  }

  const existing = await kv.get(`bid:${clean}`);
  if (existing) {
    const { status } = existing;
    if (status === 'active') return res.status(409).json({ error: 'BUILD ID уже активирован для этого аккаунта' });
    if (status === 'ready')  return res.status(409).json({ error: 'Код уже готов. Проверьте на странице /my-codes.html' });
    if (status === 'pending') return res.status(409).json({ error: 'Заявка уже подана. Ожидайте обработки.' });
  }

  const entry = { username: clean, createdAt: new Date().toISOString(), status: 'pending', code: null, nick: null };
  await kv.set(`bid:${clean}`, entry);

  // Add to list
  const list = (await kv.get('bid:list')) || [];
  if (!list.includes(clean)) {
    list.unshift(clean);
    await kv.set('bid:list', list);
  }

  return res.status(200).json({ ok: true });
}
