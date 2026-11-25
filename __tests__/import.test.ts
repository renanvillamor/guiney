import { allergenHits } from '@/lib/dietary';
import { looksLikeIngredient, parseIngredient } from '@/lib/ingredientLine';
import { readingOrder, type TextBox } from '@/lib/pageLayout';
import { categoryFrom, cleanUrl, findUrl, fromHtml, fromPage, minutes, plainText, siteName } from '@/lib/recipeImport';
import { fromText } from '@/lib/recipeText';

const read = (text: string) => {
  const { name, amount, unit, note } = parseIngredient(text);
  return [amount, unit, name, note];
};

describe('ingredient lines', () => {
  it.each([
    ['2 cups rice', [2, 'cup', 'rice', '']],
    ['1 1/2 tbsp. soy sauce', [1.5, 'tbsp', 'soy sauce', '']],
    ['1½ cups coconut milk', [1.5, 'cup', 'coconut milk', '']],
    ['½ kilo pork belly', [0.5, 'kg', 'pork belly', '']],
    ['2 lbs chicken (cut into serving pieces)', [2, 'lb', 'chicken', 'cut into serving pieces']],
    ['3  garlic cloves (, minced)', [3, 'piece', 'garlic', 'minced, cloves']],
    ['5 cloves garlic, crushed', [5, 'piece', 'garlic', 'cloves, crushed']],
    ['1/3 cup (85ml)  soy sauce (, light (not dark), Note 2)', [0.3333, 'cup', 'soy sauce', 'light not dark']],
    ['750g / 1.5 lb  chicken thigh fillets', [750, 'g', 'chicken thigh fillets', '']],
    ['1/4 cup + 2 tbsp vinegar', [0.375, 'cup', 'vinegar', '']],
    ['2 chicken legs (about 600g)', [600, 'g', 'chicken legs', 'about 600g']],
    ['1 can (400 ml) coconut milk', [400, 'ml', 'coconut milk', '400 ml, can']],
    ['2 x 400g cans chopped tomatoes', [800, 'g', 'chopped tomatoes', '2 x 400g, cans']],
    ['2-3 potatoes, quartered', [3, 'piece', 'potatoes', '2 to 3, quartered']],
    ['1,000 g flour', [1000, 'g', 'flour', '']],
    ['1,5 kg beef', [1.5, 'kg', 'beef', '']],
    ['Salt and pepper to taste', [null, 'piece', 'Salt and pepper', 'to taste']],
    ['a pinch of salt', [null, 'piece', 'salt', 'pinch']],
    ['2 tbsp vegetable oil plus a splash if needed', [2, 'tbsp', 'vegetable oil', 'plus a splash if needed']],
    ['2 kutsara patis', [2, 'tbsp', 'patis', '']],
    ['isang tasa ng bigas', [1, 'cup', 'ng bigas', '']],
    ['▢ 4 eggs', [4, 'piece', 'eggs', '']],
    ['2 skin-on, bone-in chicken thighs', [2, 'piece', 'skin-on, bone-in chicken thighs', '']],
    ['2 quarts water', [8, 'cup', 'water', '']],
    ['1 small onion finely chopped', [1, 'piece', 'small onion', 'finely chopped']],
    ['1 lb. young tamarind (see notes)', [1, 'lb', 'young tamarind', '']],
    ['one onion', [1, 'piece', 'onion', '']],
    ['water', [null, 'piece', 'water', '']],
  ])('%s', (text, expected) => {
    expect(read(text)).toEqual(expected);
  });

  it('asks for a check when it had to guess', () => {
    expect(parseIngredient('2 cups rice').sure).toBe(true);
    expect(parseIngredient('2 cans (400 ml) coconut milk')).toMatchObject({ amount: 800, sure: false });
    expect(parseIngredient('11/2 cups water')).toMatchObject({ amount: 1.5, unit: 'cup', sure: false });
    expect(parseIngredient('21/4 tsp salt')).toMatchObject({ amount: 2.25, sure: false });
    expect(parseIngredient('1 1/2 cups water')).toMatchObject({ amount: 1.5, sure: true });
    expect(parseIngredient('3/4 cup milk')).toMatchObject({ amount: 0.75, sure: true });
    expect(parseIngredient('7up or sprite').sure).toBe(false);
    expect(parseIngredient('12').sure).toBe(false);
    expect(parseIngredient('12').name).toBe('12');
  });

  it('keeps every word that could name an allergen', () => {
    for (const text of [
      '2 tbsp oyster sauce (or fish sauce, Note 3)',
      '1 (250 g) pack egg noodles, or shrimp noodles',
      '1/2 cup peanuts - crushed with sesame',
      '3 pieces crab sticks plus 2 prawns',
      'butter, for frying',
    ]) {
      const { name, note } = parseIngredient(text);
      const kept = `${name} ${note}`.toLowerCase();
      for (const word of ['oyster', 'fish', 'egg', 'shrimp', 'peanut', 'sesame', 'crab', 'prawn', 'butter']) {
        if (text.toLowerCase().includes(word)) expect(kept).toContain(word);
      }
    }
    const line = parseIngredient('1 cup stock (made with prawns)');
    expect(allergenHits({ title: 'Soup', ingredients: [line] }, ['Shellfish'])).not.toEqual([]);
  });

  it('tells ingredients from steps', () => {
    expect(['2 cups rice', '• 3 eggs', 'Salt to taste', '1 can tuna'].every(looksLikeIngredient)).toBe(true);
    expect(['1. Heat the oil.', 'Add 2 cups of water. Stir well.', 'Chicken adobo'].some(looksLikeIngredient)).toBe(false);
  });
});

