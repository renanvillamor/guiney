import type {
  BaseRow,
  FridgeItem,
  GroceryItem,
  MealPlan,
  MealPlanEntry,
  MealSlot,
  Member,
  PrecookedMeal,
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from '@/types/models';

import type { SqlValue } from './database';

/** One description per table drives SQLite encoding and Supabase sync. */

export type ColumnKind = 'text' | 'number' | 'boolean' | 'json';

export interface Tables {
  members: Member;
  recipes: Recipe;
  recipe_ingredients: RecipeIngredient;
  recipe_steps: RecipeStep;
  fridge_items: FridgeItem;
  precooked_meals: PrecookedMeal;
  meal_slots: MealSlot;
  meal_plans: MealPlan;
  meal_plan_entries: MealPlanEntry;
  grocery_items: GroceryItem;
}
export type TableName = keyof Tables;

type OwnColumns<T extends BaseRow> = Record<Exclude<keyof T, keyof BaseRow>, ColumnKind>;
type Schema = { [N in TableName]: OwnColumns<Tables[N]> };

export const COLUMNS: Schema = {
  members: {
    name: 'text',
    avatar: 'text',
    diet: 'text',
    allergies: 'json',
    liked_ingredients: 'json',
    disliked_ingredients: 'json',
    preferred_cuisines: 'json',
    user_id: 'text',
  },
  recipes: {
    title: 'text',
    description: 'text',
    photo_uri: 'text',
    prep_time_min: 'number',
    cook_time_min: 'number',
    servings: 'number',
    tags: 'json',
    category: 'text',
    cuisine: 'text',
    calories: 'number',
    protein_g: 'number',
    carbs_g: 'number',
    fat_g: 'number',
    copied_from_recipe_id: 'text',
  },
  recipe_ingredients: {
    recipe_id: 'text',
    name: 'text',
    quantity: 'number',
    unit: 'text',
    note: 'text',
    position: 'number',
  },
  recipe_steps: { recipe_id: 'text', step_number: 'number', instruction: 'text' },
  fridge_items: {
    name: 'text',
    quantity: 'number',
    unit: 'text',
    expiry_date: 'text',
    added_at: 'text',
    source: 'text',
  },
  precooked_meals: {
    name: 'text',
    recipe_id: 'text',
    prepared_on: 'text',
    expiry_date: 'text',
    notes: 'text',
  },
  meal_slots: { name: 'text', order: 'number', dishes: 'number' },
  meal_plans: { start_date: 'text', end_date: 'text', member_ids: 'json' },
  meal_plan_entries: {
    plan_id: 'text',
    date: 'text',
    slot_id: 'text',
    recipe_id: 'text',
    precooked_meal_id: 'text',
    locked: 'boolean',
  },
  grocery_items: {
    name: 'text',
    quantity: 'number',
    unit: 'text',
    source: 'text',
    plan_id: 'text',
    is_bought: 'boolean',
    bought_at: 'text',
  },
};

/** Parents before children, the order rows must be pushed and pulled in. */
export const SYNC_ORDER: TableName[] = [
  'members',
  'recipes',
  'recipe_ingredients',
  'recipe_steps',
  'fridge_items',
  'precooked_meals',
  'meal_slots',
  'meal_plans',
  'meal_plan_entries',
  'grocery_items',
];

/** A photo path only means something on the phone that took it. */
export const DEVICE_ONLY: Partial<Record<TableName, string[]>> = { recipes: ['photo_uri'] };

export const BASE_COLUMNS = ['id', 'household_id', 'created_at', 'updated_at', 'deleted_at'] as const;

export function columnsOf(table: TableName): string[] {
  return [...BASE_COLUMNS, ...Object.keys(COLUMNS[table])];
}

function kindOf(table: TableName, column: string): ColumnKind {
  return (COLUMNS[table] as Record<string, ColumnKind>)[column] ?? 'text';
}

export type RawRow = Record<string, SqlValue>;

export function encode(table: TableName, column: string, value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  switch (kindOf(table, column)) {
    case 'json':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 1 : 0;
    case 'number':
      return Number(value);
    case 'text':
      return String(value);
  }
}

export function decodeRow<N extends TableName>(table: N, raw: RawRow): Tables[N] {
  const row: Record<string, unknown> = {};
  for (const column of columnsOf(table)) {
    const value = raw[column] ?? null;
    const kind = kindOf(table, column);
    if (kind === 'json') row[column] = typeof value === 'string' ? JSON.parse(value) : [];
    else if (kind === 'boolean') row[column] = value === 1;
    else row[column] = value;
  }
  return row as unknown as Tables[N];
}
