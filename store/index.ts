import { useFridge } from './fridge';
import { useGrocery } from './grocery';
import { useHousehold } from './household';
import { usePlanner } from './planner';
import { usePrecooked } from './precooked';
import { useRecipes } from './recipes';

export { useFridge, useGrocery, useHousehold, usePlanner, usePrecooked, useRecipes };
export { useSettings } from './settings';

/** Re-reads every store from SQLite: at startup and after a sync brought changes. */
export async function loadAllStores(): Promise<void> {
  await Promise.all([
    useRecipes.getState().load(),
    useFridge.getState().load(),
    usePrecooked.getState().load(),
    usePlanner.getState().load(),
    useGrocery.getState().load(),
    useHousehold.getState().load(),
  ]);
}
