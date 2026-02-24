export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import {
  getAllGroceryCategories,
  createGroceryCategory,
  deleteGroceryCategory,
  labelToSlug,
} from '@/lib/queries/grocery-categories';

async function auth(request: NextRequest) {
  const token = request.cookies.get('menu-gen-session')?.value;
  return token && (await validateSession(token));
}

/** GET /api/grocery-consolidator/categories
 *  Returns all custom categories: [{ slug, label, sortOrder }]
 */
export async function GET(request: NextRequest) {
  if (!(await auth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const categories = await getAllGroceryCategories();
  return NextResponse.json(categories);
}

/** POST /api/grocery-consolidator/categories
 *  Body: { label: string }
 *  Creates (or returns existing) custom category. Returns { slug, label, sortOrder }.
 */
export async function POST(request: NextRequest) {
  if (!(await auth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const label = (body.label ?? '').trim();
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }
  const slug = labelToSlug(label);
  if (!slug) {
    return NextResponse.json({ error: 'Invalid category name' }, { status: 400 });
  }
  const category = await createGroceryCategory(label);
  return NextResponse.json(category);
}

/** DELETE /api/grocery-consolidator/categories
 *  Body: { slug: string, reassignTo: string }
 *  Deletes a custom category and migrates all overrides to reassignTo.
 */
export async function DELETE(request: NextRequest) {
  if (!(await auth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const slug = (body.slug ?? '').trim();
  const reassignTo = (body.reassignTo ?? '').trim();
  if (!slug || !reassignTo) {
    return NextResponse.json({ error: 'slug and reassignTo are required' }, { status: 400 });
  }
  await deleteGroceryCategory(slug, reassignTo);
  return NextResponse.json({ ok: true });
}
