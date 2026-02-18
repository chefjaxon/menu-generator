import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
