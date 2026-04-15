import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем авторизацию
  const token = req.cookies?.build_token;
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const username = await kv.get(`bid:token:${token}`);
  if (!username) {
    return res.status(401).json({ error: 'Неверный токен' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'ID тикета обязателен' });
  }

  const ticket = await kv.get(`ticket:${id}`);
  if (!ticket) {
    return res.status(404).json({ error: 'Тикет не найден' });
  }

  // Проверяем, что тикет принадлежит пользователю
  if (ticket.userId !== username) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  return res.status(200).json(ticket);
}