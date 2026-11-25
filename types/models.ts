/** Row shapes. Field names match SQLite and Supabase columns so rows sync without mapping. */

export interface BaseRow {
  id: string;
  household_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** What callers supply; the repository fills the base columns in. */
export type NewRow<T extends BaseRow> = Omit<T, keyof BaseRow> & { id?: string };

export type BaseUnit = 'g' | 'ml' | 'piece';

export const DIETS = [
  'none',
  'vegetarian',
  'vegan',
  'pescatarian',
  'keto',
  'halal',
  'gluten-free',
  'dairy-free',
] as const;
export type Diet = (typeof DIETS)[number];

export const CATEGORIES = [
  /** A viand: fits breakfast, lunch and dinner alike. */
  'main',
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'soup',
  'side',
  'drink',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Member extends BaseRow {
  name: string;
  /** An emoji from the avatar set. */
  avatar: string;
  diet: Diet;
  allergies: string[];
  liked_ingredients: string[];
  disliked_ingredients: string[];
  preferred_cuisines: string[];
  /** The Supabase account that owns this profile, once linked. */
  user_id: string | null;
}

export interface Recipe extends BaseRow {
  title: string;
  description: string;
  photo_uri: string | null;
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
  tags: string[];
  category: Category;
  cuisine: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  copied_from_recipe_id: string | null;
  /** The web page it was imported from. */
  source_url: string | null;
}

export interface RecipeIngredient extends BaseRow {
  recipe_id: string;
  name: string;
  /** In `unit`. Null means "to taste". */
  quantity: number | null;
  unit: BaseUnit;
  note: string;
  position: number;
}

export interface RecipeStep extends BaseRow {
  recipe_id: string;
  step_number: number;
  instruction: string;
}

export interface FullRecipe extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface FridgeItem extends BaseRow {
  name: string;
  quantity: number | null;
  unit: BaseUnit;
  /** YYYY-MM-DD */
  expiry_date: string | null;
  added_at: string;
  source: 'manual' | 'grocery';
}

export interface PrecookedMeal extends BaseRow {
  name: string;
  recipe_id: string | null;
  /** YYYY-MM-DD */
  prepared_on: string;
  expiry_date: string | null;
  notes: string;
}

export interface MealSlot extends BaseRow {
  name: string;
  order: number;
  /** How many dishes the generator puts in this meal. People can add more. */
  dishes: number;
}

export interface MealPlan extends BaseRow {
  start_date: string;
  end_date: string;
  /** Who the plan feeds. Empty means everyone. */
  member_ids: string[];
}

export interface MealPlanEntry extends BaseRow {
  plan_id: string;
  date: string;
  slot_id: string;
  recipe_id: string | null;
  precooked_meal_id: string | null;
  locked: boolean;
}

export interface GroceryItem extends BaseRow {
  name: string;
  quantity: number | null;
  unit: BaseUnit;
  source: 'plan' | 'manual';
  plan_id: string | null;
  is_bought: boolean;
  bought_at: string | null;
}

export type UnitSystem = 'metric' | 'imperial';

export interface RecipeDraft {
  title: string;
  description: string;
  photo_uri: string | null;
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
  tags: string[];
  category: Category;
  cuisine: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  copied_from_recipe_id: string | null;
  /** The web page it was imported from. */
  source_url: string | null;
  ingredients: { name: string; quantity: number | null; unit: BaseUnit; note: string }[];
  steps: string[];
}
