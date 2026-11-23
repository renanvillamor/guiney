import type { BaseUnit, UnitSystem } from '@/types/models';

/**
 * Quantities are stored in g, ml or piece. Everything a person types or reads
 * goes through this module.
 */

export const INPUT_UNITS = [
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'fl oz',
  'piece',
] as const;
export type InputUnit = (typeof INPUT_UNITS)[number];

const DEFINITIONS: Record<InputUnit, { base: BaseUnit; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  oz: { base: 'g', factor: 28.349523125 },
  lb: { base: 'g', factor: 453.59237 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  tsp: { base: 'ml', factor: 4.92892159375 },
  tbsp: { base: 'ml', factor: 14.78676478125 },
  'fl oz': { base: 'ml', factor: 29.5735295625 },
  cup: { base: 'ml', factor: 236.5882365 },
  piece: { base: 'piece', factor: 1 },
};

const UNITS_BY_SYSTEM: Record<UnitSystem, InputUnit[]> = {
  metric: ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'piece'],
  imperial: ['oz', 'lb', 'tsp', 'tbsp', 'cup', 'fl oz', 'piece'],
};

export const unitsForSystem = (system: UnitSystem): InputUnit[] => UNITS_BY_SYSTEM[system];

export const baseUnitOf = (unit: InputUnit): BaseUnit => DEFINITIONS[unit].base;

export function areCompatible(a: InputUnit, b: InputUnit): boolean {
  return baseUnitOf(a) === baseUnitOf(b);
}

export function toBase(quantity: number, unit: InputUnit): { quantity: number; unit: BaseUnit } {
  const { base, factor } = DEFINITIONS[unit];
  return { quantity: quantity * factor, unit: base };
}

export function fromBase(quantity: number, unit: InputUnit): number {
  return quantity / DEFINITIONS[unit].factor;
}

export function convert(quantity: number, from: InputUnit, to: InputUnit): number {
  if (!areCompatible(from, to)) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  return fromBase(toBase(quantity, from).quantity, to);
}

/** Picks the unit a person in this system would reach for. */
export function displayUnit(quantity: number, unit: BaseUnit, system: UnitSystem): InputUnit {
  if (unit === 'piece') return 'piece';
  if (system === 'metric') {
    if (unit === 'g') return quantity >= 1000 ? 'kg' : 'g';
    return quantity >= 1000 ? 'l' : 'ml';
  }
  if (unit === 'g') return fromBase(quantity, 'lb') >= 0.995 ? 'lb' : 'oz';
  if (fromBase(quantity, 'cup') >= 0.245) return 'cup';
  return fromBase(quantity, 'tbsp') >= 0.995 ? 'tbsp' : 'tsp';
}

export function toDisplay(
  quantity: number,
  unit: BaseUnit,
  system: UnitSystem,
): { quantity: number; unit: InputUnit } {
  const target = displayUnit(quantity, unit, system);
  return { quantity: fromBase(quantity, target), unit: target };
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

function asDecimal(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

function asFraction(value: number): string {
  const whole = Math.floor(value + 0.02);
  const rest = value - whole;
  if (Math.abs(rest) < 0.04) return String(whole);
  const match = FRACTIONS.find(([amount]) => Math.abs(rest - amount) < 0.04);
  if (!match) return asDecimal(value, 1);
  return whole === 0 ? match[1] : `${whole} ${match[1]}`;
}

/** Numbers only, e.g. "1.25" or "1 ½". Never rounds a real amount down to zero. */
export function formatNumber(value: number, unit: InputUnit): string {
  if (unit === 'kg' || unit === 'l' || unit === 'lb') return asDecimal(value, 2);
  if (unit === 'g' || unit === 'ml') return asDecimal(value, value < 10 ? 1 : 0);
  if (unit === 'oz' || unit === 'fl oz') return asDecimal(value, value < 0.1 ? 2 : 1);
  return value < 0.1 ? asDecimal(value, 2) : asFraction(value);
}

function unitLabel(unit: InputUnit, value: number): string {
  if (unit === 'piece') return value > 1.02 ? 'pcs' : 'pc';
  if (unit === 'cup') return value > 1.02 ? 'cups' : 'cup';
  return unit;
}

/** "500 g", "1 ½ cups", "3 pcs". Empty string when there is no amount. */
export function formatQuantity(
  quantity: number | null,
  unit: BaseUnit,
  system: UnitSystem,
): string {
  if (quantity === null) return '';
  const shown = toDisplay(quantity, unit, system);
  return `${formatNumber(shown.quantity, shown.unit)} ${unitLabel(shown.unit, shown.quantity)}`;
}

/** Accepts "1.5", "1,5", "1/2" and "1 1/2". Returns null for blank or invalid input. */
export function parseQuantity(input: string): number | null {
  const text = input.trim().replace(',', '.');
  const mixed = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(text);
  if (mixed) {
    const [, whole, top, bottom] = mixed;
    if (Number(bottom) === 0) return null;
    return Number(whole ?? 0) + Number(top) / Number(bottom);
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

/** A plain-decimal string for pre-filling a text input. */
export function editableNumber(value: number): string {
  return asDecimal(value, 2) === '0' ? asDecimal(value, 4) : asDecimal(value, 2);
}
