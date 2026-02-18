export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateMenu } from '@/lib/menu-engine';
import { generateMenuSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = generateMenuSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await generateMenu(parsed.data.clientId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate menu';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
