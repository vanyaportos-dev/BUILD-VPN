import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем авторизацию по токену
  const token = req.cookies?.build_token;
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const username = await kv.get(`bid:token:${token}`);
  if (!username) {
    return res.status(401).json({ error: 'Неверный токен' });
  }

  const user = await kv.get(`bid:${username}`);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }

  const { topic, message } = req.body;
  if (!topic || !message) {
    return res.status(400).json({ error: 'Тема и сообщение обязательны' });
  }

  // Генерируем ID тикета
  const id = 'ticket_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  
  const ticket = {
    id,
    userId: username,
    userNick: user.nick || username,
    topic: topic.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      { from: 'user', text: message.trim(), createdAt: new Date().toISOString() }
    ]
  };

  // Сохраняем тикет
  await kv.set(`ticket:${id}`, ticket);
  
  // Добавляем в список всех тикетов
  const allTickets = (await kv.get('tickets:list')) || [];
  allTickets.unshift(id);
  await kv.set('tickets:list', allTickets);
  
  // Добавляем в список тикетов пользователя
  const userTickets = (await kv.get(`tickets:user:${username}`)) || [];
  userTickets.unshift(id);
  await kv.set(`tickets:user:${username}`, userTickets);

  return res.status(200).json({ ok: true, id });
}