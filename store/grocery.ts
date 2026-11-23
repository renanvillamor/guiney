import { create } from 'zustand';

import { repos } from '@/db/client';
import { today } from '@/lib/dates';
import { buildGroceryNeeds } from '@/lib/grocery';
import type { GroceryItem } from '@/types/models';

import { useFridge } from './fridge';
import { usePlanner } from './planner';
import { useRecipes } from './recipes';

export type GroceryDraft = Pick<GroceryItem, 'name' | 'quantity' | 'unit'>;

interface GroceryState {
  items: GroceryItem[];
  load: () => Promise<void>;
  /** Rebuilds the plan part of the list. Returns how many things are left to buy. */
  generate: (planIds: string[]) => Promise<number>;
  add: (draft: GroceryDraft) => Promise<void>;
  update: (id: string, draft: GroceryDraft) => Promise<void>;
  setBought: (id: string, bought: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  moveBoughtToFridge: (expiryByItemId: Record<string, string | null>) => Promise<number>;
}

export const useGrocery = create<GroceryState>((set, get) => ({
  items: [],

  load: async () => {
    const items = await repos().grocery.list();
    set({ items: items.sort((a, b) => a.name.localeCompare(b.name)) });
  },

  generate: async (planIds) => {
    const now = today();
    const recipes = new Map(useRecipes.getState().recipes.map((recipe) => [recipe.id, recipe]));
    // Meals already eaten need no shopping; pre-cooked meals never did.
    const ingredients = usePlanner
      .getState()
      .entries.filter((entry) => planIds.includes(entry.plan_id) && entry.date >= now)
      .flatMap((entry) => (entry.recipe_id ? (recipes.get(entry.recipe_id)?.ingredients ?? []) : []));
    const needs = buildGroceryNeeds(
      ingredients,
      useFridge.getState().items,
      get().items.filter((item) => item.is_bought),
      now,
    );
    await repos().grocery.replacePlanItems(planIds[0] ?? null, needs);
    await get().load();
    return needs.length;
  },

  add: async (draft) => {
    await repos().grocery.add({
      ...draft,
      source: 'manual',
      plan_id: null,
      is_bought: false,
      bought_at: null,
    });
    await get().load();
  },

  update: async (id, draft) => {
    await repos().grocery.update(id, draft);
    await get().load();
  },

  setBought: async (id, bought) => {
    // Show the tick at once; the write follows.
    set({ items: get().items.map((item) => (item.id === id ? { ...item, is_bought: bought } : item)) });
    await repos().grocery.setBought(id, bought);
    await get().load();
  },

  remove: async (id) => {
    await repos().grocery.remove(id);
    await get().load();
  },

  moveBoughtToFridge: async (expiryByItemId) => {
    const moved = await repos().grocery.moveBoughtToFridge(expiryByItemId);
    await Promise.all([get().load(), useFridge.getState().load()]);
    return moved;
  },
}));
