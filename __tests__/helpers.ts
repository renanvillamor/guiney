import { DatabaseSync } from 'node:sqlite';

import { Database, type SqlDriver } from '@/db/database';
import { migrate } from '@/db/migrations';
import { createRepositories } from '@/db/repositories';
import type {
  BaseUnit,
  FridgeItem,
  FullRecipe,
  MealSlot,
  Member,
  PrecookedMeal,
} from '@/types/models';

const base = {
  household_id: 'home',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
};

type Line = [name: string, quantity?: number | null, unit?: BaseUnit];

export function recipe(
  id: string,
  lines: Line[] = [],
  overrides: Partial<FullRecipe> = {},
): FullRecipe {
  return {
    ...base,
    id,
    title: id,
    description: '',
    photo_uri: null,
    prep_time_min: 10,
    cook_time_min: 10,
    servings: 2,
    tags: [],
    category: 'dinner',
    cuisine: '',
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    copied_from_recipe_id: null,
    steps: [],
    ...overrides,
    ingredients: lines.map(([name, quantity = 100, unit = 'g'], position) => ({
      ...base,
      id: `${id}-${position}`,
      recipe_id: id,
      name,
      quantity,
      unit,
      note: '',
      position,
    })),
  };
}

export function member(overrides: Partial<Member> = {}): Member {
  return {
    ...base,
    id: 'member',
    name: 'Ana',
    avatar: '',
    diet: 'none',
    allergies: [],
    liked_ingredients: [],
    disliked_ingredients: [],
    preferred_cuisines: [],
    user_id: null,
    ...overrides,
  };
}

export function fridgeItem(
  name: string,
  quantity: number | null = 100,
  unit: BaseUnit = 'g',
  expiry_date: string | null = null,
): FridgeItem {
  return {
    ...base,
    id: `fridge-${name}-${quantity}-${expiry_date}`,
    name,
    quantity,
    unit,
    expiry_date,
    added_at: base.created_at,
    source: 'manual',
  };
}

export function precooked(id: string, overrides: Partial<PrecookedMeal> = {}): PrecookedMeal {
  return {
    ...base,
    id,
    name: id,
    recipe_id: null,
    prepared_on: '2026-11-22',
    expiry_date: null,
    notes: '',
    ...overrides,
  };
}

export const slot = (name: string, order: number): MealSlot => ({
  ...base,
  id: name.toLowerCase(),
  name,
  order,
});

/** The real schema and repositories on an in-memory SQLite. */
export async function testDatabase(options: { householdId?: string; prefix?: string } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const driver: SqlDriver = {
    execAsync: async (sql) => sqlite.exec(sql),
    runAsync: async (sql, params) => sqlite.prepare(sql).run(...params),
    getAllAsync: async <T>(sql: string, params: (string | number | null)[]) =>
      sqlite.prepare(sql).all(...params).map((row) => ({ ...row })) as T[],
  };
  const db = new Database(driver);
  await migrate(db);

  const state = { householdId: options.householdId ?? 'home', clock: Date.UTC(2026, 10, 24) };
  let counter = 0;
  const context = {
    newId: () => `${options.prefix ?? 'id'}-${(counter += 1)}`,
    now: () => new Date((state.clock += 1)).toISOString(),
    householdId: () => state.householdId,
  };
  return { db, context, state, repos: createRepositories(db, context) };
}
