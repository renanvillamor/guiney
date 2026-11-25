import { looksLikeIngredient, parseIngredient } from './ingredientLine';
import { categoryFrom, emptyImport, findUrl, type ImportedRecipe } from './recipeImport';

/** Sorts plain text, pasted or read from a photo, into a recipe. */

const INGREDIENTS = /^(?:the |mga )?(?:ingredients?|sangkap|you(?:'|’)?ll need|you will need|what you(?:'|’)?ll need|what you need)\b/i;
const STEPS =
  /^(?:the )?(?:instructions?|directions?|methods?|steps|procedures?|preparation|how to (?:make|cook|prepare)(?: it)?|cooking (?:instructions?|procedures?|directions?)|paraan(?: ng pagluluto)?|pamamaraan)\b/i;
const END = /^(?:notes?|tips?|nutrition(?:al)?(?: (?:facts|information))?|storage|equipment|video|comments?)\b/i;

const MINUTES = /(\d+)\s*(?:h|hrs?|hours?|oras)\b(?:\s*(?:and\s*)?(\d+)\s*(?:m|mins?|minutes?|minuto)\b)?|(\d+)\s*(?:m|mins?|minutes?|minuto)\b/i;
function minutesIn(text: string): number | null {
  const match = MINUTES.exec(text);
  if (!match) return null;
  return match[3] ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2] ?? 0);
}

const heading = (line: string, pattern: RegExp) =>
  pattern.test(line) && line.replace(/[:\s]+$/, '').split(/\s+/).length <= 5;

/** Text recognition often reads a leading 1 as a letter, or joins it to the unit. */
function fixDigits(line: string): string {
  return line.replace(/^([•·*\-–]\s*)?[lI|](?=\s*(?:\d\/|cup|tsp|tbsp|teaspoon|tablespoon|kg|kilo|lb|pound|can|pack|piece|pc|small|medium|large)\b)/, '$11 ').replace(/ {2,}/g, ' ');
}

const isNumbered = (line: string) => /^(?:step\s*)?\d{1,2}\s*[.):]\s*\S/i.test(line);

export function fromText(input: string): ImportedRecipe {
  const recipe = emptyImport();
  const rows = input
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => fixDigits(line.replace(/\s+/g, ' ').trim()))
    .filter((line) => line !== '');
  const hasHeadings = rows.some((row) => heading(row, INGREDIENTS)) || rows.some((row) => heading(row, STEPS));

  let part: 'intro' | 'ingredients' | 'steps' | 'end' = 'intro';
  const intro: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];
  const numbered = rows.filter((row) => isNumbered(row) && !looksLikeIngredient(row)).length >= 2;

  for (const row of rows) {
    if (heading(row, INGREDIENTS)) {
      part = 'ingredients';
      const rest = row.replace(INGREDIENTS, '').replace(/^[\s:.-]+/, '');
      if (looksLikeIngredient(rest)) ingredients.push(rest);
      continue;
    }
    if (heading(row, STEPS)) {
      part = 'steps';
      continue;
    }
    if (part !== 'intro' && heading(row, END)) {
      part = 'end';
      continue;
    }
    if (part === 'end') continue;

    // "Serves 4", "Prep time: 10 minutes"
    if (row.length <= 60) {
      let isMeta = false;
      const serves = /\b(?:serves?|servings?|yields?|makes|good for|para sa)\b\D{0,12}(\d+)|(\d+)(?:\s*(?:-|–|to)\s*\d+)?\s*(?:servings?|people|persons?|pax)\b/i.exec(row);
      if (serves && !looksLikeIngredient(row.replace(serves[0], ''))) {
        recipe.servings ??= Number(serves[1] ?? serves[2]);
        isMeta = true;
      }
      const prep = /\bprep(?:aration)?(?:\s*time)?\b[\s:–-]*([^|,;]*)/i.exec(row);
      if (prep && minutesIn(prep[1] ?? '') !== null) {
        recipe.prep ??= minutesIn(prep[1] ?? '');
        isMeta = true;
      }
      const cook = /\b(?:cook(?:ing)?|bak(?:e|ing))(?:\s*time)\b[\s:–-]*([^|,;]*)/i.exec(row);
      if (cook && minutesIn(cook[1] ?? '') !== null) {
        recipe.cook ??= minutesIn(cook[1] ?? '');
        isMeta = true;
      }
      if (isMeta || /^(?:total time|cuisine|course|author|by)\b\s*:/i.test(row)) {
        const cuisine = /^cuisine\s*:\s*(.+)$/i.exec(row)?.[1];
        const course = /^course\s*:\s*(.+)$/i.exec(row)?.[1];
        if (cuisine) recipe.cuisine = cuisine.split(/[,/]/)[0]!.trim();
        if (course) recipe.category = categoryFrom(course);
        continue;
      }
    }

    if (!hasHeadings) {
      // No headings to go by, so each line has to speak for itself.
      if (looksLikeIngredient(row)) part = 'ingredients';
      else if (isNumbered(row) || (part !== 'intro' && row.length > 60)) part = 'steps';
      else if (part === 'ingredients' && row.length > 45) part = 'steps';
    }
    if (part === 'intro') intro.push(row);
    else if (part === 'ingredients') ingredients.push(row);
    else steps.push(row);
  }

  // The name is the first line that is mostly letters.
  const titleAt = intro.findIndex((row) => /\p{L}{3}/u.test(row) && !findUrl(row) && row.length <= 80);
  if (titleAt >= 0) {
    recipe.title = intro[titleAt]!.replace(/[:\s]+$/, '');
    recipe.description = intro
      .slice(titleAt + 1)
      .filter((row) => !findUrl(row))
      .join(' ')
      .slice(0, 400);
  }
  recipe.sourceUrl = intro.map(findUrl).find((url) => url !== null) ?? null;

  const joined: string[] = [];
  for (const row of ingredients) {
    const previous = joined.at(-1);
    const bullet = /^[•·*▢□☐◦‣\-–]\s*/.test(row);
    // "For the sauce:" groups ingredients; it is not one.
    if (!bullet && /:$/.test(row) && !looksLikeIngredient(row)) continue;
    const continues =
      previous !== undefined && !bullet && !looksLikeIngredient(row) &&
      (/^[(,]/.test(row) || (/[,(]$/.test(previous)) || (/^(?:and|or|plus|cut|chopped|sliced|minced|diced|peeled)\b/.test(row)));
    if (continues) joined[joined.length - 1] = `${previous} ${row}`;
    else joined.push(row);
  }
  recipe.lines = joined.map(parseIngredient);

  for (const row of steps) {
    const previous = recipe.steps.at(-1);
    const starts = isNumbered(row) || /^[•·*]\s/.test(row);
    const text = row.replace(/^(?:step\s*)?\d{1,2}\s*[.):]\s*/i, '').replace(/^[•·*]\s+/, '');
    // Wrapped lines belong to the step before.
    const continues =
      previous !== undefined && !starts && (numbered || /^\p{Ll}/u.test(row) || !/[.!?:)]$/.test(previous));
    if (continues) recipe.steps[recipe.steps.length - 1] = `${previous} ${text}`;
    else recipe.steps.push(text);
  }
  return recipe;
}
