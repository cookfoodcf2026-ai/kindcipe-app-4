/**
 * Pure helpers for localized price strings.
 *
 * StoreKit / Stripe return the real charge in the storefront's own currency
 * and formatting ("US$49.99", "HK$388.00", "$49.99", "49,99 €"). Paywall copy
 * must never hardcode HK$ for a non-HK storefront (App Review 3.1.2).
 */

type ParsedPrice = {
  /** Currency symbol or code, e.g. "US$", "HK$", "$", "€". */
  prefix: string;
  /** Whitespace between a leading prefix and the number, if any. */
  separator: string;
  amount: number;
};

function parseLocalizedNumber(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let decimalSep: "," | "." | null = null;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the right-most one is the decimal separator, the other is grouping.
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma !== -1) {
    const after = raw.length - lastComma - 1;
    const groups = raw.split(",").length - 1;
    decimalSep = groups === 1 && after <= 2 ? "," : null;
  } else if (lastDot !== -1) {
    const after = raw.length - lastDot - 1;
    const groups = raw.split(".").length - 1;
    decimalSep = groups === 1 && after <= 2 ? "." : null;
  }

  let normalized = raw;
  if (decimalSep === ",") {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (decimalSep === ".") {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/[.,]/g, "");
  }

  // Reject anything that is not purely numeric after separator normalization.
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function parsePrice(priceString: string): ParsedPrice | null {
  const raw = String(priceString ?? "").trim();
  if (!raw) return null;

  let prefix = "";
  let separator = "";
  let rest = raw;

  // Leading currency symbol/code before the first digit ("US$49.99", "$ 49.99").
  const leading = raw.match(/^([^\d]+?)(\s*)(?=\d)/u);
  if (leading) {
    prefix = leading[1].trim();
    separator = leading[2] ?? "";
    rest = raw.slice(leading[0].length);
  } else {
    // Trailing currency symbol ("49,99 €").
    const trailing = raw.match(/([^\d\s.,+-]+)\s*$/u);
    if (trailing && trailing.index !== undefined) {
      prefix = trailing[1];
      rest = raw.slice(0, trailing.index).trim();
    }
  }

  const numeric = rest.match(/-?[\d.,]+/);
  if (!numeric || numeric.index !== 0) return null;
  const amount = parseLocalizedNumber(numeric[0]);
  if (amount === null) return null;

  return { prefix, separator, amount };
}

/**
 * Approximate monthly cost of a yearly price, keeping the same currency.
 * Returns null when the string cannot be parsed.
 */
export function perMonthFromYearly(priceString: string): string | null {
  const parsed = parsePrice(priceString);
  if (!parsed) return null;

  // Truncate to cents so the displayed estimate never overstates the charge.
  const cents = Math.floor((parsed.amount / 12) * 100 + 1e-9);
  const value = cents / 100;
  const text = cents % 100 === 0 ? String(value) : value.toFixed(2);
  return `${parsed.prefix}${parsed.separator}${text}`;
}

/**
 * Yearly saving vs paying monthly, rounded to the nearest whole percent.
 * Returns null when either price cannot be parsed or the currencies differ.
 */
export function yearlySavePct(
  monthlyPriceString: string,
  yearlyPriceString: string
): number | null {
  const monthly = parsePrice(monthlyPriceString);
  const yearly = parsePrice(yearlyPriceString);
  if (!monthly || !yearly) return null;
  if (monthly.amount <= 0 || yearly.amount < 0) return null;
  if (
    monthly.prefix &&
    yearly.prefix &&
    monthly.prefix !== yearly.prefix
  ) {
    return null;
  }

  const monthlyYear = monthly.amount * 12;
  if (monthlyYear <= 0) return null;

  const pct = Math.round((1 - yearly.amount / monthlyYear) * 100);
  return Number.isFinite(pct) ? pct : null;
}
