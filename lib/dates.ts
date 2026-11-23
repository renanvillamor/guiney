/** Calendar days as YYYY-MM-DD strings, in local time. They sort and compare as text. */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Noon avoids daylight-saving edges when adding days. */
export function fromISODate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export const today = (): string => toISODate(new Date());

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

export function dateRange(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const weekday = fromISODate(iso).getDay();
  return addDays(iso, -((weekday + 6) % 7));
}

export type PlanRange = 'this-week' | 'next-week' | 'two-weeks';

export function planRange(range: PlanRange, now: string): { start: string; end: string } {
  const monday = startOfWeek(now);
  switch (range) {
    case 'this-week':
      return { start: monday, end: addDays(monday, 6) };
    case 'next-week':
      return { start: addDays(monday, 7), end: addDays(monday, 13) };
    case 'two-weeks':
      return { start: now, end: addDays(now, 13) };
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const weekday = (iso: string): string => WEEKDAYS[fromISODate(iso).getDay()] ?? '';

/** "24 Nov", with the year only when it is not this year. */
export function formatDate(iso: string, now: string = today()): string {
  const date = fromISODate(iso);
  const year = iso.slice(0, 4) === now.slice(0, 4) ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

/** "Today", "Yesterday", "3 days ago". */
export function daysAgo(iso: string, now: string = today()): string {
  const days = daysBetween(iso, now);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 0) return formatDate(iso, now);
  return `${days} days ago`;
}

export type Freshness = 'expired' | 'soon' | 'fresh' | 'none';
export const SOON_DAYS = 3;

/** Food is still good on its expiry date and expired the day after. */
export function freshness(expiry: string | null, now: string = today()): Freshness {
  if (!expiry) return 'none';
  const left = daysBetween(now, expiry);
  if (left < 0) return 'expired';
  return left <= SOON_DAYS ? 'soon' : 'fresh';
}

export function expiryLabel(expiry: string, now: string = today()): string {
  const left = daysBetween(now, expiry);
  if (left < -1) return `Expired ${-left} days ago`;
  if (left === -1) return 'Expired yesterday';
  if (left === 0) return 'Use today';
  if (left === 1) return 'Use by tomorrow';
  if (left <= 14) return `${left} days left`;
  return `Use by ${formatDate(expiry, now)}`;
}
