-- CreateTable
CREATE TABLE "ingredient_swaps" (
    "id" TEXT NOT NULL,
    "recipe_ingredient_id" TEXT NOT NULL,
    "substitute_ingredient" TEXT NOT NULL,
    "restriction" TEXT NOT NULL,

    CONSTRAINT "ingredient_swaps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ingredient_swaps" ADD CONSTRAINT "ingredient_swaps_recipe_ingredient_id_fkey" FOREIGN KEY ("recipe_ingredient_id") REFERENCES "recipe_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
