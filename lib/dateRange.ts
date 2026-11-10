function shiftISODate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build an inclusive list of ISO dates starting at `startISO`.
 * When `maxDate` is provided, generation stops before any date beyond it.
 */
export function buildDateRange(
  startISO: string,
  maxDate?: string | null,
  maxDays = 60,
): string[] {
  if (!startISO) return [];
  const dates: string[] = [];
  let cursor = startISO;
  for (let i = 0; i < maxDays; i++) {
    if (maxDate && cursor > maxDate) break;
    dates.push(cursor);
    cursor = shiftISODate(cursor, 1);
  }
  return dates;
}

/**
 * Clamp an ISO date into [minDate, maxDate]. Either bound may be omitted.
 */
export function clampDateToRange(
  dateISO: string,
  minDate?: string | null,
  maxDate?: string | null,
): string {
  let result = dateISO;
  if (minDate && result < minDate) result = minDate;
  if (maxDate && result > maxDate) result = maxDate;
  return result;
}
