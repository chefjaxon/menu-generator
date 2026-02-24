export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { getAllBuiltinOverrides, renameBuiltinCategory, labelToSlug } from '@/lib/queries/grocery-categories';

async function auth(request: NextRequest) {
  const token = request.cookies.get('menu-gen-session')?.value;
  return token && (await validateSession(token));
}

/** GET /api/grocery-consolidator/categories/builtin
 *  Returns all persisted built-in renames as { [originalSlug]: { currentSlug, label } }
 */
export async function GET(request: NextRequest) {
  if (!(await auth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const overrides = await getAllBuiltinOverrides();
  return NextResponse.json(overrides);
}

/** PATCH /api/grocery-consolidator/categories/builtin
 *  Body: { originalSlug: string, newLabel: string }
 *  Renames a built-in category (label + slug) and migrates CategoryOverride rows.
 *  Returns { originalSlug, currentSlug, label }
 */
export async function PATCH(request: NextRequest) {
  if (!(await auth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const originalSlug = (body.originalSlug ?? '').trim();
  const newLabel = (body.newLabel ?? '').trim();

  if (!originalSlug || !newLabel) {
    return NextResponse.json({ error: 'originalSlug and newLabel are required' }, { status: 400 });
  }
  const newSlug = labelToSlug(newLabel);
  if (!newSlug) {
    return NextResponse.json({ error: 'Invalid category name' }, { status: 400 });
  }

  const result = await renameBuiltinCategory(originalSlug, newLabel);
  return NextResponse.json(result);
}
