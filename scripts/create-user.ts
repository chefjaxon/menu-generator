/**
 * Create a user account.
 * Usage: npx tsx scripts/create-user.ts <username> <password>
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/create-user.ts <username> <password>');
  process.exit(1);
}

const [username, password] = args;

async function main() {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { id: nanoid(), username, passwordHash: hash },
  });

  console.log(`User "${username}" created successfully.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
