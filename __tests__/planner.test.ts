import { allergenHits, dietConflict } from '@/lib/dietary';
import { dateRange, planRange } from '@/lib/dates';
import { categoriesForSlot, generatePlan, type PlannerInput } from '@/lib/planner';
import { sampleDrafts } from '@/db/seed';
import { DIETS, type FullRecipe } from '@/types/models';

import { fridgeItem, member, precooked, recipe, slot } from './helpers';

const TODAY = '2026-11-24'; // a Tuesday
const WEEK = dateRange(TODAY, '2026-11-30');
const SLOTS = [slot('Breakfast', 0), slot('Lunch', 1), slot('Dinner', 2), slot('Snack', 3)];

const BOOK: FullRecipe[] = [
  recipe('oats', [['Oats']], { category: 'breakfast' }),
  recipe('eggs', [['Eggs']], { category: 'breakfast' }),
  recipe('adobo', [['Chicken'], ['Soy sauce']], { category: 'dinner', cuisine: 'Filipino' }),
  recipe('salmon', [['Salmon']], { category: 'dinner', cuisine: 'Japanese' }),
  recipe('monggo', [['Mung beans']], { category: 'lunch', cuisine: 'Filipino' }),
  recipe('prawn curry', [['Prawns']], { category: 'lunch', cuisine: 'Thai' }),
  recipe('fruit', [['Mango']], { category: 'snack' }),
];

const plan = (overrides: Partial<PlannerInput> = {}) =>
  generatePlan({
    dates: WEEK,
    today: TODAY,
    slots: SLOTS,
    recipes: BOOK,
    precookedMeals: [],
    fridge: [],
    members: [member()],
    ...overrides,
  });

const recipeIds = (result: ReturnType<typeof plan>) =>
  result.entries.flatMap((entry) => entry.recipe_id ?? []);

