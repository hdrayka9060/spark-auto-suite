/**
 * pdf.js v6 calls `Map.prototype.getOrInsertComputed` / `getOrInsert` (and the
 * WeakMap equivalents) — a very new TC39 proposal method that older iOS/Safari
 * builds don't have, so PDF rendering crashes on those devices with
 * "getOrInsertComputed is not a function". pdf.js uses it on BOTH the main
 * thread and inside its worker, so import this side-effect module before pdf.js
 * in each scope (the app imports it in SignatureDialog; the worker entry imports
 * it before the pdf.js worker). No-op where the methods already exist.
 */
interface MapLike {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
}

function patch(proto: Record<string, unknown> | null | undefined): void {
  if (!proto) return;
  if (typeof proto.getOrInsertComputed !== "function") {
    Object.defineProperty(proto, "getOrInsertComputed", {
      value(this: MapLike, key: unknown, compute: (k: unknown) => unknown) {
        if (!this.has(key)) this.set(key, compute(key));
        return this.get(key);
      },
      writable: true,
      configurable: true,
    });
  }
  if (typeof proto.getOrInsert !== "function") {
    Object.defineProperty(proto, "getOrInsert", {
      value(this: MapLike, key: unknown, value: unknown) {
        if (!this.has(key)) this.set(key, value);
        return this.get(key);
      },
      writable: true,
      configurable: true,
    });
  }
}

patch(typeof Map !== "undefined" ? (Map.prototype as unknown as Record<string, unknown>) : null);
patch(typeof WeakMap !== "undefined" ? (WeakMap.prototype as unknown as Record<string, unknown>) : null);

export {};
