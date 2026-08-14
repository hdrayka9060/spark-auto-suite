import { describe, it, expect } from 'vitest';
import {
  vinCheckDigitOk,
  sanitizeVinChars,
  repairVinByCheckDigit,
  extractVinCandidates,
  pickBestVin,
  readVinFromText,
} from './vin-scan';

// The three real VINs from the sample scan images — all check-digit valid.
const TESLA = '7SAYGDEE9PF626297';
const TOYOTA = '2T1BURHE0HC908144';
const KIA = 'KNAGM4A72D5442015';

describe('vinCheckDigitOk', () => {
  it('validates the three sample VINs', () => {
    expect(vinCheckDigitOk(TESLA)).toBe(true);
    expect(vinCheckDigitOk(TOYOTA)).toBe(true);
    expect(vinCheckDigitOk(KIA)).toBe(true);
  });

  it('rejects a tampered VIN', () => {
    // Flip the last char away from the correct check-consistent value.
    expect(vinCheckDigitOk('2T1BURHE0HC908145')).toBe(false);
  });

  it('rejects malformed input (wrong length / illegal chars)', () => {
    expect(vinCheckDigitOk('SHORT')).toBe(false);
    expect(vinCheckDigitOk('IOQ' + TOYOTA.slice(3))).toBe(false); // I/O/Q illegal
  });
});

describe('sanitizeVinChars', () => {
  it('uppercases, strips punctuation/space, and coerces I/O/Q → 1/0/0', () => {
    expect(sanitizeVinChars(' knagm4a72d5442o15 ')).toBe('KNAGM4A72D5442015');
    expect(sanitizeVinChars('2T1-BUR HE0 HC90 8144')).toBe('2T1BURHE0HC908144');
  });
});

describe('extractVinCandidates', () => {
  it('finds the VIN inside registration-cert OCR text', () => {
    const ocr = 'Vehicle identification number (VIN)\n7SAYGDEE9PF626297   Scale We 4,364';
    expect(extractVinCandidates(ocr)).toContain(TESLA);
  });

  it('finds the VIN inside a CARFAX screenshot line', () => {
    const ocr = '2013 KIA OPTIMA\nSedan | 4 Cylinders | Gas\nKNAGM4A72D5442015\nCountry of Assembly: Korea';
    expect(extractVinCandidates(ocr)).toContain(KIA);
  });

  it('recovers a VIN split by stray OCR spaces', () => {
    expect(extractVinCandidates('2T1BURHE0 HC908144')).toContain(TOYOTA);
  });

  it('returns nothing for text with no 17-char run', () => {
    expect(extractVinCandidates('just some words 12345')).toEqual([]);
  });
});

describe('repairVinByCheckDigit', () => {
  it('returns the VIN unchanged when it is already valid', () => {
    expect(repairVinByCheckDigit(KIA)).toBe(KIA);
  });

  it('deterministically fixes an illegal-letter slip (O→0) to a valid VIN', () => {
    const fixed = repairVinByCheckDigit('KNAGM4A72D5442O15');
    expect(fixed).toBe(KIA);
    expect(vinCheckDigitOk(fixed as string)).toBe(true);
  });

  it('refuses to guess when a corruption has more than one valid repair', () => {
    // '2T18URHE0HC908144' can validate by swapping either the pos-4 '8'→'B'
    // (→ the real Toyota VIN) OR the pos-14 '8'→'B' — ambiguous, so we bail.
    expect(repairVinByCheckDigit('2T18URHE0HC908144')).toBeNull();
  });
});

describe('pickBestVin / readVinFromText', () => {
  it('prefers a check-digit-valid candidate and marks it verified', () => {
    const pick = pickBestVin([KIA]);
    expect(pick).toEqual({ vin: KIA, verified: true });
  });

  it('coerces an O→0 OCR slip and still verifies', () => {
    const pick = pickBestVin(['KNAGM4A72D5442O15']);
    expect(pick?.vin).toBe(KIA);
    expect(pick?.verified).toBe(true);
  });

  it('end-to-end reads a VIN from noisy OCR text', () => {
    const pick = readVinFromText('  vin: 7saygdee9pf626297  (scale weight)');
    expect(pick).toEqual({ vin: TESLA, verified: true });
  });

  it('returns null when no candidate exists', () => {
    expect(readVinFromText('no vin here')).toBeNull();
  });
});
