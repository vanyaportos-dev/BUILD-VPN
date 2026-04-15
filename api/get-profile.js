import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const username = (req.query.username || '').toLowerCase().replace(/^@/, '').trim();
  if (!username) return res.status(400).json({ error: 'Username обязателен' });

  const entry = await kv.get(`bid:${username}`);
  if (!entry || entry.status !== 'active') {
    return res.status(404).json({ found: false });
  }

  return res.status(200).json({
    found: true,
    username: entry.username,
    nick: entry.nick,
    code: entry.code,
    createdAt: entry.createdAt,
    activatedAt: entry.activatedAt,
  });
}
