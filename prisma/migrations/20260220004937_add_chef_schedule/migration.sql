-- CreateTable
CREATE TABLE "chef_schedules" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chef_schedules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chef_schedules" ADD CONSTRAINT "chef_schedules_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "chefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chef_schedules" ADD CONSTRAINT "chef_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
