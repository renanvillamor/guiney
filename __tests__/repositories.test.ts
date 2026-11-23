import { DEFAULT_SLOTS, sampleDrafts, seed } from '@/db/seed';
import { readSettings, writeSettings } from '@/db/settings';
import { migrate } from '@/db/migrations';

import { testDatabase } from './helpers';

const draft = () => ({ ...sampleDrafts()[0]! });

describe('schema', () => {
  it('migrates once and can be run again', async () => {
    const { db } = await testDatabase();
    await migrate(db);
    expect(await db.first('PRAGMA user_version')).toEqual({ user_version: 1 });
  });

  it('seeds slots, two members and ten recipes', async () => {
    const { db, repos } = await testDatabase();
    await seed(db, repos);
    expect((await repos.slots.list()).map((s) => s.name)).toEqual(DEFAULT_SLOTS);
    expect(await repos.members.list()).toHaveLength(2);
    const recipes = await repos.recipes.list();
    expect(recipes).toHaveLength(10);
    for (const title of ['Chicken adobo', 'Sinigang na baboy', 'Tinolang manok']) {
      expect(recipes.map((r) => r.title)).toContain(title);
    }
    expect(recipes.every((r) => r.ingredients.length > 0 && r.steps.length > 0)).toBe(true);
    expect((await readSettings(db)).seeded).toBe(true);
  });

  it('rolls back a failed transaction and keeps working', async () => {
    const { db } = await testDatabase();
    await expect(
      db.tx(async (sql) => {
        await writeSettings(sql, { theme: 'dark' });
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    expect(await readSettings(db)).toEqual({});
    await writeSettings(db, { theme: 'light' });
    expect((await readSettings(db)).theme).toBe('light');
  });
});

describe('recipes', () => {
  it('round-trips lists, numbers and order', async () => {
    const { repos } = await testDatabase();
    const id = await repos.recipes.add(draft());
    const [saved] = await repos.recipes.list();
    expect(saved).toMatchObject({ id, title: 'Chicken adobo', tags: ['classic', 'one pot'], carbs_g: 6 });
    expect(saved!.ingredients.map((i) => i.name)).toEqual(draft().ingredients.map((i) => i.name));
    expect(saved!.steps.map((s) => s.instruction)).toEqual(draft().steps);
  });

  it('keeps row identity when editing, and drops removed lines', async () => {
    const { repos } = await testDatabase();
    const id = await repos.recipes.add(draft());
    const before = (await repos.recipes.list())[0]!;
    const edited = draft();
    edited.ingredients = edited.ingredients.slice(0, 2).map((i) => ({ ...i, note: 'changed' }));
    edited.steps = ['Only step'];
    await repos.recipes.update(id, edited);
    const after = (await repos.recipes.list())[0]!;
    expect(after.ingredients.map((i) => i.id)).toEqual(before.ingredients.slice(0, 2).map((i) => i.id));
    expect(after.ingredients.every((i) => i.note === 'changed')).toBe(true);
    expect(after.steps.map((s) => s.instruction)).toEqual(['Only step']);
  });

  it('copies independently', async () => {
    const { repos } = await testDatabase();
    const original = await repos.recipes.add(draft());
    const copy = await repos.recipes.add({
      ...draft(),
      title: 'Chicken adobo (My version)',
      copied_from_recipe_id: original,
    });
    await repos.recipes.update(copy, { ...draft(), title: 'Mine', steps: ['New'], copied_from_recipe_id: original });
    const rows = await repos.recipes.list();
    expect(rows.find((r) => r.id === original)!.steps).toHaveLength(draft().steps.length);
    expect(rows.find((r) => r.id === copy)).toMatchObject({ title: 'Mine', copied_from_recipe_id: original });
  });

  it('soft deletes, leaving plans and pre-cooked meals consistent', async () => {
    const { db, repos } = await testDatabase();
    const id = await repos.recipes.add(draft());
    const meal = await repos.precooked.add({ name: 'Adobo', recipe_id: id, prepared_on: '2026-11-24', expiry_date: null, notes: '' });
    const plan = await repos.plans.add({ start_date: '2026-11-23', end_date: '2026-11-29', member_ids: [] });
    await repos.plans.setEntry(plan.id, { date: '2026-11-24', slot_id: 's', recipe_id: id, precooked_meal_id: null, locked: false });
    await repos.recipes.remove(id);
    expect(await repos.recipes.list()).toEqual([]);
    expect(await repos.plans.listEntries()).toEqual([]);
    expect((await repos.precooked.list())[0]).toMatchObject({ id: meal.id, recipe_id: null });
    expect(await db.first('SELECT COUNT(*) AS n FROM recipes WHERE deleted_at IS NOT NULL')).toEqual({ n: 1 });
  });
});

describe('plans', () => {
  it('setEntry replaces, saveEntries keeps unchanged rows', async () => {
    const { repos } = await testDatabase();
    const plan = await repos.plans.add({ start_date: '2026-11-23', end_date: '2026-11-29', member_ids: ['a'] });
    const entry = { date: '2026-11-24', slot_id: 's', recipe_id: 'r1', precooked_meal_id: null, locked: false };
    await repos.plans.setEntry(plan.id, entry);
    await repos.plans.setEntry(plan.id, { ...entry, recipe_id: 'r2' });
    const rows = await repos.plans.listEntries();
    expect(rows.map((r) => r.recipe_id)).toEqual(['r2']);
    await repos.plans.saveEntries(plan.id, [
      { ...entry, recipe_id: 'r2' },
      { ...entry, slot_id: 't', recipe_id: 'r3' },
    ]);
    const next = await repos.plans.listEntries();
    expect(next.find((r) => r.slot_id === 's')!.id).toBe(rows[0]!.id);
    expect(next).toHaveLength(2);
  });

  it('a slot can be reordered, and removing it clears its meals', async () => {
    const { db, repos } = await testDatabase();
    await seed(db, repos);
    const ids = (await repos.slots.list()).map((s) => s.id);
    await repos.slots.reorder([...ids].reverse());
    const sorted = (await repos.slots.list()).sort((a, b) => a.order - b.order);
    expect(sorted.map((s) => s.id)).toEqual([...ids].reverse());
    await repos.plans.setEntry('p', { date: '2026-11-24', slot_id: ids[0]!, recipe_id: 'r', precooked_meal_id: null, locked: false });
    await repos.slots.remove(ids[0]!);
    expect(await repos.plans.listEntries()).toEqual([]);
  });
});

describe('groceries', () => {
  const manual = { name: 'Dish soap', quantity: 1, unit: 'piece' as const, source: 'manual' as const, plan_id: null, is_bought: false, bought_at: null };

  it('a new list replaces unbought plan items only', async () => {
    const { repos } = await testDatabase();
    await repos.grocery.add(manual);
    await repos.grocery.replacePlanItems('p', [
      { name: 'Rice', quantity: 500, unit: 'g' },
      { name: 'Garlic', quantity: 20, unit: 'g' },
    ]);
    const rice = (await repos.grocery.list()).find((i) => i.name === 'Rice')!;
    await repos.grocery.setBought(rice.id, true);
    await repos.grocery.replacePlanItems('p', [{ name: 'Eggs', quantity: 6, unit: 'piece' }]);
    expect((await repos.grocery.list()).map((i) => i.name)).toEqual(['Dish soap', 'Rice', 'Eggs']);
  });

  it('moves bought items to the fridge and off the list', async () => {
    const { repos } = await testDatabase();
    const soap = await repos.grocery.add(manual);
    const rice = await repos.grocery.add({ ...manual, name: 'Rice', quantity: 500, unit: 'g' });
    await repos.grocery.setBought(rice.id, true);
    expect((await repos.grocery.list()).find((i) => i.id === rice.id)!.bought_at).not.toBeNull();
    expect(await repos.grocery.moveBoughtToFridge({ [rice.id]: '2026-12-31' })).toBe(1);
    expect((await repos.grocery.list()).map((i) => i.id)).toEqual([soap.id]);
    expect(await repos.fridge.list()).toEqual([
      expect.objectContaining({ name: 'Rice', quantity: 500, unit: 'g', expiry_date: '2026-12-31', source: 'grocery' }),
    ]);
  });
});
