import { create } from 'zustand';

import { repos } from '@/db/client';
import { dateRange, today } from '@/lib/dates';
import { generatePlan, type PlannedEntry, type PlannerResult } from '@/lib/planner';
import type { MealPlan, MealPlanEntry, MealSlot, Member } from '@/types/models';

import { useFridge } from './fridge';
import { useHousehold } from './household';
import { usePrecooked } from './precooked';
import { useRecipes } from './recipes';
import { registerStore } from './refresh';

interface PlannerState {
  slots: MealSlot[];
  /** Earliest start first. */
  plans: MealPlan[];
  entries: MealPlanEntry[];
  /** The plan the Planner tab shows, once someone picked one. */
  selectedId: string | null;
  /** What the generator could not do, per plan, until the next run. */
  notes: Record<string, string[]>;
  load: () => Promise<void>;
  select: (planId: string) => void;
  setNotes: (planId: string, notes: string[]) => void;

  createPlan: (start: string, end: string, memberIds: string[]) => Promise<string>;
  setMembers: (planId: string, memberIds: string[]) => Promise<void>;
  removePlan: (planId: string) => Promise<void>;
  /** Fills the plan. Locked and past meals stay. */
  generate: (planId: string) => Promise<PlannerResult>;

  setEntry: (planId: string, entry: Omit<PlannedEntry, 'locked'>) => Promise<void>;
  setLocked: (entryId: string, locked: boolean) => Promise<void>;
  clearEntry: (entryId: string) => Promise<void>;

  addSlot: (name: string) => Promise<void>;
  renameSlot: (id: string, name: string) => Promise<void>;
  reorderSlots: (ids: string[]) => Promise<void>;
  removeSlot: (id: string) => Promise<void>;
}

/** The members a plan feeds. An empty list, or one whose members all left, means everyone. */
export function planMembers(plan: MealPlan, members: Member[]): Member[] {
  const chosen = members.filter((member) => plan.member_ids.includes(member.id));
  return chosen.length > 0 ? chosen : members;
}

/** Two phones can fill the same slot while offline. The newest meal wins. */
function newestPerSlot(entries: MealPlanEntry[]): MealPlanEntry[] {
  const bySlot = new Map<string, MealPlanEntry>();
  for (const entry of entries) {
    const key = `${entry.plan_id}/${entry.date}/${entry.slot_id}`;
    const other = bySlot.get(key);
    if (!other || entry.updated_at > other.updated_at) bySlot.set(key, entry);
  }
  return [...bySlot.values()];
}

export const usePlanner = create<PlannerState>((set, get) => ({
  slots: [],
  plans: [],
  entries: [],
  selectedId: null,
  notes: {},

  select: (planId) => set({ selectedId: planId }),
  setNotes: (planId, notes) => set({ notes: { ...get().notes, [planId]: notes } }),

  load: async () => {
    const { slots, plans } = repos();
    const [slotRows, planRows, entryRows] = await Promise.all([
      slots.list(),
      plans.list(),
      plans.listEntries(),
    ]);
    set({
      slots: slotRows.sort((a, b) => a.order - b.order),
      plans: planRows.sort((a, b) => a.start_date.localeCompare(b.start_date)),
      entries: newestPerSlot(entryRows),
    });
  },

  createPlan: async (start, end, memberIds) => {
    const plan = await repos().plans.add({
      start_date: start,
      end_date: end,
      member_ids: memberIds,
    });
    await get().load();
    return plan.id;
  },

  setMembers: async (planId, memberIds) => {
    await repos().plans.update(planId, { member_ids: memberIds });
    await get().load();
  },

  removePlan: async (planId) => {
    await repos().plans.remove(planId);
    await get().load();
  },

  generate: async (planId) => {
    const plan = get().plans.find((row) => row.id === planId);
    if (!plan) throw new Error('That plan is no longer here.');
    const now = today();
    const result = generatePlan({
      dates: dateRange(plan.start_date, plan.end_date),
      today: now,
      slots: get().slots,
      recipes: useRecipes.getState().recipes,
      precookedMeals: usePrecooked.getState().meals,
      fridge: useFridge.getState().items,
      members: planMembers(plan, useHousehold.getState().members),
      existing: get().entries.filter((entry) => entry.plan_id === planId),
      // A plan that is over, or a meal eaten earlier this week, still used its container.
      reservedPrecookedIds: get()
        .entries.filter((entry) => entry.plan_id !== planId || entry.date < now)
        .flatMap((entry) => entry.precooked_meal_id ?? []),
      seed: Date.now(),
    });
    await repos().plans.saveEntries(planId, result.entries);
    await get().load();
    return result;
  },

  setEntry: async (planId, entry) => {
    await repos().plans.setEntry(planId, { ...entry, locked: false });
    await get().load();
  },

  setLocked: async (entryId, locked) => {
    await repos().plans.setLocked(entryId, locked);
    await get().load();
  },

  clearEntry: async (entryId) => {
    await repos().plans.clearEntry(entryId);
    await get().load();
  },

  addSlot: async (name) => {
    const last = get().slots.at(-1);
    await repos().slots.add({ name, order: last ? last.order + 1 : 0 });
    await get().load();
  },

  renameSlot: async (id, name) => {
    await repos().slots.update(id, { name });
    await get().load();
  },

  reorderSlots: async (ids) => {
    await repos().slots.reorder(ids);
    await get().load();
  },

  removeSlot: async (id) => {
    await repos().slots.remove(id);
    await get().load();
  },
}));

/** The chosen plan, else the one covering today, else the next one, else the latest. */
export function useActivePlan(): { plan: MealPlan | null; select: (planId: string) => void } {
  const { plans, selectedId, select } = usePlanner();
  const now = today();
  const plan =
    plans.find((row) => row.id === selectedId) ??
    plans.find((row) => row.start_date <= now && row.end_date >= now) ??
    plans.find((row) => row.start_date > now) ??
    plans.at(-1) ??
    null;
  return { plan, select };
}

registerStore('planner', () => usePlanner.getState().load());
