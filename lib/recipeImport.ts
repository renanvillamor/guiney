import type { Category } from '@/types/models';

import { parseIngredient, type ImportedLine } from './ingredientLine';

/** A recipe read from somewhere else. It is only a draft until a person has checked it. */
export interface ImportedRecipe {
  title: string;
  description: string;
  prep: number | null;
  cook: number | null;
  servings: number | null;
  category: Category;
  cuisine: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  lines: ImportedLine[];
  steps: string[];
  /** On the web, to be downloaded. */
  imageUrl: string | null;
  sourceUrl: string | null;
}

export const emptyImport = (): ImportedRecipe => ({
  title: '',
  description: '',
  prep: null,
  cook: null,
  servings: null,
  category: 'main',
  cuisine: '',
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  lines: [],
  steps: [],
  imageUrl: null,
  sourceUrl: null,
});

type Json = unknown;
type JsonObject = Record<string, Json>;
const isObject = (value: Json): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: Json): Json[] =>
  Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼',
  frac34: '¾', deg: '°', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', eacute: 'é', ntilde: 'ñ', times: '×', bull: '•',
};

function decodeOnce(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z0-9]+));/gi, (all, dec, hex, name) => {
    const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : null;
    if (code !== null) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    return ENTITIES[String(name).toLowerCase()] ?? all;
  });
}

/** Plain text. Line breaks and paragraphs become new lines. */
export function plainText(value: Json): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const decoded = decodeOnce(decodeOnce(String(value)));
  return decoded
    .replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, '')
    .replace(/<(?:br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n\s*/g, '\n')
    .trim();
}
const oneLine = (value: Json) => plainText(value).replace(/\s+/g, ' ').trim();

/** ISO 8601, such as PT1H30M. */
export function minutes(value: Json): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i.exec(oneLine(value));
  if (!match) return null;
  const total =
    Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60;
  return total > 0 ? Math.round(total) : null;
}

function firstNumber(value: Json): number | null {
  for (const item of list(value)) {
    const match = /\d+(?:\.\d+)?/.exec(oneLine(item));
    if (match && Number(match[0]) > 0) return Number(match[0]);
  }
  return null;
}

/** Categories on websites, mapped to ours. Anything substantial is a main dish. */
export function categoryFrom(text: string): Category {
  const has = (pattern: RegExp) => pattern.test(text);
  if (has(/\b(main|entr[eé]e|dinner|lunch|viand|ulam)/i)) return 'main';
  if (has(/\b(breakfast|brunch|almusal)/i)) return 'breakfast';
  if (has(/\bsoup/i)) return 'soup';
  if (has(/\b(dessert|cake|cookie|sweet|panghimagas)/i)) return 'dessert';
  if (has(/\b(drink|beverage|cocktail|smoothie|inumin)/i)) return 'drink';
  if (has(/\b(snack|appeti[sz]er|starter|merienda|finger food)/i)) return 'snack';
  if (has(/\b(side|salad|condiment|sauce)/i)) return 'side';
  return 'main';
}

const BROAD = new Set(['asian', 'european', 'international', 'world', 'western', 'global', 'fusion']);
function cuisineFrom(value: Json): string {
  const names = list(value)
    .flatMap((item) => oneLine(item).split(/[,/]/))
    .map((name) => name.replace(/\b(recipes?|cuisine|food)\b/gi, '').trim())
    .filter((name) => name !== '' && name.length <= 30);
  return names.find((name) => !BROAD.has(name.toLowerCase())) ?? names[0] ?? '';
}

function instructions(value: Json): string[] {
  return list(value).flatMap((item): string[] => {
    if (typeof item === 'string') return splitSteps(plainText(item));
    if (!isObject(item)) return [];
    if (item.itemListElement) return instructions(item.itemListElement);
    return splitSteps(plainText(item.text ?? item.name ?? item.description));
  });
}

export function splitSteps(text: string): string[] {
  return text
    .split(/\n+|\s+(?=(?:[Ss]tep )?\d{1,2}[.)]\s+\p{Lu})/u)
    .map((step) => step.replace(/^(?:step )?\d{1,2}[.):]\s+/i, '').replace(/^[•*-]\s+/, '').trim())
    .filter((step) => step.length > 1);
}

function imageFrom(value: Json, base: string | null): string | null {
  for (const item of list(value)) {
    const url = typeof item === 'string' ? item : isObject(item) ? (item.url ?? item.contentUrl) : null;
    const text = list(url)[0];
    if (typeof text !== 'string') continue;
    try {
      const full = new URL(decodeOnce(text.trim()), base ?? undefined);
      if (full.protocol === 'https:' || full.protocol === 'http:') {
        return full.href.replace(/^http:/, 'https:');
      }
    } catch {
      // Not an address. Try the next one.
    }
  }
  return null;
}

