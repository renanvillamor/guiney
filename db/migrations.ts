import type { Database } from './database';

const BASE = `
  id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1`;

/**
 * `dirty` is local only: 1 means the row has edits the server has not seen.
 * Append new migrations; never edit one that has shipped.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  CREATE TABLE members (${BASE},
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    diet TEXT NOT NULL DEFAULT 'none',
    allergies TEXT NOT NULL DEFAULT '[]',
    liked_ingredients TEXT NOT NULL DEFAULT '[]',
    disliked_ingredients TEXT NOT NULL DEFAULT '[]',
    preferred_cuisines TEXT NOT NULL DEFAULT '[]',
    user_id TEXT
  );

  CREATE TABLE recipes (${BASE},
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo_uri TEXT,
    prep_time_min INTEGER NOT NULL DEFAULT 0,
    cook_time_min INTEGER NOT NULL DEFAULT 0,
    servings INTEGER NOT NULL DEFAULT 1,
    tags TEXT NOT NULL DEFAULT '[]',
    category TEXT NOT NULL,
    cuisine TEXT NOT NULL DEFAULT '',
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    copied_from_recipe_id TEXT
  );

  CREATE TABLE recipe_ingredients (${BASE},
    recipe_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece')),
    note TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX recipe_ingredients_recipe ON recipe_ingredients (recipe_id);

  CREATE TABLE recipe_steps (${BASE},
    recipe_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL
  );
  CREATE INDEX recipe_steps_recipe ON recipe_steps (recipe_id);

  CREATE TABLE fridge_items (${BASE},
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece')),
    expiry_date TEXT,
    added_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('manual', 'grocery'))
  );

  CREATE TABLE precooked_meals (${BASE},
    name TEXT NOT NULL,
    recipe_id TEXT,
    prepared_on TEXT NOT NULL,
    expiry_date TEXT,
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE meal_slots (${BASE},
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL
  );

  CREATE TABLE meal_plans (${BASE},
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    member_ids TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE meal_plan_entries (${BASE},
    plan_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    recipe_id TEXT,
    precooked_meal_id TEXT,
    locked INTEGER NOT NULL DEFAULT 0,
    CHECK ((recipe_id IS NULL) <> (precooked_meal_id IS NULL))
  );
  CREATE INDEX meal_plan_entries_plan ON meal_plan_entries (plan_id);

  CREATE TABLE grocery_items (${BASE},
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece')),
    source TEXT NOT NULL CHECK (source IN ('plan', 'manual')),
    plan_id TEXT,
    is_bought INTEGER NOT NULL DEFAULT 0,
    bought_at TEXT
  );
  `,
];

export async function migrate(db: Database): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const statements = (MIGRATIONS[version] ?? '').split(';').filter((part) => part.trim() !== '');
    await db.tx(async (sql) => {
      for (const statement of statements) await sql.run(statement);
      await sql.run(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
