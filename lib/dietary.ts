import type { Diet, Member, Recipe, RecipeIngredient } from '@/types/models';

import { containsTerm, normalizeName } from './ingredients';

/**
 * Allergen and diet rules. These are safety rules, so they lean towards
 * flagging too much: an unknown sauce is worth a second look, a missed prawn is not.
 */

interface Terms {
  /** Words or phrases that mean the food is present. */
  match: string[];
  /** Phrases that contain a match but are safe, e.g. "coconut milk" for dairy. */
  except: string[];
  /** Label wording on the same ingredient that makes it safe, e.g. "vegan butter". */
  safeWhen?: RegExp;
}

const VEGAN_LABEL = /\b(vegan|plant based)\b/;
// "Lactose free" and "non dairy" products can still contain milk protein, so they do not count.
const DAIRY_FREE_LABEL = /\b(vegan|plant based|dairy free|milk free)\b/;
const EGG_FREE_LABEL = /\b(vegan|plant based|egg free|eggless)\b/;
const GLUTEN_FREE_LABEL = /\b(gluten free|wheat free)\b/;
const MEAT_FREE_LABEL = /\b(vegan|vegetarian|plant based|meatless|meat free|veggie|mock)\b/;

const DAIRY: Terms = {
  match: [
    'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'ghee', 'whey', 'casein', 'custard',
    'buttermilk', 'creme', 'paneer', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'ricotta', 'kesong',
    'mascarpone', 'brie', 'gouda', 'kefir', 'dulce de leche', 'leche flan', 'ice cream', 'queso', 'alfredo',
    'half and half', 'margarine', 'dairy', 'lactose', 'bechamel', 'caramel',
  ],
  except: [
    'coconut milk', 'coconut cream', 'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk',
    'cashew milk', 'hemp milk', 'peanut butter', 'almond butter', 'cashew butter', 'nut butter', 'apple butter',
    'cocoa butter', 'shea butter', 'butter bean', 'butter lettuce', 'cream of tartar', 'cream of coconut',
    'creamed coconut', 'milkfish',
  ],
  safeWhen: DAIRY_FREE_LABEL,
};

const EGG: Terms = {
  match: [
    'egg', 'mayonnaise', 'mayo', 'meringue', 'aioli', 'leche flan', 'custard', 'egg noodle', 'hollandaise',
    'albumin', 'itlog', 'pancit canton', 'balut', 'brioche', 'tartar sauce',
  ],
  except: ['eggplant'],
  safeWhen: EGG_FREE_LABEL,
};

const FISH: Terms = {
  match: [
    'fish', 'salmon', 'tuna', 'tilapia', 'bangus', 'milkfish', 'cod', 'anchovy', 'sardine', 'mackerel',
    'galunggong', 'dilis', 'dashi', 'bonito', 'tuyo', 'tinapa', 'lapu lapu', 'maya maya', 'hito', 'catfish',
    'snapper', 'grouper', 'trout', 'halibut', 'patis', 'bagoong', 'worcestershire', 'caviar', 'roe', 'daing',
    'surimi', 'swordfish', 'sea bass', 'seabass', 'haddock', 'herring', 'eel', 'monkfish', 'sole', 'pollock',
    'tanigue', 'isda', 'caesar dressing', 'tamban', 'fishball', 'sashimi', 'sushi',
  ],
  except: [],
  safeWhen: VEGAN_LABEL,
};

const SHELLFISH: Terms = {
  match: [
    'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'hipon', 'alimango', 'alimasag', 'sugpo', 'alamang',
    'bagoong', 'oyster', 'clam', 'mussel', 'tahong', 'squid', 'pusit', 'scallop', 'halaan', 'calamari',
    'octopus', 'shellfish', 'krill', 'langoustine', 'cuttlefish', 'abalone', 'talaba', 'kuhol', 'snail',
    'seafood', 'xo sauce', 'crabstick',
  ],
  except: ['oyster mushroom', 'crab apple'],
  safeWhen: VEGAN_LABEL,
};

const SOY: Terms = {
  match: [
    'soy', 'soya', 'soybean', 'toyo', 'tofu', 'tokwa', 'taho', 'miso', 'tempeh', 'edamame', 'teriyaki',
    'hoisin', 'oyster sauce', 'tausi', 'tamari', 'natto', 'black bean sauce', 'kecap', 'ponzu', 'tvp',
    'shoyu', 'worcestershire',
  ],
  except: [],
};

