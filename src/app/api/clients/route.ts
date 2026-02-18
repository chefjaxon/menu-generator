export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAllClients, createClient } from '@/lib/queries/clients';
import { clientCreateSchema } from '@/lib/validations';

export async function GET() {
  const clients = await getAllClients();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = clientCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const client = await createClient(parsed.data);
  return NextResponse.json(client, { status: 201 });
}
