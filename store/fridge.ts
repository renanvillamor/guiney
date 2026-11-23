import { create } from 'zustand';

import { repos } from '@/db/client';
import type { FridgeItem } from '@/types/models';

export type FridgeDraft = Pick<FridgeItem, 'name' | 'quantity' | 'unit' | 'expiry_date'>;

interface FridgeState {
  /** Soonest expiry first; items without a date come last. */
  items: FridgeItem[];
  load: () => Promise<void>;
  add: (draft: FridgeDraft) => Promise<void>;
  update: (id: string, draft: FridgeDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useFridge = create<FridgeState>((set, get) => ({
  items: [],

  load: async () => {
    const items = await repos().fridge.list();
    set({
      items: items.sort(
        (a, b) =>
          (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999') ||
          a.name.localeCompare(b.name),
      ),
    });
  },

  add: async (draft) => {
    await repos().fridge.add({ ...draft, added_at: new Date().toISOString(), source: 'manual' });
    await get().load();
  },

  update: async (id, draft) => {
    await repos().fridge.update(id, draft);
    await get().load();
  },

  remove: async (id) => {
    await repos().fridge.remove(id);
    await get().load();
  },
}));
