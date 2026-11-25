import type {
  Category,
  FridgeItem,
  FullRecipe,
  MealSlot,
  Member,
  PrecookedMeal,
} from '@/types/models';

import { daysBetween } from './dates';
import { hasRestrictions, isSafeFor } from './dietary';
import { containsTerm, looselyMatches, normalizeName } from './ingredients';

/**
 * Meal-plan generator. Pure: same input, same plan. Nothing here reads the
 * clock, the database or Math.random.
 */

export interface PlannedEntry {
  date: string;
  slot_id: string;
  recipe_id: string | null;
  precooked_meal_id: string | null;
  locked: boolean;
}

export interface PlannerInput {
  /** Every day of the plan, YYYY-MM-DD, in order. Days before `today` are left alone. */
  dates: string[];
  today: string;
  slots: MealSlot[];
  recipes: FullRecipe[];
  precookedMeals: PrecookedMeal[];
  fridge: FridgeItem[];
  /** The people this plan feeds. */
  members: Member[];
  /** Entries the plan has now. Locked and past ones are kept, the rest are refilled. */
  existing?: PlannedEntry[];
  /** Pre-cooked meals already used by other plans. */
  reservedPrecookedIds?: string[];
  /** Changes tie-breaks between otherwise equal recipes. */
  seed?: number;
}

export interface UnfilledSlot {
  date: string;
  slot_id: string;
  reason: 'no-recipe-for-slot' | 'no-safe-recipe';
}

export interface SkippedPrecooked {
  meal: PrecookedMeal;
  reason: 'unsafe' | 'unknown-ingredients' | 'expired' | 'no-slot';
}

export interface PlannerResult {
  entries: PlannedEntry[];
  unfilled: UnfilledSlot[];
  skippedPrecooked: SkippedPrecooked[];
}

/** Two entries with the same key are the same dish in the same meal. */
export const dishKey = (entry: PlannedEntry): string =>
  `${entry.date}/${entry.slot_id}/${entry.recipe_id ?? entry.precooked_meal_id}`;

/** How much each consideration counts. Hard rules are filters, not weights. */
const WEIGHTS = {
  fridgeCoverage: 4,
  expiringIngredient: 0.75,
  likedIngredient: 1,
  dislikedIngredient: -2,
  preferredCuisine: 1.5,
  bestCategory: 1,
  accompaniment: 2,
  newCategory: 3,
  usedBefore: -2,
  usedRecently: -4,
  usedSameDay: -20,
  jitter: 0.5,
} as const;

const EXPIRING_WITHIN_DAYS = 3;
const RECENT_DAYS = 2;

/** Slot name keyword to the categories it takes, best match first. */
const SLOT_RULES: [keyword: string, categories: Category[]][] = [
  ['breakfast', ['breakfast', 'main']],
  ['almusal', ['breakfast', 'main']],
  ['brunch', ['breakfast', 'main', 'lunch']],
  ['lunch', ['lunch', 'main', 'dinner', 'soup']],
  ['tanghalian', ['lunch', 'main', 'dinner', 'soup']],
  ['baon', ['lunch', 'main', 'dinner']],
  ['dinner', ['dinner', 'main', 'lunch', 'soup']],
  ['supper', ['dinner', 'main', 'lunch', 'soup']],
  ['hapunan', ['dinner', 'main', 'lunch', 'soup']],
  ['snack', ['snack', 'dessert', 'drink']],
  ['merienda', ['snack', 'dessert', 'drink']],
  ['dessert', ['dessert']],
  ['soup', ['soup']],
  ['side', ['side']],
  ['drink', ['drink']],
];

const MAIN_MEALS: Category[] = ['lunch', 'main', 'dinner', 'soup'];
const ACCOMPANIMENTS: Category[] = ['side', 'soup', 'dessert', 'drink'];
/** Rice or a drink can come back at every meal of the day. */
const DAILY: Category[] = ['side', 'drink'];

/** Categories a slot accepts. A custom name we cannot read accepts main meals. */
export function categoriesForSlot(slotName: string): Category[] {
  const name = normalizeName(slotName);
  const rule = SLOT_RULES.find(([keyword]) => containsTerm(name, keyword));
  return rule ? rule[1] : MAIN_MEALS;
}

const isMainMeal = (categories: Category[]) =>
  categories.includes('lunch') || categories.includes('dinner');