describe('filling a plan', () => {
  it('fills every slot once, only from saved recipes', () => {
    const { entries, unfilled } = plan();
    expect(entries).toHaveLength(WEEK.length * SLOTS.length);
    expect(new Set(entries.map((e) => `${e.date}/${e.slot_id}`)).size).toBe(entries.length);
    expect(unfilled).toEqual([]);
    const known = new Set(BOOK.map((r) => r.id));
    expect(recipeIds(plan()).every((id) => known.has(id))).toBe(true);
  });

  it('matches recipe category to slot', () => {
    const byId = new Map(BOOK.map((r) => [r.id, r]));
    for (const entry of plan().entries) {
      const name = SLOTS.find((s) => s.id === entry.slot_id)!.name;
      expect(categoriesForSlot(name)).toContain(byId.get(entry.recipe_id!)!.category);
    }
  });

  it('is pure: same input, same plan, input untouched', () => {
    const input = { fridge: [fridgeItem('Chicken', 500)], seed: 7 };
    const before = JSON.stringify(input);
    expect(plan(input)).toEqual(plan(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('leaves days that have passed alone', () => {
    const { entries } = plan({ dates: dateRange('2026-11-23', '2026-11-25') });
    expect(entries.some((entry) => entry.date < TODAY)).toBe(false);
  });

  it('does not repeat a meal on the same day when there is a choice', () => {
    for (const date of WEEK) {
      const today = plan().entries.filter((entry) => entry.date === date).map((e) => e.recipe_id);
      expect(new Set(today).size).toBe(today.length);
    }
  });

  it('says why a slot stayed empty', () => {
    const noSnacks = plan({ recipes: BOOK.filter((r) => r.category !== 'snack') });
    expect(noSnacks.unfilled).toHaveLength(WEEK.length);
    expect(noSnacks.unfilled[0]).toMatchObject({ slot_id: 'snack', reason: 'no-recipe-for-slot' });

    const unsafe = plan({ members: [member({ allergies: ['mango'] })] });
    expect(unsafe.unfilled[0]).toMatchObject({ slot_id: 'snack', reason: 'no-safe-recipe' });
  });

  it('handles an empty cookbook, no slots and no members', () => {
    expect(plan({ recipes: [] }).entries).toEqual([]);
    expect(plan({ slots: [] }).entries).toEqual([]);
    expect(plan({ members: [] }).entries).toHaveLength(WEEK.length * SLOTS.length);
  });
});

describe('hard rules', () => {
  it('never plans an allergen for anyone eating', () => {
    const ids = recipeIds(
      plan({ members: [member({ id: 'a' }), member({ id: 'b', allergies: ['Shellfish'] })] }),
    );
    expect(ids).not.toContain('prawn curry');
  });

  it('holds even when the allergen is a favourite and fills the fridge', () => {
    const ids = recipeIds(
      plan({
        members: [
          member({ allergies: ['Shellfish'], liked_ingredients: ['prawns'], preferred_cuisines: ['Thai'] }),
        ],
        fridge: [fridgeItem('Prawns', 5000, 'g', TODAY)],
      }),
    );
    expect(ids).not.toContain('prawn curry');
  });

  it('leaves a slot empty rather than break a rule', () => {
    const result = plan({
      recipes: [recipe('prawn curry', [['Prawns']])],
      members: [member({ allergies: ['Shellfish'] })],
    });
    expect(result.entries).toEqual([]);
  });

  it('respects every selected diet', () => {
    const ids = recipeIds(
      plan({ members: [member({ id: 'a', diet: 'vegetarian' }), member({ id: 'b' })] }),
    );
    expect(ids).not.toContain('adobo');
    expect(ids).not.toContain('salmon');
    expect(ids).toContain('monggo');
  });

  it('holds across allergies, diets and seeds on the sample cookbook', () => {
    const book = sampleDrafts().map((draft, index) =>
      recipe(
        draft.title,
        draft.ingredients.map((i) => [i.name, i.quantity, i.unit]),
        { id: String(index), title: draft.title, category: draft.category, carbs_g: draft.carbs_g },
      ),
    );
    const meals = book.map((r) => precooked(`cooked ${r.id}`, { recipe_id: r.id }));
    const people = [
      ...['Fish', 'Soy', 'Eggs', 'Wheat / gluten', 'Sesame', 'banana'].map((a) => member({ allergies: [a] })),
      ...DIETS.map((diet) => member({ diet })),
    ];
    for (const person of people) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const { entries } = plan({ recipes: book, precookedMeals: meals, members: [person], seed });
        for (const entry of entries) {
          const id = entry.recipe_id ?? meals.find((m) => m.id === entry.precooked_meal_id)?.recipe_id;
          const eaten = book.find((r) => r.id === id)!;
          expect(allergenHits(eaten, person.allergies)).toEqual([]);
          expect(dietConflict(eaten, person.diet)).toBeNull();
        }
      }
    }
  });
});

describe('preferences', () => {
  const pair = [
    recipe('chicken pot', [['Chicken']], { cuisine: 'French' }),
    recipe('beef pot', [['Beef']], { cuisine: 'Korean' }),
  ];
  const firstDinner = (overrides: Partial<PlannerInput>) =>
    plan({ dates: [TODAY], slots: [slot('Dinner', 0)], recipes: pair, ...overrides }).entries[0]!
      .recipe_id;

  it('prefers liked ingredients and cuisines, avoids disliked ones', () => {
    expect(firstDinner({ members: [member({ liked_ingredients: ['beef'] })] })).toBe('beef pot');
    expect(firstDinner({ members: [member({ disliked_ingredients: ['beef'] })] })).toBe('chicken pot');
    expect(firstDinner({ members: [member({ preferred_cuisines: ['korean'] })] })).toBe('beef pot');
  });

  it('prefers what is already in the fridge', () => {
    expect(firstDinner({ fridge: [fridgeItem('Beef', 500)] })).toBe('beef pot');
    expect(firstDinner({ fridge: [fridgeItem('Chicken', 500)] })).toBe('chicken pot');
  });

  it('does not count expired food', () => {
    const fridge = [fridgeItem('Beef', 500, 'g', '2026-11-20'), fridgeItem('Chicken', 100)];
    expect(firstDinner({ fridge })).toBe('chicken pot');
  });

  it('a dislike is not a ban', () => {
    const result = plan({
      dates: [TODAY],
      slots: [slot('Dinner', 0)],
      recipes: [pair[1]!],
      members: [member({ disliked_ingredients: ['beef'] })],
    });
    expect(recipeIds(result)).toEqual(['beef pot']);
  });
});

describe('pre-cooked meals', () => {
  it('go in the earliest suitable slots, soonest to expire first', () => {
    const { entries } = plan({
      precookedMeals: [
        precooked('later', { recipe_id: 'adobo', expiry_date: '2026-11-28' }),
        precooked('sooner', { recipe_id: 'adobo', expiry_date: '2026-11-25' }),
      ],
    });
    const cooked = entries.filter((e) => e.precooked_meal_id);
    expect(cooked.map((e) => [e.date, e.slot_id, e.precooked_meal_id])).toEqual([
      [TODAY, 'lunch', 'sooner'],
      [TODAY, 'dinner', 'later'],
    ]);
  });

  it('are never scheduled past their expiry date, and each only once', () => {
    const meals = Array.from({ length: 8 }, (_, i) =>
      precooked(`m${i}`, { recipe_id: 'adobo', expiry_date: '2026-11-25' }),
    );
    const { entries, skippedPrecooked } = plan({ precookedMeals: meals });
    const cooked = entries.filter((e) => e.precooked_meal_id);
    expect(cooked.every((e) => e.date <= '2026-11-25')).toBe(true);
    expect(new Set(cooked.map((e) => e.precooked_meal_id)).size).toBe(cooked.length);
    expect(cooked).toHaveLength(4);
    expect(skippedPrecooked.map((s) => s.reason)).toEqual(Array(4).fill('no-slot'));
  });

  it('skips expired, unsafe and already reserved ones', () => {
    const { entries, skippedPrecooked } = plan({
      members: [member({ allergies: ['Shellfish'] })],
      precookedMeals: [
        precooked('old', { recipe_id: 'adobo', expiry_date: '2026-11-23' }),
        precooked('prawns', { recipe_id: 'prawn curry' }),
        precooked('taken', { recipe_id: 'adobo' }),
      ],
      reservedPrecookedIds: ['taken'],
    });
    expect(entries.some((e) => e.precooked_meal_id)).toBe(false);
    expect(skippedPrecooked.map((s) => [s.meal.id, s.reason])).toEqual([
      ['old', 'expired'],
      ['prawns', 'unsafe'],
    ]);
  });

  it('with unknown ingredients are used only when nobody has restrictions', () => {
    const mystery = [precooked('Leftover stew')];
    expect(plan({ precookedMeals: mystery }).entries[1]!.precooked_meal_id).toBe('Leftover stew');
    const careful = plan({ precookedMeals: mystery, members: [member({ allergies: ['Fish'] })] });
    expect(careful.entries.some((e) => e.precooked_meal_id)).toBe(false);
    expect(careful.skippedPrecooked[0]!.reason).toBe('unknown-ingredients');
  });

  it('are checked by name and notes as well as recipe', () => {
    const extra = precooked('Adobo', { recipe_id: 'adobo', notes: 'with shrimp' });
    const result = plan({ precookedMeals: [extra], members: [member({ allergies: ['Shellfish'] })] });
    expect(result.skippedPrecooked[0]!.reason).toBe('unsafe');
  });
});

describe('regenerating', () => {
  it('keeps locked entries and refills the rest', () => {
    const locked = {
      date: WEEK[2]!,
      slot_id: 'dinner',
      recipe_id: 'salmon',
      precooked_meal_id: null,
      locked: true,
    };
    const first = plan().entries.map((e) =>
      e.date === locked.date && e.slot_id === 'dinner' ? locked : e,
    );
    for (let seed = 1; seed <= 10; seed += 1) {
      const { entries } = plan({ existing: first, seed });
      expect(entries).toContainEqual(locked);
      expect(entries).toHaveLength(first.length);
    }
  });

  it('keeps past entries and does not reuse a locked pre-cooked meal', () => {
    const past = { date: '2026-11-23', slot_id: 'dinner', recipe_id: 'adobo', precooked_meal_id: null, locked: false };
    const held = { date: WEEK[3]!, slot_id: 'lunch', recipe_id: null, precooked_meal_id: 'm', locked: true };
    const { entries } = plan({
      dates: dateRange('2026-11-23', '2026-11-30'),
      existing: [past, held],
      precookedMeals: [precooked('m', { recipe_id: 'adobo' })],
    });
    expect(entries).toContainEqual(past);
    expect(entries.filter((e) => e.precooked_meal_id === 'm')).toEqual([held]);
  });

  it('drops entries for slots that no longer exist', () => {
    const orphan = { date: TODAY, slot_id: 'gone', recipe_id: 'adobo', precooked_meal_id: null, locked: true };
    expect(plan({ existing: [orphan] }).entries).not.toContainEqual(orphan);
  });
});

describe('slots and ranges', () => {
  it('reads custom slot names', () => {
    expect(categoriesForSlot('Merienda')).toContain('snack');
    expect(categoriesForSlot('Midnight snacks')).toContain('snack');
    expect(categoriesForSlot('Second breakfast')).toEqual(['breakfast']);
    expect(categoriesForSlot('Family time')).toContain('dinner');
  });

  it('computes plan ranges', () => {
    expect(planRange('this-week', TODAY)).toEqual({ start: '2026-11-23', end: '2026-11-29' });
    expect(planRange('next-week', TODAY)).toEqual({ start: '2026-11-30', end: '2026-12-06' });
    expect(planRange('two-weeks', TODAY)).toEqual({ start: TODAY, end: '2026-12-07' });
    expect(planRange('this-week', '2026-11-29').start).toBe('2026-11-23');
  });
});
