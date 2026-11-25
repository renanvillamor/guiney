import { router } from 'expo-router';
import { create } from 'zustand';

import { keepRemotePhoto } from '@/lib/photos';
import type { ImportedRecipe } from '@/lib/recipeImport';

export interface ImportDraft {
  recipe: ImportedRecipe;
  /** A copy of the site's picture, on this phone. */
  photo: string | null;
  /** Photos it was read from, to compare with. */
  pages: string[];
  /** The text it was read from, to compare with. */
  text: string;
}

interface ImportState {
  draft: ImportDraft | null;
  set: (draft: ImportDraft) => void;
  clear: () => void;
}

/** Hands an imported recipe to the editor. Nothing is saved until a person does. */
export const useImportDraft = create<ImportState>((set) => ({
  draft: null,
  set: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));

const asWritten = (recipe: ImportedRecipe) =>
  [
    recipe.title,
    recipe.description,
    recipe.lines.map((line) => line.original).join('\n'),
    recipe.steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
  ]
    .filter((part) => part !== '')
    .join('\n\n');

/** Opens the editor on an imported recipe, in place of the import screen. */
export async function reviewImport(
  recipe: ImportedRecipe,
  original: { pages?: string[]; text?: string } = {},
): Promise<void> {
  const photo = recipe.imageUrl ? await keepRemotePhoto(recipe.imageUrl) : null;
  useImportDraft.getState().set({
    recipe,
    photo,
    pages: original.pages ?? [],
    text: original.text ?? asWritten(recipe),
  });
  router.push({ pathname: '/recipe/edit', params: { imported: '1' } });
}