const WHEAT: Terms = {
  match: [
    'wheat', 'flour', 'bread', 'breadcrumb', 'panko', 'pasta', 'spaghetti', 'macaroni', 'noodle', 'couscous',
    'semolina', 'bulgur', 'seitan', 'barley', 'rye', 'malt', 'beer', 'cracker', 'pancit canton', 'miki', 'udon',
    'ramen', 'lumpia wrapper', 'wonton', 'gluten', 'soy sauce', 'toyo', 'teriyaki', 'hoisin', 'oyster sauce',
    'pandesal', 'croissant', 'bun', 'biscuit', 'cookie', 'cake', 'pastry', 'lasagna', 'penne', 'fettuccine',
    'linguine', 'spelt', 'farro', 'tortilla', 'pita', 'naan', 'bagel', 'batter', 'brioche', 'pancake', 'waffle',
    'dumpling', 'gyoza', 'orzo', 'worcestershire', 'breading', 'gravy', 'roti', 'shoyu', 'lumpia',
    'misua', 'vermicelli',
  ],
  except: [
    'rice flour', 'coconut flour', 'almond flour', 'corn flour', 'cornflour', 'tapioca flour', 'cassava flour',
    'chickpea flour', 'buckwheat flour', 'potato flour', 'rice noodle', 'glass noodle', 'cellophane noodle',
    'mung bean noodle', 'shirataki noodle', 'zucchini noodle', 'kelp noodle', 'corn tortilla', 'rice cake',
    'rice cracker', 'root beer', 'ginger beer', 'bihon noodle', 'sotanghon noodle', 'rice vermicelli',
    'mung bean vermicelli',
  ],
  safeWhen: GLUTEN_FREE_LABEL,
};

const PEANUT: Terms = {
  match: ['peanut', 'groundnut', 'satay', 'kare kare', 'mani', 'arachis'],
  except: [],
};

const TREE_NUT: Terms = {
  match: [
    'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'pili', 'brazil nut',
    'pine nut', 'praline', 'marzipan', 'nutella', 'chestnut', 'kasuy', 'tree nut', 'mixed nut', 'nut', 'nut butter',
    'frangipane', 'amaretto', 'pesto', 'nougat', 'gianduja',
  ],
  except: ['water chestnut', 'doughnut', 'nutmeg'],
};

const SESAME: Terms = { match: ['sesame', 'tahini', 'hummus', 'halva', 'linga', 'zaatar', 'gomasio'], except: [] };
const MUSTARD: Terms = { match: ['mustard', 'dijon'], except: ['mustard green', 'mustard leaf', 'mustasa'] };
const CELERY: Terms = { match: ['celery', 'celeriac', 'kintsay'], except: [] };

