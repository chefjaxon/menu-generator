export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { getAllCategoryOverrides, upsertCategoryOverride } from '@/lib/queries/category-overrides';

/** GET /api/grocery-consolidator/category-override
 *  Returns all user-taught overrides as { [ingredientName]: category }
 */
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const overrides = await getAllCategoryOverrides();
  return NextResponse.json(overrides);
}

/** POST /api/grocery-consolidator/category-override
 *  Body: { ingredientName: string, category: string }
 *  Upserts a single override, teaching the system for all future consolidations.
 */
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('menu-gen-session')?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const ingredientName = (body.ingredientName ?? '').toLowerCase().trim();
  const category = (body.category ?? '').trim();
  if (!ingredientName || !category) {
    return NextResponse.json({ error: 'ingredientName and category are required' }, { status: 400 });
  }
  await upsertCategoryOverride(ingredientName, category);
  return NextResponse.json({ ok: true });
}
