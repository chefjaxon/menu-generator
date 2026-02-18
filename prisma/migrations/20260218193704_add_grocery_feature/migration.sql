-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "client_selected" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "grocery_items" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'recipe',
    "recipe_item_id" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grocery_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
