import type Database from 'better-sqlite3';

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      instructions  TEXT,
      cuisine_type  TEXT NOT NULL,
      item_type     TEXT NOT NULL DEFAULT 'meal',
      serving_size  INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id         TEXT PRIMARY KEY,
      recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      quantity   TEXT,
      unit       TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

    CREATE TABLE IF NOT EXISTS recipe_protein_swaps (
      id         TEXT PRIMARY KEY,
      recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      protein    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_proteins_recipe ON recipe_protein_swaps(recipe_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_protein_unique ON recipe_protein_swaps(recipe_id, protein);

    CREATE TABLE IF NOT EXISTS recipe_tags (
      id        TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe ON recipe_tags(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag);

    CREATE TABLE IF NOT EXISTS clients (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      items_per_menu  INTEGER NOT NULL DEFAULT 5,
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_proteins (
      id        TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      protein   TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_protein_unique ON client_proteins(client_id, protein);

    CREATE TABLE IF NOT EXISTS client_restrictions (
      id          TEXT PRIMARY KEY,
      client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      restriction TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_restriction_unique ON client_restrictions(client_id, restriction);

    CREATE TABLE IF NOT EXISTS client_cuisine_preferences (
      id           TEXT PRIMARY KEY,
      client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      cuisine_type TEXT NOT NULL,
      weight       INTEGER NOT NULL DEFAULT 3
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_cuisine_unique ON client_cuisine_preferences(client_id, cuisine_type);

    CREATE TABLE IF NOT EXISTS client_menu_composition (
      id        TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      category  TEXT NOT NULL,
      count     INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_composition_unique ON client_menu_composition(client_id, category);

    CREATE TABLE IF NOT EXISTS menus (
      id          TEXT PRIMARY KEY,
      client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      finalized   INTEGER NOT NULL DEFAULT 0,
      week_label  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_menus_client ON menus(client_id);
    CREATE INDEX IF NOT EXISTS idx_menus_finalized ON menus(finalized);

    CREATE TABLE IF NOT EXISTS menu_items (
      id              TEXT PRIMARY KEY,
      menu_id         TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      recipe_id       TEXT NOT NULL REFERENCES recipes(id),
      selected_protein TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}
