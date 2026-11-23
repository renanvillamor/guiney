import { dishKey, type PlannedEntry } from '@/lib/planner';
import type { Need } from '@/lib/grocery';
import type { FullRecipe, NewRow, RecipeDraft, Recipe } from '@/types/models';

import type { Database, Sql } from './database';
import { Repository, type RowContext } from './repository';
import type { TableName, Tables } from './tables';

/** Every table, plus the operations that touch more than one of them. */
export function createRepositories(db: Database, context: RowContext) {
  const members = new Repository('members', context);
  const recipes = new Repository('recipes', context);
  const ingredients = new Repository('recipe_ingredients', context);
  const steps = new Repository('recipe_steps', context);
  const fridge = new Repository('fridge_items', context);
  const precooked = new Repository('precooked_meals', context);
  const slots = new Repository('meal_slots', context);
  const plans = new Repository('meal_plans', context);
  const entries = new Repository('meal_plan_entries', context);
  const grocery = new Repository('grocery_items', context);

  /** Commits, then tells sync there is something to send. */
  async function write<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const result = await db.tx(work);
    db.notifyLocalChange();
    return result;
  }

  function simple<N extends TableName>(repo: Repository<N>) {
    return {
      list: (): Promise<Tables[N][]> => repo.list(db),
      add: (values: NewRow<Tables[N]>) => write((sql) => repo.insert(sql, values)),
      update: (id: string, changes: Parameters<Repository<N>['update']>[2]) =>
        write((sql) => repo.update(sql, id, changes)),
      remove: (id: string) => write((sql) => repo.softDelete(sql, id)),
    };
  }

  async function fullRecipes(): Promise<FullRecipe[]> {
    const [rows, allIngredients, allSteps] = await Promise.all([
      recipes.list(db),
      ingredients.list(db),
      steps.list(db),
    ]);
    const byId = new Map<string, FullRecipe>(
      rows.map((row) => [row.id, { ...row, ingredients: [], steps: [] }]),
    );
    for (const item of allIngredients) byId.get(item.recipe_id)?.ingredients.push(item);
    for (const step of allSteps) byId.get(step.recipe_id)?.steps.push(step);
    for (const recipe of byId.values()) {
      recipe.ingredients.sort((a, b) => a.position - b.position);
      recipe.steps.sort((a, b) => a.step_number - b.step_number);
    }
    return [...byId.values()];
  }

  async function insertRecipe(
    sql: Sql,
    draft: RecipeDraft,
    options: { id?: string; stamp?: string } = {},
  ): Promise<string> {
    const { ingredients: lines, steps: instructions, ...recipe } = draft;
    const row: Recipe = await recipes.insert(sql, { ...recipe, id: options.id }, options.stamp);
    await insertParts(sql, row.id, lines, instructions, options.stamp);
    return row.id;
  }

  async function insertParts(
    sql: Sql,
    recipeId: string,
    lines: RecipeDraft['ingredients'],
    instructions: string[],
    stamp?: string,
  ): Promise<void> {
    for (const [position, line] of lines.entries()) {
      await ingredients.insert(sql, { ...line, recipe_id: recipeId, position }, stamp);
    }
    for (const [index, instruction] of instructions.entries()) {
      await steps.insert(
        sql,
        { recipe_id: recipeId, step_number: index + 1, instruction },
        stamp,
      );
    }
  }

  /**
   * Edits existing rows in place rather than re-creating them. If two people edit a
   * recipe offline, their lines then resolve row by row instead of both surviving.
   */
  async function replaceParts(
    sql: Sql,
    recipeId: string,
    lines: RecipeDraft['ingredients'],
    instructions: string[],
  ): Promise<void> {
    const oldLines = (await ingredients.listWhere(sql, 'recipe_id', recipeId)).sort(
      (a, b) => a.position - b.position,
    );
    for (const [position, line] of lines.entries()) {
      const old = oldLines[position];
      if (!old) {
        await ingredients.insert(sql, { ...line, recipe_id: recipeId, position });
      } else if (
        old.name !== line.name ||
        old.quantity !== line.quantity ||
        old.unit !== line.unit ||
        old.note !== line.note ||
        old.position !== position
      ) {
        await ingredients.update(sql, old.id, { ...line, position });
      }
    }
    for (const extra of oldLines.slice(lines.length)) await ingredients.softDelete(sql, extra.id);

    const oldSteps = (await steps.listWhere(sql, 'recipe_id', recipeId)).sort(
      (a, b) => a.step_number - b.step_number,
    );
    for (const [index, instruction] of instructions.entries()) {
      const old = oldSteps[index];
      const step_number = index + 1;
      if (!old) {
        await steps.insert(sql, { recipe_id: recipeId, step_number, instruction });
      } else if (old.instruction !== instruction || old.step_number !== step_number) {
        await steps.update(sql, old.id, { step_number, instruction });
      }
    }
    for (const extra of oldSteps.slice(instructions.length)) await steps.softDelete(sql, extra.id);
  }

  return {
    db,
    members: simple(members),
    fridge: simple(fridge),
    precooked: simple(precooked),

    recipes: {
      list: fullRecipes,
      add: (draft: RecipeDraft) => write((sql) => insertRecipe(sql, draft)),
      /** For seeding, inside a transaction the caller already holds. */
      insert: insertRecipe,
      update: (id: string, draft: RecipeDraft) =>
        write(async (sql) => {
          const { ingredients: lines, steps: instructions, ...recipe } = draft;
          await recipes.update(sql, id, recipe);
          await replaceParts(sql, id, lines, instructions);
        }),
      /** Also takes it out of plans. Pre-cooked meals made from it stay, unlinked. */
      remove: (id: string) =>
        write(async (sql) => {
          await recipes.softDelete(sql, id);
          await ingredients.softDeleteWhere(sql, 'recipe_id', id);
          await steps.softDeleteWhere(sql, 'recipe_id', id);
          await entries.softDeleteWhere(sql, 'recipe_id', id);
          for (const meal of await precooked.listWhere(sql, 'recipe_id', id)) {
            await precooked.update(sql, meal.id, { recipe_id: null });
          }
        }),
    },

    removePrecooked: (id: string) =>
      write(async (sql) => {
        await precooked.softDelete(sql, id);
        await entries.softDeleteWhere(sql, 'precooked_meal_id', id);
      }),

    slots: {
      ...simple(slots),
      /** Saves the order the ids are given in. */
      reorder: (ids: string[]) =>
        write(async (sql) => {
          for (const [order, id] of ids.entries()) await slots.update(sql, id, { order });
        }),
      remove: (id: string) =>
        write(async (sql) => {
          await slots.softDelete(sql, id);
          await entries.softDeleteWhere(sql, 'slot_id', id);
        }),
    },

    plans: {
      ...simple(plans),
      listEntries: () => entries.list(db),
      /** Replaces every entry of a plan except those unchanged since. */
      saveEntries: (planId: string, next: PlannedEntry[]) =>
        write(async (sql) => {
          const same = (a: PlannedEntry, b: PlannedEntry) =>
            a.date === b.date &&
            a.slot_id === b.slot_id &&
            a.recipe_id === b.recipe_id &&
            a.precooked_meal_id === b.precooked_meal_id &&
            a.locked === b.locked;
          const current = await entries.listWhere(sql, 'plan_id', planId);
          for (const row of current) {
            if (!next.some((entry) => same(entry, row))) await entries.softDelete(sql, row.id);
          }
          for (const entry of next) {
            if (current.some((row) => same(entry, row))) continue;
            await entries.insert(sql, {
              plan_id: planId,
              date: entry.date,
              slot_id: entry.slot_id,
              recipe_id: entry.recipe_id,
              precooked_meal_id: entry.precooked_meal_id,
              locked: entry.locked,
            });
          }
        }),
      /** Adds dishes to a meal, next to what is there. A dish it already has is left alone. */
      addEntries: (planId: string, added: PlannedEntry[]) =>
        write(async (sql) => {
          const current: PlannedEntry[] = await entries.listWhere(sql, 'plan_id', planId);
          for (const entry of added) {
            if (current.some((row) => dishKey(row) === dishKey(entry))) continue;
            current.push(await entries.insert(sql, { plan_id: planId, ...entry }));
          }
        }),
      /** Puts another dish in this one's place. */
      swapEntry: (entryId: string, dish: Pick<PlannedEntry, 'recipe_id' | 'precooked_meal_id'>) =>
        write((sql) =>
          entries.update(sql, entryId, {
            recipe_id: dish.recipe_id,
            precooked_meal_id: dish.precooked_meal_id,
            locked: false,
          }),
        ),
      setLocked: (entryId: string, locked: boolean) =>
        write((sql) => entries.update(sql, entryId, { locked })),
      clearEntry: (entryId: string) => write((sql) => entries.softDelete(sql, entryId)),
      remove: (planId: string) =>
        write(async (sql) => {
          await plans.softDelete(sql, planId);
          await entries.softDeleteWhere(sql, 'plan_id', planId);
          for (const item of await grocery.listWhere(sql, 'plan_id', planId)) {
            if (!item.is_bought) await grocery.softDelete(sql, item.id);
          }
        }),
    },

    grocery: {
      ...simple(grocery),
      /** Swaps unbought plan items for a new list. Manual and bought items stay. */
      replacePlanItems: (planId: string | null, needs: Need[]) =>
        write(async (sql) => {
          for (const item of await grocery.listWhere(sql, 'source', 'plan')) {
            if (!item.is_bought) await grocery.softDelete(sql, item.id);
          }
          for (const need of needs) {
            await grocery.insert(sql, {
              name: need.name,
              quantity: need.quantity,
              unit: need.unit,
              source: 'plan',
              plan_id: planId,
              is_bought: false,
              bought_at: null,
            });
          }
        }),
      setBought: (id: string, bought: boolean) =>
        write((sql) =>
          grocery.update(sql, id, {
            is_bought: bought,
            bought_at: bought ? context.now() : null,
          }),
        ),
      /** Puts every bought item in the fridge and clears it from the list. Returns how many. */
      moveBoughtToFridge: (expiryByItemId: Record<string, string | null>) =>
        write(async (sql) => {
          const bought = await grocery.listWhere(sql, 'is_bought', true);
          for (const item of bought) {
            await fridge.insert(sql, {
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              expiry_date: expiryByItemId[item.id] ?? null,
              added_at: context.now(),
              source: 'grocery',
            });
            await grocery.softDelete(sql, item.id);
          }
          return bought.length;
        }),
    },

    /** For seeding and tests. */
    raw: { members, slots, fridge, precooked },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
