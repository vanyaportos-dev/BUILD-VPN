import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const token = req.cookies?.build_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const username = await kv.get(`bid:token:${token}`);
  if (!username) {
    return res.status(401).json({ error: 'Неверный токен' });
  }

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