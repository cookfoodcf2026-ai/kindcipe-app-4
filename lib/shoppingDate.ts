export type BuyDateForMeal =
  | { ok: true; date: string; manual: boolean }
  | { ok: false; reason: "meal_past" };

function shiftISODate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buyDateForMeal(mealDate: string | null | undefined, today: string): BuyDateForMeal {
  if (!mealDate) return { ok: true, date: today, manual: true };
  if (mealDate < today) return { ok: false, reason: "meal_past" };
  if (mealDate === today) return { ok: true, date: today, manual: false };
  return { ok: true, date: shiftISODate(mealDate, -1), manual: false };
}
