import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma';

const SESSION_EXPIRY_DAYS = 30;

export async function createChefSession(chefId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.chefSession.create({
    data: {
      id: nanoid(),
      chefId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function validateChefSession(
  token: string
): Promise<{ chefId: string; name: string; email: string } | null> {
  const row = await prisma.chefSession.findUnique({
    where: { token },
    include: { chef: { select: { name: true, email: true } } },
  });

  if (!row) return null;

  if (row.expiresAt < new Date()) {
    await prisma.chefSession.delete({ where: { token } });
    return null;
  }

  return { chefId: row.chefId, name: row.chef.name, email: row.chef.email };
}

export async function destroyChefSession(token: string): Promise<void> {
  try {
    await prisma.chefSession.delete({ where: { token } });
  } catch {
    // session may not exist, ignore
  }
}

export async function loginChef(
  email: string,
  password: string
): Promise<string | null> {
  const chef = await prisma.chef.findUnique({ where: { email } });
  if (!chef) return null;

  const valid = await bcrypt.compare(password, chef.passwordHash);
  if (!valid) return null;

  return createChefSession(chef.id);
}

export async function createChef(
  name: string,
  email: string,
  password: string
): Promise<{ id: string; name: string; email: string }> {
  const passwordHash = await bcrypt.hash(password, 12);
  const chef = await prisma.chef.create({
    data: {
      id: nanoid(),
      name,
      email,
      passwordHash,
    },
    select: { id: true, name: true, email: true },
  });
  return chef;
}
