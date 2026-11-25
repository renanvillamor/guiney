import { baseUnitOf, convert, type InputUnit } from './units';

/**
 * Reads one written ingredient, such as "2 (400 ml) cans coconut milk, shaken". Words are
 * moved between the name and the note but never dropped, so allergens stay visible.
 */

export interface ImportedLine {
  name: string;
  /** Null means no amount was given. */
  amount: number | null;
  unit: InputUnit;
  note: string;
  original: string;
  /** False when a person should compare it with the original. */
  sure: boolean;
}

const UNITS: [InputUnit, string][] = [
  ['kg', 'kg|kgs|kilo|kilos|kilogram|kilograms'],
  ['g', 'g|gr|gm|gms|gram|grams'],
  ['fl oz', 'fl\\.? ?oz|fluid ounces?'],
  ['oz', 'oz|ounce|ounces'],
  ['lb', 'lb|lbs|pound|pounds'],
  ['ml', 'ml|mls|millilit(?:er|re)s?'],
  ['l', 'l|lit(?:er|re)s?|litro'],
  ['tbsp', 'tbsp|tbsps|tbs|tablespoons?|kutsara|T(?=\\.? )'],
  ['tsp', 'tsp|tsps|teaspoons?|kutsarita'],
  ['cup', 'cups?|tasa|quarts?|qts?|pints?|pts?|gallons?'],
  ['piece', 'pieces?|pcs?|piraso'],
];

/** Counted things that are not the food itself. They become the note. */
const COUNTERS =
  'cloves?|sprigs?|stalks?|stems?|sticks?|slices?|heads?|bunch(?:es)?|bundles?|tali|ulo|butil|knobs?|thumbs?|leaves|handfuls?|pinch(?:es)?|dash(?:es)?|drops?|splash(?:es)?|drizzles?|bulbs?|ears?|fillets?|strips?|cubes?';
/** Containers. "2 (400 ml) cans" is 800 ml. */
const CONTAINERS =
  'cans?|tins?|packs?|packets?|packages?|pkgs?|sachets?|jars?|bottles?|bags?|box(?:es)?|cartons?|tubs?|lata|pakete|bote';
const VAGUE = 'pinch(?:es)?|dash(?:es)?|drops?|splash(?:es)?|drizzles?|handfuls?';

const VULGAR: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5',
  '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', dozen: '12', isa: '1', isang: '1', dalawa: '2', dalawang: '2',
  tatlo: '3', tatlong: '3', apat: '4', lima: '5', limang: '5', kalahati: '1/2', kalahating: '1/2',
};

const NUM = '\\d+ \\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+';
const RANGE = `(?:${NUM})(?: ?(?:-|to|or) ?(?:${NUM}))?`;
const UNIT = UNITS.map(([, pattern]) => pattern).join('|');
const MEASURE = new RegExp(`^(${RANGE}) ?(?:(${UNIT})\\b\\.?)?`, 'i');
const MEASURE_WITH_UNIT = new RegExp(`(${RANGE}) ?(${UNIT})\\b\\.?`, 'i');

function tidyNumbers(text: string): string {
  return text
    .replace(/[⁄∕]/g, '/')
    .replace(/(\d)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, whole: string | undefined, char: string) =>
      whole ? `${whole} ${VULGAR[char]}` : ` ${VULGAR[char]}`,
    )
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d) (?:&|and) (\d+\/\d+)/gi, '$1 $2')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "11/2" is "1 1/2" with its space lost, as text recognition often does. */
function splitFraction(text: string): string {
  return text.replace(/(?<![\d/.])(\d{1,2})([1-7])\/([2348])(?![\d/])/g, (all, whole: string, top: string, bottom: string) =>
    Number(top) < Number(bottom) && whole !== '0' ? `${whole} ${top}/${bottom}` : all,
  );
}

