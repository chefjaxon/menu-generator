-- AlterTable
ALTER TABLE "client_restrictions" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'hard';

-- AlterTable
ALTER TABLE "ingredient_swaps" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "substitute_qty" TEXT,
ADD COLUMN     "substitute_unit" TEXT;
