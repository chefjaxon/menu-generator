export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateGroceryItemsFromMenu } from '@/lib/queries/grocery';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = await generateGroceryItemsFromMenu(id);
  return NextResponse.json(items);
}
