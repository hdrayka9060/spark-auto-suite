/**
 * Pure, framework-free helpers for reading a VIN out of scanned text (barcode
 * payload or OCR output). No React, no DOM — so it's unit-testable in isolation
 * (see scripts/smoke-vin-scan.mjs) and shared by the barcode path and the OCR
 * path in VinScannerDialog.
 *
 * A VIN is 17 chars from the alphabet A–Z + 0–9 **excluding I, O, Q** (ISO-3779).
 * We use the North-American check digit (position 9) as a CONFIDENCE + REPAIR
 * signal, never as a hard gate: many valid non-US-market VINs don't satisfy it,
 * so a well-formed 17-char read that fails the check digit is still returned —
 * flagged `verified: false` so the UI can nudge the user to confirm.
 */

export const VIN_LENGTH = 17;

/** Legal VIN string: exactly 17 chars, letters/digits, no I/O/Q. */
export const VIN_STRICT_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export interface VinPick {
  vin: string;
  /** true when the check digit validates (or a repair made it validate). */
  verified: boolean;
}

// ── Check digit (ISO-3779 / North America) ─────────────────────────────────

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** True if `vin` is well-formed AND its position-9 check digit validates. */
export function vinCheckDigitOk(vin: string): boolean {
  const v = (vin ?? '').toUpperCase();
  if (!VIN_STRICT_RE.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const val = TRANSLIT[v[i]];
    if (val === undefined) return false;
    sum += val * WEIGHTS[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? 'X' : String(rem);
  return v[8] === expected;
}

// ── OCR repair ──────────────────────────────────────────────────────────────

/**
 * Confusable pairs among LEGAL VIN characters (both directions). The three
 * chars a VIN never contains — I, O, Q — are handled by `sanitizeVinChars`
 * (mapped to 1, 0, 0 respectively) before we ever get here.
 */
const CONFUSIONS: Record<string, string[]> = {
  '0': ['D'], D: ['0'],
  '1': ['L'], L: ['1'],
  '2': ['Z'], Z: ['2'],
  '4': ['A'], A: ['4'],
  '5': ['S'], S: ['5'],
  '6': ['G'], G: ['6'],
  '7': ['T'], T: ['7'],
  '8': ['B'], B: ['8'],
};

/** Cap the mixed-radix repair search so a very ambiguous read can't hang the UI. */
const REPAIR_SEARCH_CAP = 20000;

/**
 * Uppercase, drop every non-alphanumeric, and coerce the three impossible VIN
 * letters onto their digit look-alikes (I→1, O→0, Q→0).
 */
export function sanitizeVinChars(raw: string): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/O/g, '0')
    .replace(/Q/g, '0');
}

/**
 * Try to turn a 17-char candidate into a check-digit-valid VIN by swapping
 * confusable characters. Returns the repaired VIN, or null if the input isn't
 * 17 chars, no swap validates, or — crucially — the swap is **ambiguous**
 * (more than one distinct valid VIN in the bounded search). We only auto-correct
 * when there's exactly ONE valid answer; otherwise we'd risk handing back a
 * confidently-wrong VIN, so we bail and let the caller surface it unverified.
 */
export function repairVinByCheckDigit(raw: string): string | null {
  const base = sanitizeVinChars(raw);
  if (base.length !== VIN_LENGTH) return null;
  if (vinCheckDigitOk(base)) return base;

  const options = base.split('').map((ch) => [ch, ...(CONFUSIONS[ch] ?? [])]);
  const product = options.reduce((n, o) => n * o.length, 1);
  if (product > REPAIR_SEARCH_CAP) return null; // too ambiguous to safely brute-force

  const valid = new Set<string>();
  const idx = new Array(VIN_LENGTH).fill(0);
  for (let count = 0; count < product; count++) {
    let candidate = '';
    for (let i = 0; i < VIN_LENGTH; i++) candidate += options[i][idx[i]];
    if (vinCheckDigitOk(candidate)) {
      valid.add(candidate);
      if (valid.size > 1) return null; // ambiguous — don't guess
    }
    // increment the mixed-radix counter
    for (let i = VIN_LENGTH - 1; i >= 0; i--) {
      idx[i]++;
      if (idx[i] < options[i].length) break;
      idx[i] = 0;
    }
  }
  return valid.size === 1 ? [...valid][0] : null;
}

// ── Extraction & selection ──────────────────────────────────────────────────

/**
 * Pull every well-formed 17-char VIN candidate out of arbitrary text
 * (OCR output or a barcode payload). Tokenizes on non-alphanumerics, slides a
 * 17-char window over long tokens, and also considers the fully-compacted
 * string as a fallback for VINs that got split by stray spaces.
 */
export function extractVinCandidates(text: string): string[] {
  const out = new Set<string>();
  const tokens = (text ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

  const windows = (s: string, requireValid: boolean) => {
    // Coerce impossible letters so an OCR'd "O"/"I"/"Q" doesn't disqualify a run.
    const t = s.replace(/I/g, '1').replace(/O/g, '0').replace(/Q/g, '0');
    if (t.length < VIN_LENGTH) return;
    for (let i = 0; i + VIN_LENGTH <= t.length; i++) {
      const win = t.slice(i, i + VIN_LENGTH);
      if (!VIN_STRICT_RE.test(win)) continue;
      if (requireValid && !vinCheckDigitOk(win)) continue;
      out.add(win);
    }
  };

  // Primary: each contiguous token, kept whether or not the check digit
  // validates (a real VIN token may be from a non-US market that doesn't).
  tokens.forEach((t) => windows(t, false));

  // Fallback for a VIN split by stray spaces: join ADJACENT tokens only, and
  // keep a window only when its check digit validates — so ordinary prose
  // (e.g. "just some words 12345") can't concatenate into a phantom VIN.
  for (let i = 0; i < tokens.length; i++) {
    let joined = tokens[i];
    for (let j = i + 1; j < tokens.length && joined.length < VIN_LENGTH + 8; j++) {
      joined += tokens[j];
      windows(joined, true);
    }
  }
  return [...out];
}

/**
 * Choose the best VIN from a set of raw candidates:
 *   1. a candidate whose check digit already validates (verified)
 *   2. else a candidate that a bounded OCR-repair makes valid (verified)
 *   3. else the first well-formed candidate (unverified — UI should confirm)
 */
export function pickBestVin(candidates: string[]): VinPick | null {
  const clean = candidates.map(sanitizeVinChars).filter((c) => VIN_STRICT_RE.test(c));
  if (clean.length === 0) return null;

  for (const c of clean) if (vinCheckDigitOk(c)) return { vin: c, verified: true };
  for (const c of clean) {
    const fixed = repairVinByCheckDigit(c);
    if (fixed) return { vin: fixed, verified: true };
  }
  return { vin: clean[0], verified: false };
}

/** Convenience: extract candidates from text and pick the best in one call. */
export function readVinFromText(text: string): VinPick | null {
  return pickBestVin(extractVinCandidates(text));
}
