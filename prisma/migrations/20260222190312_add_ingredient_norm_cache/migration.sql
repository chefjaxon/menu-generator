-- CreateTable
CREATE TABLE "ingredient_norm_cache" (
    "id" TEXT NOT NULL,
    "keyA" TEXT NOT NULL,
    "keyB" TEXT NOT NULL,
    "should_merge" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_norm_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_norm_cache_keyA_keyB_key" ON "ingredient_norm_cache"("keyA", "keyB");
