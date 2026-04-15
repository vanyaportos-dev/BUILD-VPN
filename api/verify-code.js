import { kv } from '@vercel/kv';
import crypto from 'crypto';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateBackupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    else code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

  // Генерируем резервный код
  const backupCode = generateBackupCode();
  const token = generateToken();

  const updated = {
    ...entry,
    status: 'active',
    nick: cleanNick,
    activatedAt: new Date().toISOString(),
    token: token,
    backupCode: backupCode
  };
  await kv.set(`bid:${username}`, updated);
  await kv.set(`bid:token:${token}`, username);
  await kv.set(`bid:backup:${backupCode}`, username);

  // Устанавливаем куку
  res.setHeader('Set-Cookie', `build_token=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);

  return res.status(200).json({ 
    ok: true, 
    username, 
    nick: cleanNick, 
    code: cleanCode, 
    backupCode 
  });
}