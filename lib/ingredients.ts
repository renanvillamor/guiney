/** Ingredient-name normalisation and matching. */

const IRREGULAR: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  anchovies: 'anchovy',
};

const KEEP_S = /(ss|us|is)$/;
const ALREADY_SINGULAR = new Set(['molasses', 'hummus', 'asparagus', 'couscous', 'swiss', 'citrus', 'bangus']);

function singular(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length < 4 || ALREADY_SINGULAR.has(word) || KEEP_S.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4 && word !== 'cookies') return `${word.slice(0, -3)}y`;
  if (/(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Lowercase, unaccented, punctuation-free, singular words. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

export const sameIngredient = (a: string, b: string): boolean => {
  const left = normalizeName(a);
  return left !== '' && left === normalizeName(b);
};

/** Is `term` present in `text` as a run of whole words? Both must be normalised. */
export function containsTerm(text: string, term: string): boolean {
  return term !== '' && ` ${text} `.includes(` ${term} `);
}

/** Loose match for likes, dislikes and fridge ranking: "chicken" matches "chicken thighs". */
export function looselyMatches(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  return containsTerm(left, right) || containsTerm(right, left);
}
