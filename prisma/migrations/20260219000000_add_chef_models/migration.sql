-- CreateTable: chefs
CREATE TABLE "chefs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chef_sessions
CREATE TABLE "chef_sessions" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chef_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chef_assignments
CREATE TABLE "chef_assignments" (
    "id" TEXT NOT NULL,
    "chef_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,

    CONSTRAINT "chef_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chefs_email_key" ON "chefs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "chef_sessions_token_key" ON "chef_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "chef_assignments_chef_id_menu_id_key" ON "chef_assignments"("chef_id", "menu_id");

-- AddForeignKey
ALTER TABLE "chef_sessions" ADD CONSTRAINT "chef_sessions_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "chefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chef_assignments" ADD CONSTRAINT "chef_assignments_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "chefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chef_assignments" ADD CONSTRAINT "chef_assignments_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
