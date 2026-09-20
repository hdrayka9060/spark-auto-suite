import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Check, Loader2, Maximize, Minimize, PenLine, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { BuyerDoc } from "@/lib/document-mapper";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** A placed signature: normalized CENTER coords (0..1) + width on a page. */
export interface Placement {
  id?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  signatureImage: string;
}

interface Pt { x: number; y: number }
interface Stroke { page: number; points: Pt[] }
interface RenderedPage { page: number; dataUrl: string; w: number; h: number }
interface SigObject { id: string; page: number; x: number; y: number; width: number; signatureImage: string }

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: BuyerDoc | null;
  defaultSignerName?: string;
  onSubmit: (placements: Placement[], signerName: string) => Promise<void>;
}

const MIN_ZOOM = 1, MAX_ZOOM = 5;
const PEN = "#111827";
const uid = () => Math.random().toString(36).slice(2);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Sign a document by drawing directly on it. Flow:
 *  • Move mode (default): the document scrolls; placed signatures can be dragged
 *    to reposition and resized from their corner handle.
 *  • Draw mode ("Add signature"): finger/mouse draws a signature on the page;
 *    Undo removes the last stroke; "Done" turns the ink into a movable/resizable
 *    signature object. Zoom in to sign small areas; Fullscreen for more room.
 * On save, each object is sent as a placement the backend stamps into the PDF.
 */
