/** Puts recognised lines of text in reading order, across columns. */

export interface TextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const right = (box: TextBox) => box.x + box.width;
const bottom = (box: TextBox) => box.y + box.height;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** The widest empty band across all boxes along one axis. */
function widestGap(
  boxes: TextBox[],
  start: (box: TextBox) => number,
  end: (box: TextBox) => number,
): { at: number; size: number } | null {
  const sorted = [...boxes].sort((a, b) => start(a) - start(b));
  let reached = end(sorted[0]!);
  let best: { at: number; size: number } | null = null;
  for (const box of sorted.slice(1)) {
    const size = start(box) - reached;
    if (size > 0 && (!best || size > best.size)) best = { at: reached + size / 2, size };
    reached = Math.max(reached, end(box));
  }
  return best;
}

const AMOUNT = /^[\d\s./½⅓⅔¼¾⅛-]+\s*(?:kg|g|grams?|kilo|ml|l|lb|lbs|oz|tsp|tbsp|teaspoons?|tablespoons?|cups?|pcs?|pieces?|cloves?|cans?)?\.?$/i;

/** Amounts in one column and names in the next are one line each. */
function joinRows(boxes: TextBox[]): string[] {
  const rows: TextBox[][] = [];
  for (const box of [...boxes].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2))) {
    const middle = box.y + box.height / 2;
    const row = rows.find((items) => items.some((item) => middle >= item.y && middle <= bottom(item)));
    if (row) row.push(box);
    else rows.push([box]);
  }
  return rows.map((row) =>
    row
      .sort((a, b) => a.x - b.x)
      .map((box) => box.text)
      .join(' '),
  );
}

function order(boxes: TextBox[], lineHeight: number, depth: number): string[] {
  if (boxes.length <= 1 || depth > 20) return joinRows(boxes);

  const column = widestGap(boxes, (box) => box.x, right);
  const band = widestGap(boxes, (box) => box.y, bottom);
  const before = column ? boxes.filter((box) => box.x < column.at) : [];
  const after = column ? boxes.filter((box) => box.x >= column.at) : [];
  const isColumn = column !== null && column.size >= lineHeight * 0.6 && before.length > 1 && after.length > 1;

  // A title above the columns belongs to neither.
  const title = band && band.size >= lineHeight ? boxes.filter((box) => box.y < band.at) : [];
  const isTitle =
    isColumn && title.length > 0 && title.length <= 3 &&
    (title.every((box) => box.x < column.at) || title.every((box) => box.x >= column.at));

  if (isColumn && !isTitle) {
    const amounts = before.filter((box) => AMOUNT.test(box.text.trim())).length;
    if (amounts >= before.length * 0.7) return joinRows(boxes);
    return [...order(before, lineHeight, depth + 1), ...order(after, lineHeight, depth + 1)];
  }
  if (band) {
    const above = boxes.filter((box) => box.y < band.at);
    const below = boxes.filter((box) => box.y >= band.at);
    return [...order(above, lineHeight, depth + 1), ...order(below, lineHeight, depth + 1)];
  }
  return joinRows(boxes);
}

export function readingOrder(boxes: TextBox[]): string {
  const usable = boxes.filter((box) => box.text.trim() !== '' && box.width > 0 && box.height > 0);
  return order(usable, median(usable.map((box) => box.height)), 0).join('\n');
}
