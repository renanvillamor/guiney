import { create } from 'zustand';

import { repos } from '@/db/client';
import type { FullRecipe, RecipeDraft } from '@/types/models';

import { refresh } from './refresh';

interface RecipesState {
  recipes: FullRecipe[];
  load: () => Promise<void>;
  add: (draft: RecipeDraft) => Promise<string>;
  update: (id: string, draft: RecipeDraft) => Promise<void>;
  /** Makes an independent copy and returns its id. */
  duplicate: (id: string) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

export function toDraft(recipe: FullRecipe): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    photo_uri: recipe.photo_uri,
    prep_time_min: recipe.prep_time_min,
    cook_time_min: recipe.cook_time_min,
    servings: recipe.servings,
    tags: recipe.tags,
    category: recipe.category,
    cuisine: recipe.cuisine,
    calories: recipe.calories,
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    copied_from_recipe_id: recipe.copied_from_recipe_id,
    ingredients: recipe.ingredients.map(({ name, quantity, unit, note }) => ({
      name,
      quantity,
      unit,
      note,
    })),
    steps: recipe.steps.map((step) => step.instruction),
  };
}

export const useRecipes = create<RecipesState>((set, get) => ({
  recipes: [],

  load: async () => {
    const recipes = await repos().recipes.list();
    set({ recipes: recipes.sort((a, b) => a.title.localeCompare(b.title)) });
  },

  add: async (draft) => {
    const id = await repos().recipes.add(draft);
    await get().load();
    return id;
  },

  update: async (id, draft) => {
    await repos().recipes.update(id, draft);
    await get().load();
  },

  duplicate: async (id) => {
    const original = get().recipes.find((recipe) => recipe.id === id);
    if (!original) throw new Error('That recipe is no longer here.');
    return get().add({
      ...toDraft(original),
      title: `${original.title} (My version)`,
      copied_from_recipe_id: original.id,
    });
  },

  remove: async (id) => {
    await repos().recipes.remove(id);
    await Promise.all([get().load(), refresh('planner', 'precooked')]);
  },
}));