/** Some sites put raw line breaks or comments inside their JSON. */
function parseLoose(text: string): Json {
  const trimmed = text.trim().replace(/^<!--|-->$/g, '').replace(/^\s*\/\/<!\[CDATA\[|\/\/\]\]>\s*$/g, '');
  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    try {
      // eslint-disable-next-line no-control-regex
      return JSON.parse(trimmed.replace(/[\u0000-\u001f]+/g, ' ').replace(/,\s*([}\]])/g, '$1')) as Json;
    } catch {
      return null;
    }
  }
}

function findRecipes(value: Json, depth = 0): JsonObject[] {
  if (depth > 12) return [];
  if (Array.isArray(value)) return value.flatMap((item) => findRecipes(item, depth + 1));
  if (!isObject(value)) return [];
  const isRecipe = list(value['@type']).some(
    (type) => typeof type === 'string' && /(^|[/:])Recipe$/.test(type),
  );
  if (isRecipe) return [value];
  return Object.values(value).flatMap((item) => findRecipes(item, depth + 1));
}

function recipeFrom(data: JsonObject, url: string | null): ImportedRecipe {
  const nutrition = isObject(data.nutrition) ? data.nutrition : {};
  const prep = minutes(data.prepTime);
  const total = minutes(data.totalTime);
  const cook = minutes(data.cookTime) ?? (total !== null && total > (prep ?? 0) ? total - (prep ?? 0) : null);
  const ingredients = list(data.recipeIngredient ?? data.ingredients)
    .flatMap((item) => plainText(item).split('\n'))
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return {
    ...emptyImport(),
    title: oneLine(data.name ?? data.headline).slice(0, 120),
    description: oneLine(data.description).slice(0, 400),
    prep,
    cook,
    servings: firstNumber(data.recipeYield ?? data.yield),
    category: categoryFrom(list(data.recipeCategory).map(oneLine).join(', ')),
    cuisine: cuisineFrom(data.recipeCuisine),
    calories: firstNumber(nutrition.calories),
    protein_g: firstNumber(nutrition.proteinContent),
    carbs_g: firstNumber(nutrition.carbohydrateContent),
    fat_g: firstNumber(nutrition.fatContent),
    lines: ingredients.map(parseIngredient),
    steps: instructions(data.recipeInstructions),
    imageUrl: imageFrom(data.image ?? data.thumbnailUrl, url),
    sourceUrl: url,
  };
}

const score = (recipe: ImportedRecipe) => recipe.lines.length + recipe.steps.length;

/** From the contents of a page's JSON-LD blocks. */
export function fromJsonLd(blocks: string[], url: string | null): ImportedRecipe | null {
  const found = blocks
    .flatMap((block) => findRecipes(parseLoose(block)))
    .map((data) => recipeFrom(data, url))
    .filter((recipe) => recipe.title !== '' && recipe.lines.length > 0)
    .sort((a, b) => score(b) - score(a));
  return found[0] ?? null;
}

export function fromHtml(html: string, url: string | null): ImportedRecipe | null {
  const blocks = [
    ...html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((match) => match[1] ?? '');
  return fromJsonLd(blocks, url);
}

/** What the in-app browser reads from a page that is open. */
export interface PageReading {
  url: string;
  jsonLd: string[];
  /** Older sites mark their recipe in the page itself. */
  marked: { name: string; ingredients: string[]; steps: string[]; image: string | null } | null;
}

export function fromPage(page: PageReading): ImportedRecipe | null {
  const url = cleanUrl(page.url);
  const structured = fromJsonLd(page.jsonLd, url);
  if (structured) return structured;
  const { marked } = page;
  if (!marked || marked.ingredients.length === 0) return null;
  return {
    ...emptyImport(),
    title: oneLine(marked.name).slice(0, 120),
    lines: marked.ingredients.map(oneLine).filter(Boolean).map(parseIngredient),
    steps: marked.steps.flatMap((step) => splitSteps(plainText(step))),
    imageUrl: imageFrom(marked.image, url),
    sourceUrl: url,
  };
}

const TRACKING = /^(utm_|fbclid|gclid|igsh|mc_|ref$|ref_|si$|smid$)/i;

/** The first web address in what someone typed or shared, without trackers. */
export function findUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text)?.[0] ?? /^[^\s@/]+\.[a-z]{2,}(?:\/\S*)?$/i.exec(text.trim())?.[0];
  if (!match) return null;
  return cleanUrl(match.replace(/[).,;!?]+$/, ''));
}

export function cleanUrl(text: string): string | null {
  try {
    const url = new URL(/^https?:/i.test(text) ? text : `https://${text}`);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) return null;
    const keep = url.search
      .replace(/^\?/, '')
      .split('&')
      .filter((part) => part !== '' && !TRACKING.test(part));
    const host = url.host.toLowerCase();
    return `${url.protocol}//${host}${url.pathname}${keep.length > 0 ? `?${keep.join('&')}` : ''}`;
  } catch {
    return null;
  }
}

/** "panlasangpinoy.com" */
export const siteName = (url: string): string =>
  /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(url)?.[1] ?? url;
