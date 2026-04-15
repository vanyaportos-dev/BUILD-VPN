import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверяем пароль админа
  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const ticketIds = (await kv.get('tickets:list')) || [];
  const tickets = [];
  
  for (const id of ticketIds) {
    const ticket = await kv.get(`ticket:${id}`);
    if (ticket) {
      tickets.push({
        id: ticket.id,
        topic: ticket.topic,
        status: ticket.status,
        userId: ticket.userId,
        userNick: ticket.userNick,
        createdAt: ticket.createdAt,
        lastMessage: ticket.messages[ticket.messages.length - 1]?.text
      });
    }
  }

  return res.status(200).json({ tickets });
}