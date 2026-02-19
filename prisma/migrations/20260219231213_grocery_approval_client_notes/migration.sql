-- AlterTable
ALTER TABLE "grocery_items" ADD COLUMN     "client_note" TEXT;

-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "grocery_approved" BOOLEAN NOT NULL DEFAULT false;
