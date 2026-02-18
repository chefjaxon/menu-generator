import { NextRequest, NextResponse } from 'next/server';
import { getAllProteinGroups, createProteinGroup } from '@/lib/queries/protein-groups';

export const dynamic = 'force-dynamic';

export async function GET() {
  const groups = await getAllProteinGroups();
  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = (body.name || '').trim().toLowerCase();
  const members: string[] = body.members || [];

  if (!name) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  if (members.length === 0) {
    return NextResponse.json({ error: 'At least one member protein is required' }, { status: 400 });
  }

  const existing = await getAllProteinGroups();
  if (existing.find((g) => g.name === name)) {
    return NextResponse.json({ error: 'Group already exists' }, { status: 409 });
  }

  const group = await createProteinGroup(name, members);
  return NextResponse.json(group, { status: 201 });
}
