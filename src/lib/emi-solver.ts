/**
 * Client mirror of the backend BHPH EMI math (cdms-backend/src/modules/bhph/
 * emi-math.ts) for live "fill any two → the third" preview in the create form.
 * Returns null on unsolvable/invalid input so the form never throws; the
 * backend re-solves canonically on submit.
 */

export function calcEmi(principal: number, ratePercent: number, termMonths: number): number | null {
  if (!(principal > 0) || !(termMonths > 0)) return null;
  const r = ratePercent / 100 / 12;
  if (r === 0) return principal / termMonths;
  const pow = Math.pow(1 + r, termMonths);
  return (principal * r * pow) / (pow - 1);
}

/** Months from principal + rate + EMI (rounded up). Null if EMI can't amortize. */
export function calcTerm(principal: number, ratePercent: number, emi: number): number | null {
  if (!(principal > 0) || !(emi > 0)) return null;
  const r = ratePercent / 100 / 12;
  if (r === 0) return Math.ceil(principal / emi);
  const monthlyInterest = principal * r;
  if (emi <= monthlyInterest) return null; // never repays
  const n = Math.log(emi / (emi - monthlyInterest)) / Math.log(1 + r);
  return Math.max(1, Math.ceil(n - 1e-9));
}

/** Annual rate % from principal + term + EMI (bisection). Null if impossible. */
export function calcRate(principal: number, termMonths: number, emi: number): number | null {
  if (!(principal > 0) || !(termMonths > 0) || !(emi > 0)) return null;
  const zeroRateEmi = principal / termMonths;
  if (emi <= zeroRateEmi + 1e-9) return emi < zeroRateEmi - 1e-6 ? null : 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const guess = calcEmi(principal, mid * 1200, termMonths);
    if (guess === null) return null;
    if (guess > emi) hi = mid; else lo = mid;
    if (hi - lo < 1e-12) break;
  }
  return Math.round(((lo + hi) / 2) * 1200 * 100) / 100;
}

export type EmiField = "rate" | "term" | "emi";

/**
 * Given the principal and the two non-target values, compute `target`.
 * Values may be undefined; returns null when it can't be solved.
 */
export function computeMissing(
  principal: number,
  vals: { rate?: number; term?: number; emi?: number },
  target: EmiField,
): number | null {
  if (!(principal > 0)) return null;
  if (target === "emi") {
    if (vals.rate === undefined || vals.term === undefined) return null;
    return calcEmi(principal, vals.rate, vals.term);
  }
  if (target === "term") {
    if (vals.rate === undefined || vals.emi === undefined) return null;
    return calcTerm(principal, vals.rate, vals.emi);
  }
  // target === "rate"
  if (vals.term === undefined || vals.emi === undefined) return null;
  return calcRate(principal, vals.term, vals.emi);
}
