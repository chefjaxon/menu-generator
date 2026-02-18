import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma';

const SESSION_EXPIRY_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      id: nanoid(),
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function validateSession(token: string): Promise<{ userId: string; username: string } | null> {
  const row = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { username: true } } },
  });

  if (!row) return null;

  if (row.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } });
    return null;
  }

  return { userId: row.userId, username: row.user.username };
}

export async function destroySession(token: string): Promise<void> {
  try {
    await prisma.session.delete({ where: { token } });
  } catch {
    // session may not exist, ignore
  }
}
