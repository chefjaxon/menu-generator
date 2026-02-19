import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { nanoid } from 'nanoid';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaults = [
    'chicken', 'steak', 'pork', 'salmon', 'cod', 'trout',
    'shrimp', 'tofu', 'vegetarian', 'egg', 'venison',
  ];

  for (let i = 0; i < defaults.length; i++) {
    await prisma.protein.upsert({
      where: { name: defaults[i] },
      update: {},
      create: {
        id: `protein_${defaults[i]}`,
        name: defaults[i],
        sortOrder: i,
      },
    });
  }

  console.log('Seeded default proteins.');

  // Create default admin user (password: changeme)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: nanoid(),
      username: 'admin',
      passwordHash: '$2b$12$.mbYnevkNJXimfOZ.DzDI.2b2dqagJvKU4NOcCPzYhE9vSKe8xxei',
    },
  });

  console.log('Seeded default admin user.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
