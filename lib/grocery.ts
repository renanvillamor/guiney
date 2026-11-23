import type { BaseUnit, FridgeItem, GroceryItem, RecipeIngredient, UnitSystem } from '@/types/models';

import { normalizeName } from './ingredients';
import { formatQuantity } from './units';

export interface Need {
  name: string;
  /** Null means an amount is not known ("to taste"). */
  quantity: number | null;
  unit: BaseUnit;
}

type IngredientLike = Pick<RecipeIngredient, 'name' | 'quantity' | 'unit'>;

const keyOf = (name: string, unit: BaseUnit) => `${normalizeName(name)}|${unit}`;

/** Amounts smaller than this are rounding noise, not something to shop for. */
const EPSILON = 0.01;

/**
 * Adds up ingredients with the same name and base unit. A "to taste" line joins a
 * measured line of the same name in any unit, because buying that covers it.
 */
export function mergeNeeds(ingredients: IngredientLike[]): Need[] {
  const merged = new Map<string, Need>();
  const toTaste = new Map<string, Need>();

  for (const { name, quantity, unit } of ingredients) {
    const plain = normalizeName(name);
    if (!plain) continue;
    if (quantity === null) {
      if (!toTaste.has(plain)) toTaste.set(plain, { name: name.trim(), quantity: null, unit });
      continue;
    }
    const key = keyOf(name, unit);
    const line = merged.get(key);
    if (line && line.quantity !== null) line.quantity += quantity;
    else merged.set(key, { name: name.trim(), quantity, unit });
  }

  const measured = new Set([...merged.values()].map((line) => normalizeName(line.name)));
  const loose = [...toTaste].filter(([plain]) => !measured.has(plain)).map(([, line]) => line);
  return [...merged.values(), ...loose];
}

type StockLike = Pick<FridgeItem, 'name' | 'quantity' | 'unit'> & { expiry_date?: string | null };

/**
 * What is still missing after using what is in stock. Expired food does not count.
 * Stock of unknown amount, or any amount against a "to taste" need, covers it fully.
 * Stock in a unit that cannot be converted (g against pieces) cannot be subtracted.
 */
export function subtractStock(needs: Need[], stock: StockLike[], today: string): Need[] {
  const usable = stock.filter((item) => !item.expiry_date || item.expiry_date >= today);

  return needs.flatMap((need) => {
    const plain = normalizeName(need.name);
    const same = usable.filter((item) => normalizeName(item.name) === plain);
    if (same.length === 0) return [need];
    if (need.quantity === null) return [];
    if (same.some((item) => item.quantity === null)) return [];

    const have = same
      .filter((item) => item.unit === need.unit)
      .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const left = need.quantity - have;
    return left > EPSILON ? [{ ...need, quantity: left }] : [];
  });
}

/** Ingredients of every planned recipe, merged, minus fridge and what is already in the bag. */
export function buildGroceryNeeds(
  plannedIngredients: IngredientLike[],
  fridge: StockLike[],
  alreadyBought: StockLike[],
  today: string,
): Need[] {
  return subtractStock(mergeNeeds(plannedIngredients), [...fridge, ...alreadyBought], today).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}

/** Plain text for the share sheet. Bought items are left out. */
export function groceryListText(items: GroceryItem[], system: UnitSystem): string {
  const open = items.filter((item) => !item.is_bought);
  if (open.length === 0) return '';
  const lines = open.map((item) => {
    const amount = formatQuantity(item.quantity, item.unit, system);
    return amount ? `- ${item.name}: ${amount}` : `- ${item.name}`;
  });
  return ['Grocery list from Guiney', '', ...lines].join('\n');
}
