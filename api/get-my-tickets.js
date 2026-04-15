import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.build_token;
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const username = await kv.get(`bid:token:${token}`);
  if (!username) {
    return res.status(401).json({ error: 'Неверный токен' });
  }

  const ticketIds = (await kv.get(`tickets:user:${username}`)) || [];
  const tickets = [];
  
  for (const id of ticketIds) {
    const ticket = await kv.get(`ticket:${id}`);
    if (ticket) {
      tickets.push({
        id: ticket.id,
        topic: ticket.topic,
        status: ticket.status,
        createdAt: ticket.createdAt,
        lastMessage: ticket.messages[ticket.messages.length - 1]?.text
      });
    }
  }

  return res.status(200).json({ tickets });
}