const page = (data: unknown) =>
  `<html><script type="application/ld+json" class="x">${JSON.stringify(data)}</script></html>`;
const RECIPE = {
  '@type': 'Recipe',
  name: 'Mum&#8217;s Stew &amp; Rice',
  description: '<p>Cosy.</p>',
  image: [{ '@type': 'ImageObject', url: '/photos/stew.jpg' }],
  prepTime: 'PT10M',
  totalTime: 'PT1H30M',
  recipeYield: ['4', '4 people'],
  recipeCuisine: ['Asian', 'Filipino Recipe'],
  recipeCategory: ['Dinner', 'Main Course'],
  recipeIngredient: ['2 lb beef', '1 cup stock', 'salt to taste'],
  recipeInstructions: [
    { '@type': 'HowToSection', name: 'Start', itemListElement: [{ '@type': 'HowToStep', text: 'Brown the beef.' }] },
    { '@type': 'HowToStep', text: 'Simmer for <b>1 hour</b>.' },
  ],
  nutrition: { calories: '646 kcal', proteinContent: '30 g', carbohydrateContent: '12.5g', fatContent: '' },
};

describe('websites', () => {
  it('reads a recipe', () => {
    expect(fromHtml(page(RECIPE), 'https://example.com/stew')).toMatchObject({
      title: 'Mum’s Stew & Rice',
      description: 'Cosy.',
      prep: 10,
      cook: 80,
      servings: 4,
      cuisine: 'Filipino',
      category: 'main',
      calories: 646,
      protein_g: 30,
      carbs_g: 12.5,
      fat_g: null,
      steps: ['Brown the beef.', 'Simmer for 1 hour.'],
      imageUrl: 'https://example.com/photos/stew.jpg',
      sourceUrl: 'https://example.com/stew',
    });
    expect(fromHtml(page(RECIPE), null)!.lines.map((line) => line.name)).toEqual(['beef', 'stock', 'salt']);
  });

  it('finds it inside a graph, among other things, and picks the fullest', () => {
    const teaser = { '@type': 'Recipe', name: 'Other', recipeIngredient: ['1 egg'] };
    const graph = { '@graph': [{ '@type': 'WebPage' }, { ...RECIPE, '@type': ['Recipe', 'NewsArticle'], '@id': 1 }, teaser] };
    expect(fromHtml(page(graph), null)!.title).toContain('Stew');
    expect(fromHtml(page({ '@type': 'Article', name: 'News' }), null)).toBeNull();
    expect(fromHtml('<html>hello</html>', null)).toBeNull();
  });

  it('copes with messy JSON and plain instructions', () => {
    const messy = `<script type='application/ld+json'>{"@type":"http://schema.org/Recipe","name":"Soup",
      "recipeIngredient":["1 egg",], "recipeInstructions":"1. Boil water.\n2. Add egg."}</script>`;
    expect(fromHtml(messy, null)).toMatchObject({ title: 'Soup', steps: ['Boil water.', 'Add egg.'] });
    expect(fromHtml('<script type="application/ld+json">{broken</script>', null)).toBeNull();
  });

  it('never keeps markup or unsafe image addresses', () => {
    const bad = { ...RECIPE, name: '<script>alert(1)</script>Stew', image: ['javascript:alert(1)', 'file:///etc/passwd'] };
    const result = fromHtml(page(bad).replace('</script>Stew', '<\\/script>Stew'), 'https://example.com')!;
    expect(result.title).toBe('Stew');
    expect(result.imageUrl).toBeNull();
    expect(plainText('&lt;b&gt;Hi&lt;/b&gt;')).toBe('Hi');
  });

  it('falls back to recipes marked in the page itself', () => {
    const marked = { name: 'Old soup', ingredients: ['2 eggs', ' '], steps: ['Boil.\nServe.'], image: null };
    expect(fromPage({ url: 'https://a.com/x?utm_source=f', jsonLd: [], marked })).toMatchObject({
      title: 'Old soup',
      steps: ['Boil.', 'Serve.'],
      sourceUrl: 'https://a.com/x',
    });
    expect(fromPage({ url: 'https://a.com', jsonLd: [], marked: null })).toBeNull();
  });

  it('reads times, categories and addresses', () => {
    expect(['PT50M', 'P0DT1H5M', 'PT0M', 'soon', undefined].map(minutes)).toEqual([50, 65, null, null, null]);
    expect(['Main Course', 'Soups', 'Merienda', 'Beverage', 'Brunch', '', 'Salad'].map(categoryFrom)).toEqual([
      'main', 'soup', 'snack', 'drink', 'breakfast', 'main', 'side',
    ]);
    expect(findUrl('Try this! https://www.site.com/adobo/?fbclid=1&id=3.')).toBe('https://www.site.com/adobo/?id=3');
    expect(findUrl('site.com/adobo')).toBe('https://site.com/adobo');
    expect(findUrl('chicken adobo')).toBeNull();
    expect(['javascript:alert(1)', 'file:///a', 'http://localhost/x', ''].map(cleanUrl)).toEqual([null, null, null, null]);
    expect(siteName('https://www.panlasangpinoy.com/x')).toBe('panlasangpinoy.com');
  });
});

