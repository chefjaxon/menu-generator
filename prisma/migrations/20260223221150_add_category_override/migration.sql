-- CreateTable
CREATE TABLE "category_overrides" (
    "id" TEXT NOT NULL,
    "ingredient_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_overrides_ingredient_name_key" ON "category_overrides"("ingredient_name");
