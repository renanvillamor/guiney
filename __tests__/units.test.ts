import {
  areCompatible,
  convert,
  displayUnit,
  formatQuantity,
  INPUT_UNITS,
  parseQuantity,
  toBase,
  toDisplay,
  unitsForSystem,
} from '@/lib/units';

describe('conversion', () => {
  it('converts to the stored base unit', () => {
    expect(toBase(2, 'kg')).toEqual({ quantity: 2000, unit: 'g' });
    expect(toBase(1.5, 'l')).toEqual({ quantity: 1500, unit: 'ml' });
    expect(toBase(3, 'piece')).toEqual({ quantity: 3, unit: 'piece' });
    expect(toBase(1, 'lb').quantity).toBeCloseTo(453.592, 3);
    expect(toBase(1, 'cup').quantity).toBeCloseTo(236.588, 3);
  });

  it('agrees with kitchen equivalences', () => {
    expect(convert(1, 'lb', 'oz')).toBeCloseTo(16);
    expect(convert(1, 'tbsp', 'tsp')).toBeCloseTo(3);
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16);
    expect(convert(1, 'cup', 'fl oz')).toBeCloseTo(8);
  });

  it('round-trips every unit through its base', () => {
    for (const unit of INPUT_UNITS) {
      const base = toBase(2.5, unit);
      expect(convert(base.quantity, base.unit, unit)).toBeCloseTo(2.5);
    }
  });

  it('refuses to mix weight, volume and count', () => {
    expect(areCompatible('g', 'lb')).toBe(true);
    expect(areCompatible('g', 'ml')).toBe(false);
    expect(areCompatible('piece', 'g')).toBe(false);
    expect(() => convert(1, 'cup', 'g')).toThrow('Cannot convert');
  });
});

describe('display', () => {
  it('uses the unit a cook would reach for', () => {
    expect(displayUnit(999, 'g', 'metric')).toBe('g');
    expect(displayUnit(1000, 'g', 'metric')).toBe('kg');
    expect(displayUnit(2000, 'ml', 'metric')).toBe('l');
    expect(displayUnit(100, 'g', 'imperial')).toBe('oz');
    expect(displayUnit(500, 'g', 'imperial')).toBe('lb');
    expect(displayUnit(5, 'ml', 'imperial')).toBe('tsp');
    expect(displayUnit(15, 'ml', 'imperial')).toBe('tbsp');
    expect(displayUnit(250, 'ml', 'imperial')).toBe('cup');
  });

  it('only ever shows units of the chosen system', () => {
    for (const system of ['metric', 'imperial'] as const) {
      for (const unit of ['g', 'ml', 'piece'] as const) {
        for (const quantity of [0.5, 3, 40, 300, 5000]) {
          expect(unitsForSystem(system)).toContain(toDisplay(quantity, unit, system).unit);
        }
      }
    }
  });

  it('formats for reading', () => {
    expect(formatQuantity(1250, 'g', 'metric')).toBe('1.25 kg');
    expect(formatQuantity(15, 'ml', 'metric')).toBe('15 ml');
    expect(formatQuantity(1, 'piece', 'metric')).toBe('1 pc');
    expect(formatQuantity(3, 'piece', 'imperial')).toBe('3 pcs');
    expect(formatQuantity(toBase(1.5, 'cup').quantity, 'ml', 'imperial')).toBe('1 ½ cups');
    expect(formatQuantity(toBase(0.5, 'tsp').quantity, 'ml', 'imperial')).toBe('½ tsp');
    expect(formatQuantity(null, 'g', 'metric')).toBe('');
  });

  it('never shows a real amount as zero', () => {
    expect(formatQuantity(0.2, 'ml', 'imperial')).not.toMatch(/^0 /);
    expect(formatQuantity(0.3, 'g', 'metric')).toBe('0.3 g');
    expect(formatQuantity(0.3, 'g', 'imperial')).not.toMatch(/^0 /);
  });
});

describe('parseQuantity', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['.25', 0.25],
    [' 3 ', 3],
  ])('reads %s', (input, expected) => {
    expect(parseQuantity(input)).toBeCloseTo(expected);
  });

  it.each(['', 'abc', '0', '-1', '1/0', '2 cups'])('rejects "%s"', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});
