import type { BaseUnit, Category, NewRow, Member, RecipeDraft } from '@/types/models';

import { defaultDishes } from '@/lib/planner';

import type { Database } from './database';
import type { Repositories } from './repositories';
import { writeSettings } from './settings';

/**
 * Sample rows carry this timestamp. A row that still has it was never edited,
 * so joining a household can leave the samples behind.
 */
export const SEED_STAMP = '2020-01-01T00:00:00.000Z';

export const DEFAULT_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

type Line = [name: string, quantity: number | null, unit: BaseUnit, note?: string];

interface Sample {
  title: string;
  description: string;
  category: Category;
  cuisine: string;
  tags: string[];
  prep: number;
  cook: number;
  servings: number;
  nutrition: [calories: number, protein: number, carbs: number, fat: number];
  ingredients: Line[];
  steps: string[];
}

const SAMPLES: Sample[] = [
  {
    title: 'Chicken adobo',
    description: 'Chicken simmered in vinegar, soy sauce and garlic until sticky and dark.',
    category: 'main',
    cuisine: 'Filipino',
    tags: ['classic', 'one pot'],
    prep: 10,
    cook: 45,
    servings: 4,
    nutrition: [410, 34, 6, 27],
    ingredients: [
      ['Chicken thighs', 1000, 'g', 'bone in'],
      ['Soy sauce', 120, 'ml'],
      ['Cane vinegar', 120, 'ml'],
      ['Garlic', 40, 'g', 'crushed'],
      ['Bay leaves', 3, 'piece'],
      ['Black peppercorns', 5, 'g'],
      ['Cooking oil', 15, 'ml'],
    ],
    steps: [
      'Marinate the chicken in soy sauce and garlic for 30 minutes.',
      'Brown the chicken in oil, then pour in the marinade, bay leaves and peppercorns.',
      'Add the vinegar and simmer without stirring for 10 minutes.',
      'Cover and cook until tender, about 25 minutes. Reduce the sauce until it coats the chicken.',
    ],
  },
  {
    title: 'Sinigang na baboy',
    description: 'Pork and vegetables in a sour tamarind broth.',
    category: 'main',
    cuisine: 'Filipino',
    tags: ['soup', 'comfort'],
    prep: 15,
    cook: 75,
    servings: 5,
    nutrition: [380, 28, 14, 23],
    ingredients: [
      ['Pork belly', 800, 'g', 'cut in chunks'],
      ['Tamarind paste', 60, 'g'],
      ['Tomatoes', 2, 'piece', 'quartered'],
      ['Onion', 1, 'piece'],
      ['White radish', 200, 'g', 'sliced'],
      ['Long beans', 150, 'g'],
      ['Eggplant', 1, 'piece', 'sliced'],
      ['Water spinach', 150, 'g'],
      ['Fish sauce', 30, 'ml'],
    ],
    steps: [
      'Boil the pork with onion and tomatoes. Skim, then simmer for 50 minutes.',
      'Add the radish and cook for 8 minutes. Stir in the tamarind and fish sauce.',
      'Add the beans and eggplant and cook until just tender.',
      'Turn off the heat, add the water spinach and cover for 2 minutes.',
    ],
  },
  {
    title: 'Tinolang manok',
    description: 'Gingery chicken soup with green papaya and chili leaves.',
    category: 'main',
    cuisine: 'Filipino',
    tags: ['soup', 'comfort'],
    prep: 15,
    cook: 40,
    servings: 4,
    nutrition: [320, 31, 9, 18],
    ingredients: [
      ['Chicken thighs', 800, 'g'],
      ['Ginger', 40, 'g', 'in strips'],
      ['Onion', 1, 'piece'],
      ['Garlic', 15, 'g'],
      ['Green papaya', 1, 'piece', 'in wedges'],
      ['Chili leaves', 60, 'g'],
      ['Fish sauce', 30, 'ml'],
      ['Cooking oil', 15, 'ml'],
    ],
    steps: [
      'Sauté the ginger, garlic and onion until fragrant.',
      'Add the chicken and fish sauce and cook until the chicken is no longer pink.',
      'Cover with water and simmer for 25 minutes.',
      'Add the papaya and cook until tender. Stir in the chili leaves and serve.',
    ],
  },
  {
    title: 'Pancit bihon',
    description: 'Stir-fried rice noodles with chicken, shrimp and crisp vegetables.',
    category: 'lunch',
    cuisine: 'Filipino',
    tags: ['noodles', 'party'],
    prep: 20,
    cook: 20,
    servings: 6,
    nutrition: [350, 18, 48, 9],
    ingredients: [
      ['Bihon noodles', 400, 'g'],
      ['Chicken breast', 200, 'g', 'shredded'],
      ['Shrimp', 150, 'g', 'peeled'],
      ['Carrots', 2, 'piece', 'in strips'],
      ['Cabbage', 250, 'g'],
      ['Green beans', 100, 'g'],
      ['Soy sauce', 60, 'ml'],
      ['Garlic', 15, 'g'],
      ['Calamansi', 6, 'piece'],
    ],
    steps: [
      'Soak the noodles in water for 10 minutes, then drain.',
      'Sauté the garlic, chicken and shrimp, then add the vegetables and cook until crisp-tender. Set aside.',
      'Simmer 2 cups of water with the soy sauce, add the noodles and cook until the liquid is absorbed.',
      'Toss everything together and serve with calamansi.',
    ],
  },
  {
    title: 'Garlic fried rice and egg',
    description: 'Sinangag: day-old rice, lots of garlic and a runny egg.',
    category: 'breakfast',
    cuisine: 'Filipino',
    tags: ['quick'],
    prep: 5,
    cook: 12,
    servings: 2,
    nutrition: [430, 14, 58, 15],
    ingredients: [
      ['Cooked rice', 400, 'g', 'day-old'],
      ['Eggs', 2, 'piece'],
      ['Garlic', 25, 'g', 'minced'],
      ['Cooking oil', 30, 'ml'],
      ['Salt', null, 'g'],
    ],
    steps: [
      'Fry the garlic in oil over low heat until golden.',
      'Add the rice, break up the lumps and season with salt.',
      'Fry the eggs and serve on top.',
    ],
  },
  {
    title: 'Banana oat porridge',
    description: 'Creamy oats with ripe banana and cinnamon. No dairy needed.',
    category: 'breakfast',
    cuisine: 'International',
    tags: ['quick', 'vegan'],
    prep: 5,
    cook: 8,
    servings: 2,
    nutrition: [310, 8, 60, 5],
    ingredients: [
      ['Rolled oats', 100, 'g'],
      ['Coconut milk', 200, 'ml'],
      ['Bananas', 2, 'piece', 'ripe'],
      ['Cinnamon', 2, 'g'],
    ],
    steps: [
      'Simmer the oats with the coconut milk and a cup of water for 5 minutes.',
      'Mash in one banana and the cinnamon.',
      'Slice the other banana on top.',
    ],
  },
  {
    title: 'Ginisang monggo',
    description: 'Mung beans stewed with tomatoes, garlic and spinach.',
    category: 'main',
    cuisine: 'Filipino',
    tags: ['vegan', 'budget'],
    prep: 10,
    cook: 50,
    servings: 4,
    nutrition: [260, 16, 42, 4],
    ingredients: [
      ['Mung beans', 250, 'g'],
      ['Tomatoes', 3, 'piece'],
      ['Onion', 1, 'piece'],
      ['Garlic', 15, 'g'],
      ['Spinach', 150, 'g'],
      ['Cooking oil', 15, 'ml'],
      ['Salt', null, 'g'],
    ],
    steps: [
      'Boil the mung beans until soft, about 40 minutes.',
      'Sauté the garlic, onion and tomatoes until saucy.',
      'Add to the beans, season and simmer for 5 minutes.',
      'Stir in the spinach just before serving.',
    ],
  },
  {
    title: 'Vegetable coconut curry',
    description: 'Squash and long beans in coconut milk, ginataan style.',
    category: 'main',
    cuisine: 'Filipino',
    tags: ['vegan', 'one pot'],
    prep: 15,
    cook: 25,
    servings: 4,
    nutrition: [290, 6, 27, 19],
    ingredients: [
      ['Squash', 500, 'g', 'cubed'],
      ['Long beans', 200, 'g'],
      ['Coconut milk', 400, 'ml'],
      ['Onion', 1, 'piece'],
      ['Garlic', 15, 'g'],
      ['Ginger', 20, 'g'],
      ['Salt', null, 'g'],
    ],
    steps: [
      'Sauté the garlic, onion and ginger.',
      'Add the squash and coconut milk and simmer for 12 minutes.',
      'Add the long beans and cook for 6 minutes more. Season to taste.',
    ],
  },
  {
    title: 'Grilled salmon with ginger greens',
    description: 'Crisp salmon over quickly wilted greens.',
    category: 'main',
    cuisine: 'Japanese',
    tags: ['quick', 'high protein'],
    prep: 10,
    cook: 12,
    servings: 2,
    nutrition: [420, 36, 7, 27],
    ingredients: [
      ['Salmon fillets', 2, 'piece'],
      ['Bok choy', 300, 'g'],
      ['Ginger', 15, 'g'],
      ['Soy sauce', 20, 'ml'],
      ['Sesame oil', 10, 'ml'],
    ],
    steps: [
      'Season the salmon and grill skin side down for 6 minutes. Turn and cook for 2 more.',
      'Stir-fry the ginger and bok choy in sesame oil.',
      'Add the soy sauce and serve with the salmon.',
    ],
  },
  {
    title: 'Turon',
    description: 'Crisp banana and jackfruit rolls with caramelised sugar.',
    category: 'snack',
    cuisine: 'Filipino',
    tags: ['sweet', 'merienda'],
    prep: 15,
    cook: 15,
    servings: 4,
    nutrition: [280, 3, 54, 7],
    ingredients: [
      ['Saba bananas', 4, 'piece'],
      ['Jackfruit', 100, 'g', 'ripe, in strips'],
      ['Lumpia wrappers', 8, 'piece'],
      ['Brown sugar', 100, 'g'],
      ['Cooking oil', 250, 'ml', 'for frying'],
    ],
    steps: [
      'Halve the bananas lengthwise and roll them in sugar.',
      'Wrap each piece with a strip of jackfruit.',
      'Fry until golden, sprinkling in the rest of the sugar so it coats the rolls.',
    ],
  },
];

