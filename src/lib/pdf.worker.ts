/**
 * Custom pdf.js worker entry. Installs the getOrInsertComputed polyfill in the
 * WORKER scope before the pdf.js worker initializes, so PDF parsing/rendering
 * works on older iOS/Safari. Loaded via Vite `?worker` and wired as
 * GlobalWorkerOptions.workerPort in SignatureDialog.
 */
import "./pdf-polyfill";
// Side-effect import: the pdf.js worker self-registers its message handler.
// @ts-expect-error — no type declarations for the deep .mjs build path.
import "pdfjs-dist/build/pdf.worker.min.mjs";
