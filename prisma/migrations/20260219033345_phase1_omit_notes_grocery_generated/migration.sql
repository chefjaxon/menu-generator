-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "client_note" TEXT,
ADD COLUMN     "omit_notes" TEXT;

-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "grocery_generated" BOOLEAN NOT NULL DEFAULT false;
