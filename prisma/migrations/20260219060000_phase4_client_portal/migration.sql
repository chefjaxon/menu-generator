-- Phase 4: Client portal schema additions

-- Add role to users table
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin';

-- Add client portal fields to menus table
ALTER TABLE "menus" ADD COLUMN "published_at" TIMESTAMP(3);
ALTER TABLE "menus" ADD COLUMN "client_token" TEXT;
ALTER TABLE "menus" ADD COLUMN "pantry_token" TEXT;
ALTER TABLE "menus" ADD COLUMN "pantry_submitted" BOOLEAN NOT NULL DEFAULT FALSE;

-- Add unique constraints for tokens
CREATE UNIQUE INDEX "menus_client_token_key" ON "menus"("client_token");
CREATE UNIQUE INDEX "menus_pantry_token_key" ON "menus"("pantry_token");

-- Create client_accounts table
CREATE TABLE "client_accounts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_accounts_client_id_key" ON "client_accounts"("client_id");
CREATE UNIQUE INDEX "client_accounts_email_key" ON "client_accounts"("email");

-- Create client_sessions table
CREATE TABLE "client_sessions" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_sessions_token_key" ON "client_sessions"("token");

-- Add foreign keys
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_sessions" ADD CONSTRAINT "client_sessions_client_account_id_fkey"
    FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