/** Categories a slot accepts once it has its main dish. */
export function extrasForSlot(slotName: string): Category[] {
  const categories = categoriesForSlot(slotName);
  if (isMainMeal(categories)) return [...new Set([...categories, ...ACCOMPANIMENTS])];
  if (categories.includes('breakfast')) return [...categories, ...DAILY];
  return categories;
}

/** Lunch and dinner are usually more than one dish. */
export const defaultDishes = (slotName: string): number =>
  isMainMeal(categoriesForSlot(slotName)) ? 2 : 1;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StockLine {
  item: FridgeItem;
  /** Null when the amount is unknown; then it counts as available. */
  left: number | null;
}

/** Fridge stock that shrinks as the plan uses it, so one chicken is not counted seven times. */
class Stock {
  private lines: StockLine[];

  constructor(fridge: FridgeItem[]) {
    this.lines = [...fridge]
      .sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999'))
      .map((item) => ({ item, left: item.quantity }));
  }

  private usable(name: string, date: string): StockLine[] {
    return this.lines.filter(
      ({ item, left }) =>
        looselyMatches(item.name, name) &&
        (item.expiry_date === null || item.expiry_date >= date) &&
        (left === null || left > 0),
    );
  }

  /** 0 to 1: how much of this ingredient the fridge covers on `date`. */
  coverage(name: string, quantity: number | null, unit: string, date: string): number {
    const lines = this.usable(name, date);
    if (lines.length === 0) return 0;
    if (quantity === null || quantity <= 0) return 1;
    let have = 0;
    for (const { item, left } of lines) {
      // Unknown amount or a unit we cannot compare: present, but not measurably enough.
      if (left === null || item.unit !== unit) return Math.max(0.5, Math.min(1, have / quantity));
      have += left;
    }
    return Math.min(1, have / quantity);
  }

  expiringSoon(name: string, date: string): boolean {
    return this.usable(name, date).some(
      ({ item }) =>
        item.expiry_date !== null && daysBetween(date, item.expiry_date) <= EXPIRING_WITHIN_DAYS,
    );
  }

  use(recipe: FullRecipe, date: string): void {
    for (const ingredient of recipe.ingredients) {
      let need = ingredient.quantity;
      if (need === null) continue;
      for (const line of this.usable(ingredient.name, date)) {
        if (line.left === null || line.item.unit !== ingredient.unit) continue;
        const taken = Math.min(line.left, need);
        line.left -= taken;
        need -= taken;
        if (need <= 0) break;
      }
    }
  }
}

/** Average liking across members, so a big household does not drown out the fridge. */
function preferenceScore(recipe: FullRecipe, members: Member[]): number {
  if (members.length === 0) return 0;
  const contains = (wanted: string) =>
    recipe.ingredients.some((item) => looselyMatches(item.name, wanted)) ||
    containsTerm(normalizeName(recipe.title), normalizeName(wanted));
  const cuisine = normalizeName(recipe.cuisine);

  let total = 0;
  for (const member of members) {
    total += member.liked_ingredients.filter(contains).length * WEIGHTS.likedIngredient;
    total += member.disliked_ingredients.filter(contains).length * WEIGHTS.dislikedIngredient;
    if (cuisine && member.preferred_cuisines.some((name) => normalizeName(name) === cuisine)) {
      total += WEIGHTS.preferredCuisine;
    }
  }
  return total / members.length;
}

function fridgeScore(recipe: FullRecipe, stock: Stock, date: string): number {
  if (recipe.ingredients.length === 0) return 0;
  let covered = 0;
  let expiring = 0;
  for (const { name, quantity, unit } of recipe.ingredients) {
    covered += stock.coverage(name, quantity, unit, date);
    if (stock.expiringSoon(name, date)) expiring += 1;
  }
  return (
    (covered / recipe.ingredients.length) * WEIGHTS.fridgeCoverage +
    expiring * WEIGHTS.expiringIngredient
  );
}

function varietyScore(recipeId: string, date: string, usedOn: Map<string, string[]>): number {
  const days = usedOn.get(recipeId) ?? [];
  let score = days.length * WEIGHTS.usedBefore;
  if (days.includes(date)) score += WEIGHTS.usedSameDay;
  else if (days.some((day) => Math.abs(daysBetween(day, date)) <= RECENT_DAYS)) {
    score += WEIGHTS.usedRecently;
  }
  return score;
}