export const ALLERGENS = [
  'Peanuts',
  'Tree nuts',
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Soy',
  'Wheat / gluten',
  'Sesame',
  'Mustard',
  'Celery',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

const ALLERGEN_TERMS: Record<Allergen, Terms> = {
  Peanuts: PEANUT,
  'Tree nuts': TREE_NUT,
  Milk: DAIRY,
  Eggs: EGG,
  Fish: FISH,
  Shellfish: SHELLFISH,
  Soy: SOY,
  'Wheat / gluten': WHEAT,
  Sesame: SESAME,
  Mustard: MUSTARD,
  Celery: CELERY,
};

/** What people type in the free-text box, mapped to the groups it implies. */
const ALIASES: Record<string, Allergen[]> = {
  peanut: ['Peanuts'],
  nut: ['Peanuts', 'Tree nuts'],
  'tree nut': ['Tree nuts'],
  milk: ['Milk'],
  dairy: ['Milk'],
  lactose: ['Milk'],
  egg: ['Eggs'],
  fish: ['Fish'],
  seafood: ['Fish', 'Shellfish'],
  shellfish: ['Shellfish'],
  crustacean: ['Shellfish'],
  mollusc: ['Shellfish'],
  mollusk: ['Shellfish'],
  soy: ['Soy'],
  soya: ['Soy'],
  soybean: ['Soy'],
  wheat: ['Wheat / gluten'],
  gluten: ['Wheat / gluten'],
  'wheat gluten': ['Wheat / gluten'],
  sesame: ['Sesame'],
  mustard: ['Mustard'],
  celery: ['Celery'],
};

function normalizeTerms(terms: Terms): Terms {
  return {
    ...terms,
    match: terms.match.map(normalizeName),
    except: terms.except.map(normalizeName),
  };
}

const NORMALIZED = Object.fromEntries(
  Object.entries(ALLERGEN_TERMS).map(([key, terms]) => [key, normalizeTerms(terms)]),
) as Record<Allergen, Terms>;

/** "gluten free", "no peanut", "without egg" do not count as containing the food. */
function stripNegations(text: string): string {
  return text
    .replace(/\b(\w+) free\b(?! range)/g, ' ')
    .replace(/\b(no|without) (\w+)\b/g, ' ');
}

/** The first term found in `text` (already normalised), or null. */
function findTerm(text: string, terms: Terms): string | null {
  if (terms.safeWhen?.test(text)) return null;
  let remaining = ` ${stripNegations(text)} `;
  for (const phrase of terms.except) {
    while (remaining.includes(` ${phrase} `)) remaining = remaining.replace(` ${phrase} `, ' | ');
  }
  return terms.match.find((term) => containsTerm(remaining.trim(), term)) ?? null;
}

type IngredientLike = Pick<RecipeIngredient, 'name' | 'note'>;
type RecipeLike = Pick<Recipe, 'title'> & { ingredients: IngredientLike[] };

/** One entry per ingredient, plus the title: "Peanut noodles" counts even if peanuts were not listed. */
function textsOf(recipe: RecipeLike): { label: string; text: string }[] {
  return [
    // Name and note are separate texts, so wording in one cannot excuse the other.
    ...recipe.ingredients.flatMap((item) => [
      { label: item.name, text: normalizeName(item.name) },
      { label: item.name, text: normalizeName(item.note) },
    ]),
    { label: recipe.title, text: normalizeName(recipe.title) },
  ].filter((line) => line.text !== '');
}

function allergyTerms(allergy: string): Terms[] {
  const known = ALLERGENS.find((name) => name === allergy);
  if (known) return [NORMALIZED[known]];
  const name = normalizeName(allergy);
  if (!name) return [];
  const groups = (ALIASES[name] ?? []).map((group) => NORMALIZED[group]);
  // Free text always matches literally too, so "mango" or "msg" work.
  return [...groups, { match: [name], except: [] }];
}

export interface AllergenHit {
  allergy: string;
  /** The ingredient (or title) it was found in. */
  found: string;
}

export function allergenHits(recipe: RecipeLike, allergies: string[]): AllergenHit[] {
  const texts = textsOf(recipe);
  const hits: AllergenHit[] = [];
  for (const allergy of allergies) {
    const groups = allergyTerms(allergy);
    const line = texts.find(({ text }) =>
      groups.some((terms) => findTerm(text, terms) !== null),
    );
    if (line) hits.push({ allergy, found: line.label });
  }
  return hits;
}

export interface MemberWarning {
  member: Member;
  hits: AllergenHit[];
}

export function allergyWarnings(recipe: RecipeLike, members: Member[]): MemberWarning[] {
  return members
    .map((member) => ({ member, hits: allergenHits(recipe, member.allergies) }))
    .filter((warning) => warning.hits.length > 0);
}

const MEAT = normalizeTerms({
  match: [
    'chicken', 'beef', 'pork', 'lamb', 'goat', 'duck', 'turkey', 'bacon', 'ham', 'sausage', 'longganisa',
    'longanisa', 'chorizo', 'tocino', 'tapa', 'liempo', 'baboy', 'manok', 'baka', 'liver', 'oxtail', 'tripe',
    'lard', 'gelatin', 'hotdog', 'hot dog', 'spam', 'meat', 'mince', 'steak', 'veal', 'venison', 'rabbit',
    'pepperoni', 'salami', 'prosciutto', 'bone broth', 'meatball', 'chicharon', 'chicharron', 'bulalo',
    'patty', 'brisket', 'rib', 'shank', 'bone marrow', 'quail', 'lechon', 'bagnet',
    'wing', 'drumstick', 'sisig', 'dinuguan', 'kambing', 'embutido', 'pate', 'sweetbread',
  ],
  except: [
    'goat cheese', 'beef tomato', 'beefsteak tomato', 'coconut meat', 'crab meat', 'fish meat',
    'lobster meat', 'mushroom patty', 'veggie patty', 'celery rib', 'mince garlic', 'minced garlic',
    'tofu steak', 'cauliflower steak', 'jackfruit meat',
  ],
  safeWhen: MEAT_FREE_LABEL,
});
const PORK = normalizeTerms({
  match: [
    'pork', 'bacon', 'ham', 'lard', 'chorizo', 'longganisa', 'longanisa', 'tocino', 'liempo', 'baboy',
    'prosciutto', 'pepperoni', 'salami', 'chicharon', 'chicharron', 'spam', 'gelatin', 'lechon', 'bagnet',
    'hotdog', 'hot dog', 'sausage', 'sisig', 'dinuguan', 'embutido', 'pancetta',
  ],
  except: ['beef sausage', 'chicken sausage', 'beef bacon', 'turkey bacon', 'turkey ham', 'beef hotdog', 'chicken hotdog'],
});
const ALCOHOL = normalizeTerms({
  match: ['wine', 'beer', 'rum', 'brandy', 'vodka', 'whisky', 'whiskey', 'sake', 'mirin', 'gin', 'liqueur', 'tequila', 'bourbon'],
  except: ['wine vinegar', 'root beer', 'ginger beer', 'rum flavoring'],
});
const OTHER_ANIMAL = normalizeTerms({ match: ['honey', 'gelatin', 'beeswax'], except: ['honey dew', 'honeydew'] });
const HIGH_CARB = normalizeTerms({
  match: [
    'rice', 'flour', 'sugar', 'bread', 'pasta', 'spaghetti', 'macaroni', 'noodle', 'potato', 'corn', 'banana',
    'oat', 'honey', 'syrup', 'cassava', 'kamote', 'taro', 'gabi', 'bean', 'lentil', 'chickpea', 'breadcrumb',
    'panko', 'tortilla', 'bihon', 'sotanghon', 'cornstarch', 'saba', 'ube', 'mongo', 'cracker', 'cake', 'wrapper',
    'pandesal', 'condensed milk', 'quinoa', 'couscous', 'miki', 'canton',
  ],
  except: [
    'rice vinegar', 'cauliflower rice', 'almond flour', 'coconut flour', 'green bean', 'shirataki noodle',
    'zucchini noodle', 'sugar snap pea', 'long bean', 'string bean', 'rice wine vinegar', 'bean sprout',
    'baby corn',
  ],
});

/** Grams of carbohydrate per serving above which a recipe is not keto. */
export const KETO_MAX_CARBS = 15;

type DietRecipe = RecipeLike & Pick<Recipe, 'carbs_g'>;

/** Why this recipe breaks the diet, or null when it fits. */
export function dietConflict(recipe: DietRecipe, diet: Diet): string | null {
  const texts = textsOf(recipe);
  const find = (terms: Terms): string | null =>
    texts.find(({ text }) => findTerm(text, terms) !== null)?.label ?? null;

  switch (diet) {
    case 'none':
      return null;
    case 'vegetarian':
      return find(MEAT) ?? find(NORMALIZED.Fish) ?? find(NORMALIZED.Shellfish);
    case 'vegan':
      return (
        find(MEAT) ??
        find(NORMALIZED.Fish) ??
        find(NORMALIZED.Shellfish) ??
        find(NORMALIZED.Milk) ??
        find(NORMALIZED.Eggs) ??
        find(OTHER_ANIMAL)
      );
    case 'pescatarian':
      return find(MEAT);
    case 'halal':
      return find(PORK) ?? find(ALCOHOL);
    case 'gluten-free':
      return find(NORMALIZED['Wheat / gluten']);
    case 'dairy-free':
      return find(NORMALIZED.Milk);
    case 'keto':
      if (recipe.carbs_g !== null) {
        return recipe.carbs_g > KETO_MAX_CARBS ? `${Math.round(recipe.carbs_g)} g carbs` : null;
      }
      return find(HIGH_CARB);
  }
}

/** Does anything stop this recipe being served to all of these people? */
export function isSafeFor(recipe: DietRecipe, members: Member[]): boolean {
  return members.every(
    (member) =>
      allergenHits(recipe, member.allergies).length === 0 &&
      dietConflict(recipe, member.diet) === null,
  );
}

/** True when someone needs us to know what is in their food. */
export function hasRestrictions(members: Member[]): boolean {
  return members.some((member) => member.allergies.length > 0 || member.diet !== 'none');
}

export const dietLabel = (diet: Diet): string =>
  diet === 'none' ? 'No set diet' : diet.charAt(0).toUpperCase() + diet.slice(1);
