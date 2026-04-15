import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, nick } = req.body || {};
  if (!code || !nick) return res.status(400).json({ error: 'Код и никнейм обязательны' });

  const cleanCode = code.toUpperCase().trim();
  const cleanNick = nick.trim();
  if (cleanNick.length < 2 || cleanNick.length > 32) {
    return res.status(400).json({ error: 'Никнейм должен быть от 2 до 32 символов' });
  }

  // Find username by code
  const username = await kv.get(`bid:code:${cleanCode}`);
  if (!username) return res.status(404).json({ error: 'Неверный код' });

  const entry = await kv.get(`bid:${username}`);
  if (!entry) return res.status(404).json({ error: 'Заявка не найдена' });
  if (entry.status === 'active') return res.status(409).json({ error: 'BUILD ID уже активирован' });
  if (entry.status !== 'ready') return res.status(409).json({ error: 'Код ещё не активирован администратором' });

  const updated = {
    ...entry,
    status: 'active',
    nick: cleanNick,
    activatedAt: new Date().toISOString(),
  };
  await kv.set(`bid:${username}`, updated);

  return res.status(200).json({ ok: true, username, nick: cleanNick, code: cleanCode });
}
