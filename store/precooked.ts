import { create } from 'zustand';

import { repos } from '@/db/client';
import type { PrecookedMeal } from '@/types/models';

import { refresh, registerStore } from './refresh';

export type PrecookedDraft = Pick<
  PrecookedMeal,
  'name' | 'recipe_id' | 'prepared_on' | 'expiry_date' | 'notes'
>;

interface PrecookedState {
  /** Oldest first, so it gets eaten first. */
  meals: PrecookedMeal[];
  load: () => Promise<void>;
  add: (draft: PrecookedDraft) => Promise<void>;
  update: (id: string, draft: PrecookedDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePrecooked = create<PrecookedState>((set, get) => ({
  meals: [],

  load: async () => {
    const meals = await repos().precooked.list();
    set({
      meals: meals.sort(
        (a, b) => a.prepared_on.localeCompare(b.prepared_on) || a.name.localeCompare(b.name),
      ),
    });
  },

  add: async (draft) => {
    await repos().precooked.add(draft);
    await get().load();
  },

  update: async (id, draft) => {
    await repos().precooked.update(id, draft);
    await get().load();
  },

  remove: async (id) => {
    await repos().removePrecooked(id);
    await Promise.all([get().load(), refresh('planner')]);
  },
}));

registerStore('precooked', () => usePrecooked.getState().load());
