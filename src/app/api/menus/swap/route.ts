import { NextRequest, NextResponse } from 'next/server';
import { getSwapSuggestions } from '@/lib/menu-engine';
import { updateMenuItem } from '@/lib/queries/menus';
import { swapMenuItemSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // If newRecipeId is provided, perform the swap
  if (body.newRecipeId) {
    const parsed = swapMenuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const success = await updateMenuItem(
      parsed.data.menuItemId,
      parsed.data.newRecipeId,
      parsed.data.selectedProtein || null
    );

    if (!success) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }

  // Otherwise, return swap suggestions
  const { menuId, menuItemId } = body;
  if (!menuId || !menuItemId) {
    return NextResponse.json({ error: 'menuId and menuItemId are required' }, { status: 400 });
  }

  try {
    const result = await getSwapSuggestions(menuId, menuItemId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get suggestions';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
