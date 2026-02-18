import { nanoid } from 'nanoid';
import { prisma } from '../prisma';
import type { Client, CuisineType, MenuComposition } from '../types';

function mapClient(row: {
  id: string;
  name: string;
  itemsPerMenu: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  proteins: Array<{ protein: string }>;
  restrictions: Array<{ restriction: string }>;
  cuisinePreferences: Array<{ cuisineType: string; weight: number }>;
  menuComposition: Array<{ category: string; count: number }>;
}): Client {
  const menuComposition: MenuComposition[] = row.menuComposition.map((c) => ({
    category: c.category,
    count: c.count,
  }));

  const compositionTotal = menuComposition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : row.itemsPerMenu;

  return {
    id: row.id,
    name: row.name,
    itemsPerMenu,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    proteins: row.proteins.map((p) => p.protein),
    restrictions: row.restrictions.map((r) => r.restriction),
    cuisinePreferences: row.cuisinePreferences.map((c) => ({
      cuisineType: c.cuisineType as CuisineType,
      weight: c.weight,
    })),
    menuComposition,
  };
}

const clientInclude = {
  proteins: true,
  restrictions: true,
  cuisinePreferences: true,
  menuComposition: true,
};

export async function getAllClients(): Promise<Client[]> {
  const rows = await prisma.client.findMany({
    include: clientInclude,
    orderBy: { name: 'asc' },
  });
  return rows.map(mapClient);
}

export async function getClientById(id: string): Promise<Client | null> {
  const row = await prisma.client.findUnique({
    where: { id },
    include: clientInclude,
  });
  if (!row) return null;
  return mapClient(row);
}

export interface ClientInput {
  name: string;
  itemsPerMenu?: number;
  notes?: string;
  proteins: string[];
  restrictions: string[];
  cuisinePreferences: Array<{ cuisineType: string; weight: number }>;
  menuComposition?: Array<{ category: string; count: number }>;
}

export async function createClient(data: ClientInput): Promise<Client> {
  const id = nanoid();
  const composition = data.menuComposition || [];
  const compositionTotal = composition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : (data.itemsPerMenu || 5);

  await prisma.client.create({
    data: {
      id,
      name: data.name,
      itemsPerMenu,
      notes: data.notes || null,
      proteins: {
        create: data.proteins.map((protein) => ({ id: nanoid(), protein })),
      },
      restrictions: {
        create: data.restrictions.map((restriction) => ({ id: nanoid(), restriction })),
      },
      cuisinePreferences: {
        create: data.cuisinePreferences.map((pref) => ({
          id: nanoid(),
          cuisineType: pref.cuisineType,
          weight: pref.weight,
        })),
      },
      menuComposition: {
        create: composition
          .filter((c) => c.count > 0)
          .map((c) => ({ id: nanoid(), category: c.category, count: c.count })),
      },
    },
  });

  return (await getClientById(id))!;
}

export async function updateClient(id: string, data: ClientInput): Promise<Client | null> {
  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  const composition = data.menuComposition || [];
  const compositionTotal = composition.reduce((sum, c) => sum + c.count, 0);
  const itemsPerMenu = compositionTotal > 0 ? compositionTotal : (data.itemsPerMenu || 5);

  await prisma.$transaction([
    prisma.client.update({
      where: { id },
      data: { name: data.name, itemsPerMenu, notes: data.notes || null },
    }),
    prisma.clientProtein.deleteMany({ where: { clientId: id } }),
    prisma.clientRestriction.deleteMany({ where: { clientId: id } }),
    prisma.clientCuisinePreference.deleteMany({ where: { clientId: id } }),
    prisma.clientMenuComposition.deleteMany({ where: { clientId: id } }),
    prisma.clientProtein.createMany({
      data: data.proteins.map((protein) => ({ id: nanoid(), clientId: id, protein })),
    }),
    prisma.clientRestriction.createMany({
      data: data.restrictions.map((restriction) => ({ id: nanoid(), clientId: id, restriction })),
    }),
    prisma.clientCuisinePreference.createMany({
      data: data.cuisinePreferences.map((pref) => ({
        id: nanoid(),
        clientId: id,
        cuisineType: pref.cuisineType,
        weight: pref.weight,
      })),
    }),
    prisma.clientMenuComposition.createMany({
      data: composition
        .filter((c) => c.count > 0)
        .map((c) => ({ id: nanoid(), clientId: id, category: c.category, count: c.count })),
    }),
  ]);

  return getClientById(id);
}

export async function deleteClient(id: string): Promise<boolean> {
  try {
    await prisma.client.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
