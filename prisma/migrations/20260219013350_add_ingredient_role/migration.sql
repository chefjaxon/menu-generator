-- DropIndex
DROP INDEX "grocery_items_menu_id_source_idx";

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'core';