describe('plain text', () => {
  it('sorts a recipe with headings', () => {
    const result = fromText(`Chicken Tinola
      A light ginger soup.
      Serves 4 | Prep time: 10 mins | Cook time: 1 hour 5 mins

      INGREDIENTS:
      - 1 kg chicken
      - 1 thumb ginger,
        sliced
      For the broth:
      - l cup water
      Salt to taste

      Directions
      1. Saute the ginger
      until fragrant.
      2. Add the chicken and water. Simmer.

      Notes
      Best served hot.`);
    expect(result).toMatchObject({ title: 'Chicken Tinola', description: 'A light ginger soup.', servings: 4, prep: 10, cook: 65 });
    expect(result.lines.map((line) => [line.amount, line.name, line.note])).toEqual([
      [1, 'chicken', ''],
      [1, 'ginger', 'thumb, sliced'],
      [1, 'water', ''],
      [null, 'Salt', 'to taste'],
    ]);
    expect(result.steps).toEqual(['Saute the ginger until fragrant.', 'Add the chicken and water. Simmer.']);
  });

  it('sorts Filipino headings', () => {
    const result = fromText('Adobo\nMga Sangkap\n1 kilo manok\n2 kutsara toyo\nParaan ng Pagluluto\n1. Igisa ang bawang.\n2. Ilagay ang manok.');
    expect(result.lines.map((line) => line.name)).toEqual(['manok', 'toyo']);
    expect(result.steps).toEqual(['Igisa ang bawang.', 'Ilagay ang manok.']);
  });

  it('sorts text without headings', () => {
    const result = fromText('Garlic rice\n3 cups rice\n6 cloves garlic\nFry the garlic in oil until it is golden and crisp, then add the rice.\nSeason and serve.');
    expect(result.title).toBe('Garlic rice');
    expect(result.lines).toHaveLength(2);
    expect(result.steps).toEqual(['Fry the garlic in oil until it is golden and crisp, then add the rice.', 'Season and serve.']);
  });

  it('keeps whatever it cannot sort, and an address it finds', () => {
    expect(fromText('')).toMatchObject({ title: '', lines: [], steps: [] });
    expect(fromText('My soup\nhttps://a.com/soup\nIngredients\n1 egg').sourceUrl).toBe('https://a.com/soup');
  });
});

describe('photo layout', () => {
  const box = (text: string, x: number, y: number, width = text.length * 10): TextBox => ({ text, x, y, width, height: 20 });

  it('reads the title, then each column from top to bottom', () => {
    const boxes = [
      box('Adobo', 300, 0, 200),
      box('Ingredients', 0, 60), box('1 kg chicken', 0, 85), box('2 tbsp soy sauce', 0, 110),
      box('Directions', 400, 60), box('1. Brown it.', 400, 85), box('2. Simmer.', 400, 110),
    ];
    expect(readingOrder([...boxes].reverse()).split('\n')).toEqual(boxes.map((b) => b.text));
  });

  it('joins a column of amounts to the names beside it', () => {
    const boxes = [box('1 kg', 0, 0), box('chicken', 200, 2), box('2 tbsp', 0, 30), box('soy sauce', 200, 31)];
    expect(readingOrder(boxes).split('\n')).toEqual(['1 kg chicken', '2 tbsp soy sauce']);
  });

  it('copes with nothing and with one line', () => {
    expect(readingOrder([])).toBe('');
    expect(readingOrder([box('Soup', 0, 0)])).toBe('Soup');
  });
});
