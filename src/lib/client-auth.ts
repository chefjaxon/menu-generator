import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma';

const SESSION_EXPIRY_DAYS = 30;

export async function createClientSession(clientAccountId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.clientSession.create({
    data: {
      id: nanoid(),
      clientAccountId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function validateClientSession(
  token: string
): Promise<{ clientAccountId: string; clientId: string; email: string } | null> {
  const row = await prisma.clientSession.findUnique({
    where: { token },
    include: { account: { select: { clientId: true, email: true } } },
  });

  if (!row) return null;

  if (row.expiresAt < new Date()) {
    await prisma.clientSession.delete({ where: { token } });
    return null;
  }

  return {
    clientAccountId: row.clientAccountId,
    clientId: row.account.clientId,
    email: row.account.email,
  };
}

export async function destroyClientSession(token: string): Promise<void> {
  try {
    await prisma.clientSession.delete({ where: { token } });
  } catch {
    // session may not exist, ignore
  }
}

export async function loginClientByEmail(
  email: string,
  password: string
): Promise<{ token: string; clientId: string } | null> {
  const account = await prisma.clientAccount.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!account) return null;

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) return null;

  const token = await createClientSession(account.id);
  return { token, clientId: account.clientId };
}

export async function createClientAccount(
  clientId: string,
  email: string,
  password: string
): Promise<string> {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.clientAccount.create({
    data: {
      id: nanoid(),
      clientId,
      email: email.toLowerCase().trim(),
      passwordHash,
    },
  });
  return email;
}
