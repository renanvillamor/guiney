import { buildGroceryNeeds, groceryListText, mergeNeeds, subtractStock } from '@/lib/grocery';
import { toBase } from '@/lib/units';
import type { BaseUnit, GroceryItem } from '@/types/models';

const TODAY = '2026-11-24';
const line = (name: string, quantity: number | null, unit: BaseUnit = 'g') => ({
  name,
  quantity,
  unit,
});

describe('mergeNeeds', () => {
  it('adds up the same ingredient whatever the case, plural or accents', () => {
    expect(
      mergeNeeds([line('Tomatoes', 2, 'piece'), line(' tomato ', 3, 'piece'), line('TOMATO', 1, 'piece')]),
    ).toEqual([line('Tomatoes', 6, 'piece')]);
  });

  it('merges compatible units after conversion', () => {
    const cup = toBase(1, 'cup');
    const spoon = toBase(2, 'tbsp');
    const [merged, ...rest] = mergeNeeds([
      line('Soy sauce', cup.quantity, cup.unit),
      line('soy sauce', spoon.quantity, spoon.unit),
    ]);
    expect(rest).toHaveLength(0);
    expect(merged!.quantity).toBeCloseTo(266.16, 1);
  });

  it('keeps incompatible units apart', () => {
    expect(mergeNeeds([line('Onion', 2, 'piece'), line('Onion', 150, 'g')])).toHaveLength(2);
  });

  it('folds "to taste" into a measured line, or keeps it once', () => {
    expect(mergeNeeds([line('Salt', null), line('Salt', 10)])).toEqual([line('Salt', 10)]);
    expect(mergeNeeds([line('Salt', null), line('salt', null)])).toEqual([line('Salt', null)]);
  });

  it('does not change what it was given', () => {
    const input = [line('Rice', 100), line('Rice', 50)];
    mergeNeeds(input);
    expect(input).toEqual([line('Rice', 100), line('Rice', 50)]);
  });
});

describe('subtractStock', () => {
  it('drops what is fully in stock and reduces what is partly in stock', () => {
    expect(
      subtractStock(
        [line('Chicken', 1000), line('Garlic', 40), line('Rice', 500)],
        [line('chicken', 400), line('Garlic', 40)],
        TODAY,
      ),
    ).toEqual([line('Chicken', 600), line('Rice', 500)]);
  });

  it('adds up several packs in the fridge', () => {
    expect(
      subtractStock([line('Eggs', 12, 'piece')], [line('Egg', 6, 'piece'), line('Eggs', 4, 'piece')], TODAY),
    ).toEqual([line('Eggs', 2, 'piece')]);
  });

  it('ignores expired stock but counts food expiring today', () => {
    const milk = (expiry_date: string) => ({ ...line('Milk', 500, 'ml'), expiry_date });
    expect(subtractStock([line('Milk', 500, 'ml')], [milk('2026-11-23')], TODAY)).toHaveLength(1);
    expect(subtractStock([line('Milk', 500, 'ml')], [milk(TODAY)], TODAY)).toHaveLength(0);
  });

  it('treats unknown stock and "to taste" as covered', () => {
    expect(subtractStock([line('Salt', null)], [line('Salt', 5)], TODAY)).toHaveLength(0);
    expect(subtractStock([line('Pepper', 5)], [line('Pepper', null)], TODAY)).toHaveLength(0);
  });

  it('does not subtract across units it cannot convert', () => {
    expect(subtractStock([line('Onion', 2, 'piece')], [line('Onion', 500, 'g')], TODAY)).toEqual([
      line('Onion', 2, 'piece'),
    ]);
  });

  it('does not mistake one ingredient for another', () => {
    expect(subtractStock([line('Rice flour', 100)], [line('Rice', 900)], TODAY)).toHaveLength(1);
  });

  it('is not fooled by floating point', () => {
    expect(subtractStock([line('Oil', 0.3, 'ml')], [line('Oil', 0.1, 'ml'), line('Oil', 0.2, 'ml')], TODAY)).toEqual([]);
  });
});

describe('buildGroceryNeeds', () => {
  it('merges, then subtracts the fridge and the bag, sorted by name', () => {
    expect(
      buildGroceryNeeds(
        [line('Rice', 300), line('Garlic', 20), line('rice', 200), line('Eggs', 2, 'piece')],
        [line('Eggs', 6, 'piece')],
        [line('Rice', 100)],
        TODAY,
      ),
    ).toEqual([line('Garlic', 20), line('Rice', 400)]);
  });
});

describe('groceryListText', () => {
  const item = (name: string, quantity: number | null, is_bought = false): GroceryItem => ({
    id: name,
    household_id: 'home',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    name,
    quantity,
    unit: 'g',
    source: 'manual',
    plan_id: null,
    is_bought,
    bought_at: null,
  });

  it('lists what is left to buy in the chosen system', () => {
    const items = [item('Rice', 1500), item('Salt', null), item('Garlic', 20, true)];
    expect(groceryListText(items, 'metric')).toBe('Grocery list from Guiney\n\n- Rice: 1.5 kg\n- Salt');
    expect(groceryListText(items, 'imperial')).toContain('- Rice: 3.31 lb');
  });

  it('is empty when everything is bought', () => {
    expect(groceryListText([item('Rice', 1, true)], 'metric')).toBe('');
  });
});
