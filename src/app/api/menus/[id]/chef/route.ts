import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: menuId } = await params;
  const { chefId } = await request.json();

  if (!chefId) {
    return NextResponse.json({ error: 'chefId required' }, { status: 400 });
  }

  // Upsert: remove existing assignments for this menu, then create the new one
  await prisma.$transaction([
    prisma.chefAssignment.deleteMany({ where: { menuId } }),
    prisma.chefAssignment.create({
      data: { id: nanoid(), chefId, menuId },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: menuId } = await params;
  await prisma.chefAssignment.deleteMany({ where: { menuId } });
  return NextResponse.json({ ok: true });
}