function toNumber(text: string): number | null {
  const mixed = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text.trim());
  const value = mixed
    ? Number(mixed[1] ?? 0) + Number(mixed[2]) / Number(mixed[3])
    : Number(text.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A range gives its larger end, so there is enough to cook with. */
function rangeEnd(text: string): number | null {
  return toNumber(text.split(/ ?(?:-|to|or) ?/i).at(-1) ?? '');
}

const unitOf = (text: string): InputUnit => {
  if (text === 'T' || text === 'T.') return 'tbsp';
  return UNITS.find(([, pattern]) => new RegExp(`^(?:${pattern})$`, 'i').test(text.replace(/\.$/, '')))?.[0] ?? 'piece';
};

/** Larger measures, counted in cups. */
const IN_CUPS: [RegExp, number][] = [
  [/^(?:quarts?|qts?)$/i, 4],
  [/^(?:pints?|pts?)$/i, 2],
  [/^gallons?$/i, 16],
];
const scale = (unit: string) => IN_CUPS.find(([pattern]) => pattern.test(unit))?.[1] ?? 1;

/** Words that describe a food but do not name one: "skin-on, bone-in chicken thighs". */
const DESCRIBES = /^(?:(?:skin|bone)-(?:on|in)|skinless|boneless|fresh|dried|ripe|frozen|cooked|raw|large|small|medium|lean|unsalted|salted)$/i;
const PREPARED =
  / (?:(?:very |freshly )?(?:finely|thinly|roughly|coarsely|lightly|freshly) )?(?:chopped|sliced|minced|diced|crushed|grated|peeled|shredded|quartered|halved|beaten|melted|softened|julienned)$| to serve$/i;

const round = (value: number) => Number(value.toFixed(4));

export function parseIngredient(raw: string): ImportedLine {
  const original = raw.replace(/\s+/g, ' ').trim();
  let text = tidyNumbers(
    original
      .replace(/^[\s•·*▢□☐◦‣\-–]+(?=\S)/, '')
      .replace(/\(\s*,\s*/g, '(')
      .replace(/\(?\b(?:see )?notes? \d+\)?/gi, '')
      .replace(/\(\s*see notes?\s*\)/gi, ''),
  );
  text = text.replace(/^(\p{L}+)\b/u, (word) => NUMBER_WORDS[word.toLowerCase()] ?? word);
  text = text.replace(/^an? (?=\p{L})/iu, '1 ').replace(/^(\d+) dozen\b/i, (_, n: string) => String(Number(n) * 12));

  const notes: string[] = [];
  let sure = true;
  const spaced = splitFraction(text);
  if (spaced !== text) {
    text = spaced;
    sure = false;
  }
  let amount: number | null = null;
  let unit: InputUnit = 'piece';

  // "2 x 400 g cans"
  const times = new RegExp(`^(\\d+) ?[x×] ?(${NUM}) ?(${UNIT})\\b\\.?`, 'i').exec(text);
  const found = times ? null : MEASURE.exec(text);
  // "7up" is a name, not seven of something.
  const measure = found && !found[2] && /^[a-z]/i.test(text.slice(found[1]!.length)) ? null : found;
  if (times) {
    amount = Number(times[1]) * (toNumber(times[2]!) ?? 0) || null;
    unit = unitOf(times[3]!);
    notes.push(times[0]);
    text = text.slice(times[0].length).trim();
  } else if (measure) {
    amount = rangeEnd(measure[1]!);
    if (amount !== null && measure[2]) amount *= scale(measure[2]);
    if (/-|to|or/i.test(measure[1]!.replace(/\d|\/|\./g, ''))) notes.push(measure[1]!.replace(/ ?- ?/, ' to '));
    unit = measure[2] ? unitOf(measure[2]) : 'piece';
    text = text.slice(measure[0].length).trim();

    // "1/3 cup + 2 tbsp vinegar"
    const more = new RegExp(`^(?:\\+|plus) ?(${NUM}) ?(${UNIT})\\b\\.?`, 'i').exec(text);
    if (more && amount !== null) {
      const extra = toNumber(more[1]!);
      const extraUnit = unitOf(more[2]!);
      if (extra !== null && baseUnitOf(extraUnit) === baseUnitOf(unit)) {
        amount += convert(extra, extraUnit, unit);
        text = text.slice(more[0].length).trim();
      }
    }
    // The same amount again in another system: "750 g / 1.5 lb", "2 lb or 900 g".
    const again = new RegExp(`^(?:/|\\||or) ?(?:${NUM}) ?(?:${UNIT})\\b\\.?`, 'i').exec(text);
    if (measure[2] && again) text = text.slice(again[0].length).trim();
  }

  // Brackets hold a second measure or a remark.
  text = text.replace(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)?/g, (_, inside: string) => {
    const words = inside.replace(/[()]/g, ' ').replace(/\s+/g, ' ').replace(/^[,;\s]+|[,;\s]+$/g, '');
    const second = MEASURE_WITH_UNIT.exec(words);
    const secondUnit = second ? unitOf(second[2]!) : 'piece';
    if (second && secondUnit !== 'piece' && unit === 'piece') {
      const size = rangeEnd(second[1]!);
      const rest = text.replace(/\([^)]*\)?/g, ' ');
      if (size !== null && new RegExp(`\\b(?:${CONTAINERS})\\b`, 'i').test(rest)) {
        const count = amount ?? 1;
        amount = count * size;
        // Each or in total? Only a person can tell when there are several.
        if (count !== 1) sure = false;
      } else if (size !== null) {
        amount = size;
      }
      unit = secondUnit;
      notes.push(words);
      return ' ';
    }
    // The same amount again needs no note.
    const repeats = second !== null && second[0].length >= words.replace(/^(?:about|approx\.?|~|or) ?/i, '').length;
    if (!repeats && words) notes.push(words);
    return ' ';
  });
  text = text.replace(/\s+/g, ' ').replace(/^[,;:.\s]+/, '').trim();

  // "cloves garlic", "garlic cloves", "can of tomatoes"
  const counter = new RegExp(`^(?:(?:small|medium|large|big|heaping|whole) )?((?:${COUNTERS}|${CONTAINERS}))\\b\\.?(?: of)?(?= \\S)`, 'i').exec(text);
  if (counter) {
    const word = counter[0].replace(/ of$/i, '').trim();
    notes.push(word);
    text = text.slice(counter[0].length).trim();
    if (amount !== null && new RegExp(`^(?:${VAGUE})$`, 'i').test(counter[1]!)) {
      if (amount !== 1) notes[notes.length - 1] = `${round(amount)} ${word}`;
      amount = null;
    }
  }
  text = text.replace(/^of (?=\S)/i, '');

  const tail = / (?:plus|or as needed|as needed|to taste|for (?:serving|garnish|frying|the)|ayon sa panlasa)\b.*$/i.exec(text);
  if (tail && tail.index > 0) {
    notes.push(tail[0].trim());
    text = text.slice(0, tail.index).trim();
  }
  const prepared = PREPARED.exec(text);
  if (prepared && prepared.index > 0 && !/,/.test(text)) {
    notes.push(prepared[0].trim());
    text = text.slice(0, prepared.index);
  }
  const comma = /\s*[,;]\s*|\s+-\s+/.exec(text);
  if (comma && comma.index > 0 && !DESCRIBES.test(text.slice(0, comma.index).trim())) {
    notes.push(text.slice(comma.index + comma[0].length));
    text = text.slice(0, comma.index);
  }
  const trailing = new RegExp(`^(.*\\S) (cloves?|bulbs?|heads?)$`, 'i').exec(text.trim());
  if (trailing && unit === 'piece' && amount !== null) {
    text = trailing[1]!;
    notes.push(trailing[2]!);
  }

  const name = text.replace(/^[\s,.;:*-]+|[\s,;:*-]+$/g, '');
  const note = [...new Set(notes.map((part) => part.replace(/^[\s,;]+|[\s,;.]+$/g, '')).filter(Boolean))].join(', ');
  if (name === '' || name.length > 60 || /\d/.test(name)) sure = false;
  if (amount === null && /\d/.test(original)) sure = false;

  return {
    name: name || original,
    amount: amount === null ? null : round(amount),
    unit,
    note: name === '' ? '' : note,
    original,
    sure,
  };
}

/** Does this line start the way ingredients do? */
export function looksLikeIngredient(line: string): boolean {
  const text = splitFraction(tidyNumbers(line.replace(/^[\s•·*▢□☐◦‣\-–]+(?=\S)/, '')));
  if (text.length > 90 || /[.!?]\s+\p{Lu}/u.test(text)) return false;
  if (new RegExp(`^(?:${NUM})\\s?(?:${UNIT}|${COUNTERS}|${CONTAINERS})\\b`, 'i').test(text)) return true;
  if (/^\d+[.)]\s/.test(text)) return false;
  return /^(?:\d|an? (?:pinch|dash|handful|bunch|can|pack)\b)/i.test(text) || /\bto taste\b/i.test(text);
}
