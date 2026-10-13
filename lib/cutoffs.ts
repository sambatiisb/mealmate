const QUAD_TIMEZONE = "Asia/Kolkata";

/** Current time as "HH:MM" in the quad's operating timezone (IST — MVP assumes a single timezone, no per-user handling). */
export function currentTimeIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: QUAD_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function currentWeekday(now: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: QUAD_TIMEZONE,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday] ?? 0;
}

function istDateKey(now: Date, dayOffset: number): string {
  const shifted = new Date(now.getTime() + dayOffset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUAD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** Real instant for a "HH:MM" IST cutoff on the IST calendar day `dayOffset` days from `now`. */
function cutoffInstant(cutoff: string, dayOffset: number, now: Date): Date {
  return new Date(`${istDateKey(now, dayOffset)}T${cutoff}:00+05:30`);
}

interface QuadCutoffs {
  lunchCutoff: string;
  dinnerCutoff: string;
}

/**
 * Skip/edit window bounds for `meal` on the week-day-index `dayOffset` days
 * from today (may be negative for a day earlier this week). Lunch opens at
 * the *previous* day's dinner cutoff (so it's actionable the evening
 * before); dinner opens at the *same* day's lunch cutoff.
 */
function skipWindowBounds(meal: "lunch" | "dinner", dayOffset: number, quad: QuadCutoffs, now: Date) {
  return meal === "lunch"
    ? { opensAt: cutoffInstant(quad.dinnerCutoff, dayOffset - 1, now), closesAt: cutoffInstant(quad.lunchCutoff, dayOffset, now) }
    : { opensAt: cutoffInstant(quad.lunchCutoff, dayOffset, now), closesAt: cutoffInstant(quad.dinnerCutoff, dayOffset, now) };
}

/** Is the skip window currently open for `meal` on week-day-index `targetDay` (0=Mon..6=Sun, this week)? */
export function isSkipWindowOpen(
  meal: "lunch" | "dinner",
  targetDay: number,
  quad: QuadCutoffs,
  now: Date = new Date()
): boolean {
  const dayOffset = targetDay - currentWeekday(now);
  const { opensAt, closesAt } = skipWindowBounds(meal, dayOffset, quad, now);
  return now >= opensAt && now < closesAt;
}

/** Is `now` still before `meal`'s cutoff on week-day-index `targetDay`? (No "too early" concept — unlike skipping, edits are allowed any time up to the deadline.) */
export function isBeforeMealCutoff(
  meal: "lunch" | "dinner",
  targetDay: number,
  quad: QuadCutoffs,
  now: Date = new Date()
): boolean {
  const dayOffset = targetDay - currentWeekday(now);
  const { closesAt } = skipWindowBounds(meal, dayOffset, quad, now);
  return now < closesAt;
}

export interface MealSlot {
  day: number;
  isOpen: boolean;
}

/**
 * Which day's lunch/dinner the Home tab should show right now: today, until
 * today's window for that meal closes, then tomorrow (capped at Sunday —
 * doesn't reach into next week's not-yet-generated menu).
 */
export function homeMealSlot(meal: "lunch" | "dinner", quad: QuadCutoffs, now: Date = new Date()): MealSlot {
  const today = currentWeekday(now);
  const { closesAt } = skipWindowBounds(meal, 0, quad, now);
  if (now < closesAt || today === 6) {
    return { day: today, isOpen: isSkipWindowOpen(meal, today, quad, now) };
  }
  const tomorrow = today + 1;
  return { day: tomorrow, isOpen: isSkipWindowOpen(meal, tomorrow, quad, now) };
}
