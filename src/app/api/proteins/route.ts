import { NextRequest, NextResponse } from 'next/server';
import { getAllProteins, addProtein } from '@/lib/queries/proteins';

export const dynamic = 'force-dynamic';

export async function GET() {
  const proteins = await getAllProteins();
  return NextResponse.json(proteins);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = (body.name || '').trim().toLowerCase();

  if (!name) {
    return NextResponse.json({ error: 'Protein name is required' }, { status: 400 });
  }

  const existing = await getAllProteins();
  if (existing.includes(name)) {
    return NextResponse.json({ error: 'Protein already exists' }, { status: 409 });
  }

  await addProtein(name);
  return NextResponse.json({ name }, { status: 201 });
}
