import { NextRequest, NextResponse } from 'next/server';
import { getProteinGroupById, updateProteinGroup, deleteProteinGroup } from '@/lib/queries/protein-groups';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const group = await getProteinGroupById(id);
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
  return NextResponse.json(group);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const name = (body.name || '').trim().toLowerCase();
  const members: string[] = body.members || [];

  if (!name) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  if (members.length === 0) {
    return NextResponse.json({ error: 'At least one member protein is required' }, { status: 400 });
  }

  const group = await updateProteinGroup(id, name, members);
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  return NextResponse.json(group);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteProteinGroup(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
