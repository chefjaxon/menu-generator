import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createChef } from '@/lib/chef-auth';

export async function GET() {
  const chefs = await prisma.chef.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  return NextResponse.json(chefs);
}

export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
  }

  try {
    const chef = await createChef(name, email, password);
    return NextResponse.json(chef, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }
}
