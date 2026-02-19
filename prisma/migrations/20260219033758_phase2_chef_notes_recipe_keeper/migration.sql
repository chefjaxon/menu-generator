-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "chef_notes" TEXT,
ADD COLUMN     "dish_count" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "servings_per_dish" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "recipe_keeper_url" TEXT;
