import { nanoid } from 'nanoid';
import { prisma } from '../prisma';

export async function getAllProteins(): Promise<string[]> {
  const rows = await prisma.protein.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

export async function addProtein(name: string): Promise<void> {
  const agg = await prisma.protein.aggregate({ _max: { sortOrder: true } });
  const maxOrder = agg._max.sortOrder ?? -1;
  await prisma.protein.create({
    data: {
      id: nanoid(),
      name: name.toLowerCase().trim(),
      sortOrder: maxOrder + 1,
    },
  });
}

export async function removeProtein(name: string): Promise<boolean> {
  const usage = await getProteinUsageCount(name);
  if (usage > 0) return false;
  try {
    await prisma.protein.delete({ where: { name } });
    return true;
  } catch {
    return false;
  }
}

export async function getProteinUsageCount(name: string): Promise<number> {
  const [clientCount, recipeCount] = await Promise.all([
    prisma.clientProtein.count({ where: { protein: name } }),
    prisma.recipeProteinSwap.count({ where: { protein: name } }),
  ]);
  return clientCount + recipeCount;
}

export async function getProteinUsages(): Promise<Record<string, number>> {
  const proteins = await getAllProteins();
  const counts = await Promise.all(proteins.map((p) => getProteinUsageCount(p)));
  const usages: Record<string, number> = {};
  for (let i = 0; i < proteins.length; i++) {
    usages[proteins[i]] = counts[i];
  }
  return usages;
}
