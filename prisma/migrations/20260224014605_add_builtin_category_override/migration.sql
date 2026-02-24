-- CreateTable
CREATE TABLE "builtin_category_overrides" (
    "original_slug" TEXT NOT NULL,
    "current_slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builtin_category_overrides_pkey" PRIMARY KEY ("original_slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "builtin_category_overrides_current_slug_key" ON "builtin_category_overrides"("current_slug");
