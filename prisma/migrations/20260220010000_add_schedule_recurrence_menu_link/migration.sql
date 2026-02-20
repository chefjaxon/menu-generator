-- AlterTable
ALTER TABLE "chef_schedules" ADD COLUMN "recurrence_id" TEXT;
ALTER TABLE "chef_schedules" ADD COLUMN "menu_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chef_schedules_menu_id_key" ON "chef_schedules"("menu_id");

-- AddForeignKey
ALTER TABLE "chef_schedules" ADD CONSTRAINT "chef_schedules_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
