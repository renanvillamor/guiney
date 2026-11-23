import { create } from 'zustand';

import { repos } from '@/db/client';
import type { Member } from '@/types/models';

export type MemberDraft = Pick<
  Member,
  | 'name'
  | 'avatar'
  | 'diet'
  | 'allergies'
  | 'liked_ingredients'
  | 'disliked_ingredients'
  | 'preferred_cuisines'
>;

interface HouseholdState {
  members: Member[];
  load: () => Promise<void>;
  add: (draft: MemberDraft) => Promise<void>;
  update: (id: string, draft: Partial<MemberDraft>) => Promise<void>;
  /** Marks a profile as belonging to the signed-in account. */
  link: (id: string, userId: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHousehold = create<HouseholdState>((set, get) => ({
  members: [],

  load: async () => {
    const members = await repos().members.list();
    set({ members: members.sort((a, b) => a.name.localeCompare(b.name)) });
  },

  add: async (draft) => {
    await repos().members.add({ ...draft, user_id: null });
    await get().load();
  },

  update: async (id, draft) => {
    await repos().members.update(id, draft);
    await get().load();
  },

  link: async (id, userId) => {
    for (const member of get().members) {
      if (userId !== null && member.user_id === userId && member.id !== id) {
        await repos().members.update(member.id, { user_id: null });
      }
    }
    await repos().members.update(id, { user_id: userId });
    await get().load();
  },

  remove: async (id) => {
    await repos().members.remove(id);
    await get().load();
  },
}));