export function SignatureDialog({
  open, onOpenChange, doc, defaultSignerName = "", onSubmit,
}: SignatureDialogProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"move" | "draw">("move");
  const [objects, setObjects] = useState<SigObject[]>([]);
  const [strokeCount, setStrokeCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fs, setFs] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageBoxRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const drawing = useRef<{ page: number; canvas: HTMLCanvasElement } | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; objX: number; objY: number; rw: number; rh: number } | null>(null);
  const resize = useRef<{ id: string; startX: number; objW: number; rw: number } | null>(null);
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const isPdf = (doc?.fileMime || "").includes("pdf");
  const lineWidthFor = (w: number) => Math.max(2, w * 0.004);

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) => {
    if (!s.points.length) return;
    ctx.strokeStyle = PEN; ctx.lineWidth = lineWidthFor(w); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
    if (s.points.length === 1) ctx.lineTo(s.points[0].x * w + 0.1, s.points[0].y * h + 0.1);
    ctx.stroke();
  };

  const redrawDraw = useCallback((page: number) => {
    const c = drawCanvasRefs.current.get(page); if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokesRef.current) if (s.page === page) drawStroke(ctx, s, c.width, c.height);
  }, []);

  useEffect(() => {
    if (!open || !doc) return;
    let cancelled = false;
    strokesRef.current = [];
    setStrokeCount(0); setObjects([]); setPages([]); setLoadError(""); setZoom(1); setMode("move");
    setSignerName(defaultSignerName);
    (async () => {
      setLoadingDoc(true);
      try {
        if (isPdf) {
          const pdf = await pdfjsLib.getDocument({ url: doc.viewUrl }).promise;
          const out: RenderedPage[] = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width; canvas.height = viewport.height;
            const ctx = canvas.getContext("2d")!;
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            out.push({ page: n, dataUrl: canvas.toDataURL("image/png"), w: viewport.width, h: viewport.height });
            if (cancelled) return;
          }
          if (!cancelled) setPages(out);
        } else {
          const im = new Image(); im.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error("image load failed")); im.src = doc.viewUrl; });
          if (!cancelled) setPages([{ page: 1, dataUrl: doc.viewUrl, w: im.naturalWidth || 1000, h: im.naturalHeight || 1400 }]);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load the document.");
      } finally { if (!cancelled) setLoadingDoc(false); }
    })();
    return () => { cancelled = true; };
  }, [open, doc, isPdf, defaultSignerName]);

  useEffect(() => {
    for (const pg of pages) {
      const c = drawCanvasRefs.current.get(pg.page);
      if (c && (c.width !== pg.w || c.height !== pg.h)) { c.width = pg.w; c.height = pg.h; redrawDraw(pg.page); }
    }
  }, [pages, redrawDraw]);

  // Track fullscreen state (Esc etc.).
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const normOnCanvas = (canvas: HTMLElement, cx: number, cy: number): Pt => {
    const r = canvas.getBoundingClientRect();
    return { x: clamp((cx - r.left) / r.width, 0, 1), y: clamp((cy - r.top) / r.height, 0, 1) };
  };

  // ── Drawing (draw mode) ────────────────────────────────────────────────
  const onDrawPointerDown = (page: number, e: React.PointerEvent) => {
    if (mode !== "draw") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const canvas = drawCanvasRefs.current.get(page); if (!canvas) return;
    drawing.current = { page, canvas };
    strokesRef.current.push({ page, points: [normOnCanvas(canvas, e.clientX, e.clientY)] });
    setStrokeCount((n) => n + 1);
    redrawDraw(page);
    e.preventDefault();
  };
  const onDrawPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (stroke) { stroke.points.push(normOnCanvas(drawing.current.canvas, e.clientX, e.clientY)); redrawDraw(drawing.current.page); }
    e.preventDefault();
  };
  const onDrawPointerUp = () => { drawing.current = null; };

  const undo = () => {
    const last = strokesRef.current.pop();
    setStrokeCount((n) => Math.max(0, n - 1));
    if (last) redrawDraw(last.page);
  };

  const commitDrawing = () => {
    const strokes = strokesRef.current;
    if (!strokes.length) { setMode("move"); return; }
    const page = strokes[0].page;
    const pg = pages.find((p) => p.page === page);
    const pageStrokes = strokes.filter((s) => s.page === page && s.points.length);
    if (!pg || !pageStrokes.length) { strokesRef.current = []; setStrokeCount(0); setMode("move"); return; }
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const s of pageStrokes) for (const p of s.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    minX = clamp(minX - 0.01, 0, 1); minY = clamp(minY - 0.01, 0, 1); maxX = clamp(maxX + 0.01, 0, 1); maxY = clamp(maxY + 0.01, 0, 1);
    const bw = Math.max(0.03, maxX - minX), bh = Math.max(0.02, maxY - minY);
    const cw = Math.max(8, Math.round(bw * pg.w)), ch = Math.max(8, Math.round(bh * pg.h));
    const off = document.createElement("canvas"); off.width = cw; off.height = ch;
    const ctx = off.getContext("2d")!;
    ctx.strokeStyle = PEN; ctx.lineWidth = lineWidthFor(pg.w); ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const s of pageStrokes) {
      ctx.beginPath();
      s.points.forEach((p, i) => { const x = (p.x - minX) * pg.w, y = (p.y - minY) * pg.h; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      if (s.points.length === 1) ctx.lineTo((s.points[0].x - minX) * pg.w + 0.1, (s.points[0].y - minY) * pg.h + 0.1);
      ctx.stroke();
    }
    setObjects((prev) => [...prev, { id: uid(), page, x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: bw, signatureImage: off.toDataURL("image/png") }]);
    // Clear the transient ink + exit draw mode.
    strokesRef.current = []; setStrokeCount(0);
    for (const p of pages) redrawDraw(p.page);
    setMode("move");
  };

  const enterDraw = () => { strokesRef.current = []; setStrokeCount(0); setMode("draw"); };

  // ── Move / resize placed objects (move mode) ───────────────────────────
  const onObjDown = (o: SigObject, e: React.PointerEvent) => {
    if (mode !== "move") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const box = pageBoxRefs.current.get(o.page); if (!box) return;
    const r = box.getBoundingClientRect();
    drag.current = { id: o.id, startX: e.clientX, startY: e.clientY, objX: o.x, objY: o.y, rw: r.width, rh: r.height };
  };
  const onResizeDown = (o: SigObject, e: React.PointerEvent) => {
    if (mode !== "move") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const box = pageBoxRefs.current.get(o.page); if (!box) return;
    resize.current = { id: o.id, startX: e.clientX, objW: o.width, rw: box.getBoundingClientRect().width };
  };
  const onObjMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const d = drag.current;
      const nx = clamp(d.objX + (e.clientX - d.startX) / d.rw, 0, 1);
      const ny = clamp(d.objY + (e.clientY - d.startY) / d.rh, 0, 1);
      setObjects((prev) => prev.map((o) => (o.id === d.id ? { ...o, x: nx, y: ny } : o)));
      e.stopPropagation();
    } else if (resize.current) {
      const rz = resize.current;
      const nw = clamp(rz.objW + ((e.clientX - rz.startX) / rz.rw) * 2, 0.05, 1);
      setObjects((prev) => prev.map((o) => (o.id === rz.id ? { ...o, width: nw } : o)));
      e.stopPropagation();
    }
  };
  const onObjUp = () => { drag.current = null; resize.current = null; };
  const removeObject = (id: string) => setObjects((prev) => prev.filter((o) => o.id !== id));

  // ── Zoom / pinch / fullscreen ──────────────────────────────────────────
  const zoomBy = (f: number) => setZoom((z) => clamp(z * f, MIN_ZOOM, MAX_ZOOM));
  const resetZoom = () => setZoom(1);
  const onViewportTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinch.current) pinch.current = { d, zoom };
      else setZoom(clamp(pinch.current.zoom * (d / (pinch.current.d || 1)), MIN_ZOOM, MAX_ZOOM));
      e.preventDefault();
    }
  };
  const onViewportTouchEnd = (e: React.TouchEvent) => { if (e.touches.length < 2) pinch.current = null; };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current) await rootRef.current.requestFullscreen();
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!doc) return;
    if (!signerName.trim()) { toast({ title: "Signer name required", variant: "destructive" }); return; }
    if (mode === "draw" && strokesRef.current.length) commitDrawing();
    const placements = objects.map((o) => ({ page: o.page, x: o.x, y: o.y, width: o.width, signatureImage: o.signatureImage }));
    if (!placements.length) { toast({ title: "Add a signature first", description: "Tap “Add signature”, draw, then Done.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onSubmit(placements, signerName.trim());
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Signing failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-3xl">
        <div ref={rootRef} className="flex h-full flex-col bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" /> Sign: {doc?.title}
            </DialogTitle>
            <DialogDescription>
              {mode === "draw"
                ? "Draw the signature on the page, then tap Done. Undo removes the last stroke."
                : "Tap “Add signature” to sign. Drag a placed signature to move it, or its corner to resize."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Signer name</label>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full name of the person signing"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {mode === "move" ? (
                <button onClick={enterDraw} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4" /> Add signature
                </button>
              ) : (
                <>
                  <button onClick={commitDrawing} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Check className="h-4 w-4" /> Done
                  </button>
                  <button onClick={undo} disabled={strokeCount === 0} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted disabled:opacity-40">
                    <RotateCcw className="h-4 w-4" /> Undo
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => zoomBy(1 / 1.3)} title="Zoom out" className="rounded-md border p-1.5 hover:bg-muted"><ZoomOut className="h-4 w-4" /></button>
                <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button onClick={() => zoomBy(1.3)} title="Zoom in" className="rounded-md border p-1.5 hover:bg-muted"><ZoomIn className="h-4 w-4" /></button>
                <button onClick={toggleFullscreen} title={fs ? "Exit fullscreen" : "Fullscreen"} className="rounded-md border p-1.5 hover:bg-muted">
                  {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Document viewport — native scroll */}
            <div
              className={`${fs ? "h-[calc(100vh-230px)]" : "h-[55vh]"} overflow-auto rounded-md border bg-muted/30`}
              style={{ touchAction: mode === "draw" ? "none" : "auto" }}
              onTouchMove={onViewportTouchMove}
              onTouchEnd={onViewportTouchEnd}
            >
              {loadingDoc ? (
                <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : loadError ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">{loadError}</div>
              ) : (
                <div className="mx-auto space-y-3 p-2" style={{ width: `${zoom * 100}%` }}>
                  {pages.map((pg) => (
                    <div
                      key={pg.page}
                      ref={(el) => { if (el) pageBoxRefs.current.set(pg.page, el); else pageBoxRefs.current.delete(pg.page); }}
                      className="relative w-full shadow-sm"
                    >
                      <img src={pg.dataUrl} alt={`Page ${pg.page}`} className="pointer-events-none block w-full select-none" draggable={false} />

                      {/* Placed signatures (interactive in move mode) */}
                      {objects.filter((o) => o.page === pg.page).map((o) => (
                        <div
                          key={o.id}
                          onPointerDown={(e) => onObjDown(o, e)}
                          onPointerMove={onObjMove}
                          onPointerUp={onObjUp}
                          onPointerCancel={onObjUp}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 ${mode === "move" ? "cursor-move ring-1 ring-primary/60" : ""}`}
                          style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.width * 100}%`, touchAction: "none", pointerEvents: mode === "move" ? "auto" : "none" }}
                        >
                          <img src={o.signatureImage} alt="signature" className="block w-full select-none" draggable={false} />
                          {mode === "move" && (
                            <>
                              <button
                                onPointerDown={(e) => { e.stopPropagation(); removeObject(o.id); }}
                                className="absolute -right-2.5 -top-2.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                title="Remove"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <div
                                onPointerDown={(e) => onResizeDown(o, e)}
                                onPointerMove={onObjMove}
                                onPointerUp={onObjUp}
                                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-primary"
                                title="Drag to resize"
                              />
                            </>
                          )}
                        </div>
                      ))}

                      {/* Draw overlay (active only in draw mode) */}
                      <canvas
                        ref={(el) => { if (el) drawCanvasRefs.current.set(pg.page, el); else drawCanvasRefs.current.delete(pg.page); }}
                        onPointerDown={(e) => onDrawPointerDown(pg.page, e)}
                        onPointerMove={onDrawPointerMove}
                        onPointerUp={onDrawPointerUp}
                        onPointerCancel={onDrawPointerUp}
                        className={`absolute inset-0 h-full w-full ${mode === "draw" ? "cursor-crosshair" : ""}`}
                        style={{ touchAction: "none", pointerEvents: mode === "draw" ? "auto" : "none" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {objects.length === 0 && mode === "move"
                ? "No signatures yet."
                : mode === "draw"
                  ? `${strokeCount} stroke${strokeCount === 1 ? "" : "s"} drawn.`
                  : `${objects.length} signature${objects.length === 1 ? "" : "s"} placed — drag to move, corner to resize.`}
            </p>
          </div>

          <DialogFooter className="mt-3">
            <button onClick={() => onOpenChange(false)} disabled={saving} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || (objects.length === 0 && strokeCount === 0)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />} Save signature
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
