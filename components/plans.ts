import { Alert } from 'react-native';

import { formatDate } from '@/lib/dates';
import type { PlannedEntry, PlannerResult } from '@/lib/planner';
import { usePlanner } from '@/store';
import { messageOf } from '@/store/account';
import type { MealPlan } from '@/types/models';

import { useOverlay, whileCooking } from './Overlays';

export const planDates = (plan: MealPlan): string =>
  `${formatDate(plan.start_date)} to ${formatDate(plan.end_date)}`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "14 meals with 22 dishes", or just the meals when each has one dish. */
export function mealsAndDishes(entries: PlannedEntry[]): string {
  const meals = new Set(entries.map((entry) => `${entry.date}/${entry.slot_id}`)).size;
  const text = count(meals, 'meal', 'meals');
  return entries.length > meals ? `${text} with ${count(entries.length, 'dish', 'dishes')}` : text;
}

/** Plain sentences about what the generator could not do. */
export function planNotes(result: PlannerResult, slotName: (id: string) => string): string[] {
  const notes: string[] = [];
  const names = (reason: string) => [
    ...new Set(
      result.unfilled.filter((slot) => slot.reason === reason).map((slot) => slotName(slot.slot_id)),
    ),
  ];
  const missing = names('no-recipe-for-slot');
  if (missing.length > 0) {
    notes.push(`No recipe fits ${missing.join(' or ')} yet. Add one with that category.`);
  }
  const unsafe = names('no-safe-recipe');
  if (unsafe.length > 0) {
    notes.push(`Every recipe for ${unsafe.join(' and ')} breaks someone's allergy or diet, so those stay empty.`);
  }
  const meals = (reason: string) =>
    result.skippedPrecooked.filter((skip) => skip.reason === reason).map((skip) => skip.meal.name);
  const unknown = meals('unknown-ingredients');
  if (unknown.length > 0) {
    notes.push(`${unknown.join(', ')} was left out. Link it to a recipe so allergies can be checked.`);
  }
  const risky = meals('unsafe');
  if (risky.length > 0) notes.push(`${risky.join(', ')} was left out because it breaks someone's allergy or diet.`);
  const expired = meals('expired');
  if (expired.length > 0) notes.push(`${expired.join(', ')} is past its date.`);
  return notes;
}

/** Generates with Guiney on screen, then celebrates. Returns null if it failed. */
export async function cookPlan(planId: string): Promise<PlannerResult | null> {
  try {
    const result = await whileCooking('Guiney is cooking up your plan…', () =>
      usePlanner.getState().generate(planId),
    );
    if (result.entries.length > 0) {
      const cooked = result.entries.filter((entry) => entry.precooked_meal_id).length;
      useOverlay.getState().celebrate(
        'Your plan is ready!',
        `${mealsAndDishes(result.entries)} planned${cooked > 0 ? `, ${cooked} already cooked` : ''}.`,
      );
    }
    return result;
  } catch (error) {
    Alert.alert('Could not make the plan', messageOf(error));
    return null;
  }
}
