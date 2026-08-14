// @vitest-environment node
/**
 * END-TO-END OCR smoke: runs Tesseract.js over the REAL sample VIN photos in
 * test-fixtures/ and asserts the vin-scan pipeline recovers the exact VIN — the
 * one link the pure-text unit tests can't cover (does OCR actually read a real
 * photo?).
 *
 * Slow (~10-30s) and downloads the Tesseract English model from a CDN on first
 * run, so it's SKIPPED in the normal suite. Run it explicitly:
 *
 *   VIN_OCR_SMOKE=1 npx vitest run src/lib/vin-scan.ocr.test.ts
 *   (PowerShell:  $env:VIN_OCR_SMOKE=1; npx vitest run src/lib/vin-scan.ocr.test.ts)
 */
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createWorker, PSM } from 'tesseract.js';
import { readVinFromText, vinCheckDigitOk } from './vin-scan';

const RUN = !!process.env.VIN_OCR_SMOKE;

// Real photos the user provided, copied into the repo for a reproducible smoke.
// The Toyota one is a moiré-heavy photo of a monitor — the case that forced the
// switch from PSM 11 (sparse) to PSM 6 (single block); keep it as a guard.
const CASES = [
  { file: 'vin-toyota-screen.jpeg', expected: '2T1BURHE0HC908144' },
  { file: 'vin-kia-carfax-crop.jpeg', expected: 'KNAGM4A72D5442015' },
  { file: 'vin-kia-carfax-full.jpeg', expected: 'KNAGM4A72D5442015' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let worker: any;

async function ocr(file: string): Promise<string> {
  if (!worker) {
    worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789',
      // Mirrors VinScannerDialog's primary mode.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
  }
  const buf = await fs.readFile(path.resolve('test-fixtures', file));
  const { data } = await worker.recognize(buf);
  return data.text as string;
}

describe.skipIf(!RUN)('OCR end-to-end on real VIN photos', () => {
  afterAll(async () => { if (worker) await worker.terminate(); });

  for (const c of CASES) {
    it(`reads ${c.expected} from ${c.file}`, async () => {
      const text = await ocr(c.file);
      const pick = readVinFromText(text);
      expect(pick, `no VIN extracted from OCR of ${c.file}:\n${text}`).not.toBeNull();
      expect(pick!.vin).toBe(c.expected);
      expect(vinCheckDigitOk(pick!.vin)).toBe(true);
    }, 60_000);
  }
});