const SAMPLE_MEMBERS: NewRow<Member>[] = [
  {
    name: 'Ana',
    avatar: '👩‍🍳',
    diet: 'none',
    allergies: ['Shellfish', 'Peanuts'],
    liked_ingredients: ['chicken', 'ginger'],
    disliked_ingredients: ['eggplant'],
    preferred_cuisines: ['Filipino'],
    user_id: null,
  },
  {
    name: 'Leo',
    avatar: '🧑‍🌾',
    diet: 'pescatarian',
    allergies: [],
    liked_ingredients: ['salmon', 'squash'],
    disliked_ingredients: [],
    preferred_cuisines: ['Japanese', 'Filipino'],
    user_id: null,
  },
];

export function sampleDrafts(): RecipeDraft[] {
  return SAMPLES.map((sample) => ({
    title: sample.title,
    description: sample.description,
    photo_uri: null,
    prep_time_min: sample.prep,
    cook_time_min: sample.cook,
    servings: sample.servings,
    tags: sample.tags,
    category: sample.category,
    cuisine: sample.cuisine,
    calories: sample.nutrition[0],
    protein_g: sample.nutrition[1],
    carbs_g: sample.nutrition[2],
    fat_g: sample.nutrition[3],
    copied_from_recipe_id: null,
    source_url: null,
    ingredients: sample.ingredients.map(([name, quantity, unit, note = '']) => ({
      name,
      quantity,
      unit,
      note,
    })),
    steps: sample.steps,
  }));
}

/** First launch only: slots, sample recipes and sample members. */
export async function seed(db: Database, repos: Repositories): Promise<void> {
  await db.tx(async (sql) => {
    for (const [order, name] of DEFAULT_SLOTS.entries()) {
      await repos.raw.slots.insert(sql, { name, order, dishes: defaultDishes(name) }, SEED_STAMP);
    }
    for (const member of SAMPLE_MEMBERS) {
      await repos.raw.members.insert(sql, member, SEED_STAMP);
    }
    for (const draft of sampleDrafts()) {
      await repos.recipes.insert(sql, draft, { stamp: SEED_STAMP });
    }
    await writeSettings(sql, { seeded: true });
  });
}
