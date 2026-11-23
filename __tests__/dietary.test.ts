import { ALLERGENS, allergenHits, allergyWarnings, dietConflict } from '@/lib/dietary';

import { member, recipe } from './helpers';

const flagged = (ingredient: string, allergy: string) =>
  allergenHits(recipe('Plain dish', [[ingredient]]), [allergy]).length > 0;

describe('allergens', () => {
  it.each([
    ['Shrimp', 'Shellfish'],
    ['Prawns', 'Shellfish'],
    ['Bagoong alamang', 'Shellfish'],
    ['Roasted peanuts', 'Peanuts'],
    ['Peanut butter', 'Peanuts'],
    ['Cashews', 'Tree nuts'],
    ['Evaporated milk', 'Milk'],
    ['Unsalted Butter', 'Milk'],
    ['Crème fraîche', 'Milk'],
    ['Eggs', 'Eggs'],
    ['Mayonnaise', 'Eggs'],
    ['Patis', 'Fish'],
    ['Anchovies', 'Fish'],
    ['Soy sauce', 'Soy'],
    ['Soy sauce', 'Wheat / gluten'],
    ['All-purpose flour', 'Wheat / gluten'],
    ['Tahini', 'Sesame'],
    ['Lactose free milk', 'Milk'],
    ['Free range eggs', 'Eggs'],
    ['Chicken, free range eggs', 'Eggs'],
  ])('%s triggers %s', (ingredient, allergy) => {
    expect(flagged(ingredient, allergy)).toBe(true);
  });

  it.each([
    ['Eggplant', 'Eggs'],
    ['Coconut milk', 'Milk'],
    ['Peanut butter', 'Milk'],
    ['Peanuts', 'Tree nuts'],
    ['Coconut', 'Tree nuts'],
    ['Nutmeg', 'Tree nuts'],
    ['Water chestnuts', 'Tree nuts'],
    ['Oyster mushrooms', 'Shellfish'],
    ['Rice flour', 'Wheat / gluten'],
    ['Glutinous rice', 'Wheat / gluten'],
    ['Gluten-free flour', 'Wheat / gluten'],
    ['Vegan butter', 'Milk'],
    ['Dairy-free yogurt', 'Milk'],
  ])('%s does not trigger %s', (ingredient, allergy) => {
    expect(flagged(ingredient, allergy)).toBe(false);
  });

  it('does not let a safe phrase hide a real one on the same line', () => {
    expect(flagged('Coconut milk and butter', 'Milk')).toBe(true);
  });

  it('reads notes and titles as well', () => {
    const noted = recipe('Salad', [['Dressing']]);
    noted.ingredients[0]!.note = 'top with chopped peanuts';
    expect(allergenHits(noted, ['Peanuts'])).toEqual([{ allergy: 'Peanuts', found: 'Dressing' }]);
    expect(allergenHits(recipe('Shrimp fried rice', [['Rice']]), ['Shellfish'])).toHaveLength(1);
  });

  it('does not let "vegan" in a note excuse the ingredient itself', () => {
    const dish = recipe('Toast', [['Butter']]);
    dish.ingredients[0]!.note = 'or vegan spread';
    expect(allergenHits(dish, ['Milk'])).toHaveLength(1);
  });

  it('understands free text, both known groups and plain words', () => {
    expect(flagged('Cheddar cheese', 'dairy')).toBe(true);
    expect(flagged('Crab', 'seafood')).toBe(true);
    expect(flagged('Almonds', 'nuts')).toBe(true);
    expect(flagged('Ripe mangoes', 'Mango')).toBe(true);
    expect(flagged('Mangosteen', 'mango')).toBe(false);
  });

  it('ignores blank allergies', () => {
    expect(flagged('Anything', '  ')).toBe(false);
  });

  it('names the members affected', () => {
    const ana = member({ id: 'ana', allergies: ['Fish'] });
    const leo = member({ id: 'leo' });
    const warnings = allergyWarnings(recipe('Soup', [['Fish sauce']]), [ana, leo]);
    expect(warnings.map((warning) => warning.member.id)).toEqual(['ana']);
  });

  it('covers every listed allergen with at least one term', () => {
    for (const allergen of ALLERGENS) {
      const word = allergen.split(' / ')[0]!;
      expect(flagged(word, allergen)).toBe(true);
    }
  });
});

describe('diets', () => {
  const fits = (ingredient: string, diet: Parameters<typeof dietConflict>[1]) =>
    dietConflict(recipe('Plain dish', [[ingredient]]), diet) === null;

  it('vegetarian: no meat or fish, dairy is fine', () => {
    expect(fits('Chicken stock', 'vegetarian')).toBe(false);
    expect(fits('Fish sauce', 'vegetarian')).toBe(false);
    expect(fits('Cheese', 'vegetarian')).toBe(true);
  });

  it('vegan: no animal products', () => {
    for (const food of ['Beef', 'Salmon', 'Eggs', 'Milk', 'Honey', 'Gelatin']) {
      expect(fits(food, 'vegan')).toBe(false);
    }
    for (const food of ['Tofu', 'Coconut milk', 'Vegan cheese', 'Eggplant']) {
      expect(fits(food, 'vegan')).toBe(true);
    }
  });

  it('pescatarian: fish yes, meat no', () => {
    expect(fits('Salmon', 'pescatarian')).toBe(true);
    expect(fits('Crab meat', 'pescatarian')).toBe(true);
    expect(fits('Pork belly', 'pescatarian')).toBe(false);
  });

  it('halal: no pork or alcohol', () => {
    expect(fits('Bacon', 'halal')).toBe(false);
    expect(fits('White wine', 'halal')).toBe(false);
    expect(fits('White wine vinegar', 'halal')).toBe(true);
    expect(fits('Chicken', 'halal')).toBe(true);
  });

  it('keto: uses carbs when known, ingredients when not', () => {
    expect(dietConflict(recipe('A', [['Rice']], { carbs_g: 5 }), 'keto')).toBeNull();
    expect(dietConflict(recipe('B', [['Beef']], { carbs_g: 60 }), 'keto')).toBe('60 g carbs');
    expect(fits('Rice', 'keto')).toBe(false);
    expect(fits('Cauliflower rice', 'keto')).toBe(true);
  });
});