export function generatePlan(input: PlannerInput): PlannerResult {
  const { dates, today, recipes, precookedMeals, fridge, members, existing = [] } = input;
  const slots = [...input.slots].sort((a, b) => a.order - b.order);
  const slotIds = new Set(slots.map((slot) => slot.id));
  const random = seededRandom(input.seed ?? 1);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const precookedById = new Map(precookedMeals.map((meal) => [meal.id, meal]));

  const key = (date: string, slotId: string) => `${date}/${slotId}`;
  const meals = new Map<string, PlannedEntry[]>();
  const usedOn = new Map<string, string[]>();
  const usedPrecooked = new Set(input.reservedPrecookedIds ?? []);
  const stock = new Stock(fridge);

  const place = (entry: PlannedEntry) => {
    const at = key(entry.date, entry.slot_id);
    meals.set(at, [...(meals.get(at) ?? []), entry]);
    if (entry.precooked_meal_id) usedPrecooked.add(entry.precooked_meal_id);
    const recipe = entry.recipe_id ? recipeById.get(entry.recipe_id) : undefined;
    if (recipe) {
      usedOn.set(recipe.id, [...(usedOn.get(recipe.id) ?? []), entry.date]);
      if (entry.date >= today) stock.use(recipe, entry.date);
    }
  };

  // What the person locked, and days already gone, stay exactly as they are.
  const planned = new Set(dates);
  for (const entry of existing) {
    if (!planned.has(entry.date) || !slotIds.has(entry.slot_id)) continue;
    if (entry.locked || entry.date < today) place(entry);
  }

  const openDates = dates.filter((date) => date >= today);
  const dishesAt = (date: string, slot: MealSlot) => meals.get(key(date, slot.id)) ?? [];
  const isFull = (date: string, slot: MealSlot) =>
    dishesAt(date, slot).length >= Math.max(1, slot.dishes);
  const recipeOf = (entry: PlannedEntry) => {
    const id = entry.recipe_id ?? precookedById.get(entry.precooked_meal_id ?? '')?.recipe_id;
    return id ? recipeById.get(id) : undefined;
  };
  /** A pre-cooked meal nobody linked to a recipe is taken for a main dish. */
  const hasMain = (date: string, slot: MealSlot) => {
    const categories = categoriesForSlot(slot.name);
    return dishesAt(date, slot).some((entry) => {
      const recipe = recipeOf(entry);
      return !recipe || categories.includes(recipe.category);
    });
  };
  const hasRecipe = (date: string, slot: MealSlot, recipeId: string) =>
    dishesAt(date, slot).some((entry) => recipeOf(entry)?.id === recipeId);

  // 1. Pre-cooked meals first, the ones that spoil soonest before the others.
  const skippedPrecooked: SkippedPrecooked[] = [];
  const waiting = precookedMeals
    .filter((meal) => !usedPrecooked.has(meal.id))
    .sort(
      (a, b) =>
        (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999') ||
        a.prepared_on.localeCompare(b.prepared_on) ||
        a.id.localeCompare(b.id),
    );

  for (const meal of waiting) {
    if (meal.expiry_date !== null && meal.expiry_date < today) {
      skippedPrecooked.push({ meal, reason: 'expired' });
      continue;
    }
    const recipe = meal.recipe_id ? recipeById.get(meal.recipe_id) : undefined;
    if (!recipe && hasRestrictions(members)) {
      // Nobody told us what is in it, so it cannot be called safe.
      skippedPrecooked.push({ meal, reason: 'unknown-ingredients' });
      continue;
    }
    const described = recipe ?? { title: meal.name, ingredients: [], carbs_g: null };
    const noted = {
      ...described,
      ingredients: [...described.ingredients, { name: meal.name, note: meal.notes }],
    };
    if (!isSafeFor(noted, members)) {
      skippedPrecooked.push({ meal, reason: 'unsafe' });
      continue;
    }

    const isMainFor = (slot: MealSlot) => {
      const categories = categoriesForSlot(slot.name);
      return recipe
        ? categories.includes(recipe.category)
        : // Nobody said what it is, so it is not put at breakfast.
          isMainMeal(categories) || categories.includes('soup');
    };
    const isExtraFor = (slot: MealSlot) =>
      recipe !== undefined && !isMainFor(slot) && extrasForSlot(slot.name).includes(recipe.category);
    const open = openDates
      .filter((date) => usableOn(meal, date))
      .flatMap((date) =>
        slots.filter((slot) => !isFull(date, slot)).map((slot) => ({ date, slot })),
      );
    const spot =
      open.find(({ date, slot }) =>
        isMainFor(slot)
          ? !hasMain(date, slot)
          : // A side must leave room for the main dish.
            isExtraFor(slot) &&
            (hasMain(date, slot) || dishesAt(date, slot).length + 1 < slot.dishes),
      ) ??
      // Better a second main dish than food that spoils.
      open.find(({ slot }) => isMainFor(slot));
    if (!spot) {
      skippedPrecooked.push({ meal, reason: 'no-slot' });
      continue;
    }
    place({
      date: spot.date,
      slot_id: spot.slot.id,
      recipe_id: null,
      precooked_meal_id: meal.id,
      locked: false,
    });
    // Eating the pre-cooked adobo counts as having adobo.
    if (recipe) usedOn.set(recipe.id, [...(usedOn.get(recipe.id) ?? []), spot.date]);
  }

  // 2. Fill what is left from saved recipes everyone can eat.
  const safe = recipes.filter((recipe) => isSafeFor(recipe, members));
  const taste = new Map(safe.map((recipe) => [recipe.id, preferenceScore(recipe, members)]));
  const unfilled: UnfilledSlot[] = [];

  const choose = (
    date: string,
    candidates: FullRecipe[],
    bonus: (recipe: FullRecipe) => number,
  ): FullRecipe | null => {
    let best: { recipe: FullRecipe; score: number } | null = null;
    for (const recipe of candidates) {
      const score =
        fridgeScore(recipe, stock, date) +
        (taste.get(recipe.id) ?? 0) +
        varietyScore(recipe.id, date, usedOn) +
        bonus(recipe) +
        random() * WEIGHTS.jitter;
      if (!best || score > best.score) best = { recipe, score };
    }
    return best?.recipe ?? null;
  };
  const put = (date: string, slot: MealSlot, recipe: FullRecipe) =>
    place({
      date,
      slot_id: slot.id,
      recipe_id: recipe.id,
      precooked_meal_id: null,
      locked: false,
    });

  for (const date of openDates) {
    // Main dishes of the whole day first, so lunch's second dish never takes dinner's main.
    for (const slot of slots) {
      if (isFull(date, slot) || hasMain(date, slot)) continue;
      const categories = categoriesForSlot(slot.name);
      const fits = (recipe: FullRecipe) => categories.includes(recipe.category);
      const main = choose(date, safe.filter(fits), (recipe) =>
        recipe.category === categories[0] || recipe.category === 'main' ? WEIGHTS.bestCategory : 0,
      );
      if (main) put(date, slot, main);
      else if (dishesAt(date, slot).length === 0) {
        unfilled.push({
          date,
          slot_id: slot.id,
          reason: recipes.some(fits) ? 'no-safe-recipe' : 'no-recipe-for-slot',
        });
      }
    }

    for (const slot of slots) {
      const extras = extrasForSlot(slot.name);
      while (hasMain(date, slot) && !isFull(date, slot)) {
        const served = dishesAt(date, slot).map((entry) => recipeOf(entry)?.category);
        const extra = choose(
          date,
          safe.filter(
            (recipe) =>
              extras.includes(recipe.category) &&
              !hasRecipe(date, slot, recipe.id) &&
              // A dish fewer is better than the same dish twice in a day.
              (DAILY.includes(recipe.category) || !usedOn.get(recipe.id)?.includes(date)),
          ),
          (recipe) =>
            (served.includes(recipe.category) ? 0 : WEIGHTS.newCategory) +
            (ACCOMPANIMENTS.includes(recipe.category) ? WEIGHTS.accompaniment : 0),
        );
        if (!extra) break;
        put(date, slot, extra);
      }
    }
  }

  const slotOrder = new Map(slots.map((slot, index) => [slot.id, index]));
  return {
    entries: [...meals.values()].flat().sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (slotOrder.get(a.slot_id) ?? 0) - (slotOrder.get(b.slot_id) ?? 0),
    ),
    unfilled,
    skippedPrecooked,
  };
}

/** May this pre-cooked meal be eaten on this day? */
export const usableOn = (meal: PrecookedMeal, date: string): boolean =>
  date >= meal.prepared_on && (meal.expiry_date === null || date <= meal.expiry_date);
