-- Add composite index on (menu_id, source) for grocery_items.
-- This accelerates the two new query patterns introduced by the consolidation feature:
--   1. WHERE menu_id = $1 AND source != 'removed'  (getGroceryItemsForMenu)
--   2. WHERE menu_id = $1 AND source = 'removed'   (getRemovedItemsForMenu)
-- No column changes are needed: the existing TEXT source column already accepts 'removed'.
-- The allowed values are: 'recipe', 'manual', 'removed'.

CREATE INDEX IF NOT EXISTS "grocery_items_menu_id_source_idx"
  ON "grocery_items" ("menu_id", "source");
