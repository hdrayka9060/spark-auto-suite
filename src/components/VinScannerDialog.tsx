/**
 * VIN scanner modal for the Add-Vehicle form. Fully client-side, no API.
 *
 * Two ways in, both scanning a single STILL frame (never a continuous feed —
 * that produced noisy false reads):
 *   • Take photo  — live camera preview + a manual shutter; the ONE captured
 *     frame is scanned. Works on desktop webcams and mobile (getUserMedia).
 *   • Upload      — pick a photo/screenshot from the device.
 *
 * Each frame is scanned two ways: barcode decode (PDF417 on registrations,
 * Code39/128 on door-jamb labels) then Tesseract OCR (printed / on-screen VIN).
 * Both heavy libs (@zxing/library, tesseract.js) are dynamically imported only
 * when a scan runs, so their WASM never lands in the initial bundle.
 *
 * The image is never uploaded or stored — we only emit the 17-char VIN via
 * onDetected(); the parent feeds it to the existing NHTSA decode.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, Loader2, ScanLine, X, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { extractVinCandidates, pickBestVin, readVinFromText, type VinPick } from "@/lib/vin-scan";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once with a detected VIN. `verified` = the check digit validated. */
  onDetected: (vin: string, verified: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWorker = any;

export function VinScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<AnyWorker>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [status, setStatus] = useState("Take a photo of the VIN, or upload a screenshot.");

  // Reset each time the dialog opens; tear down on close/unmount.
  useEffect(() => {
    if (open) {
      setMode("idle");
      setPreview(null);
      setBusy(false);
      setTorchOn(false);
      setStatus("Take a photo of the VIN, or upload a screenshot.");
    } else {
      teardown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => teardown(), []); // unmount

  // Attach the stream AFTER the <video> mounts (it only renders in camera mode,
  // so it isn't in the DOM at the moment startCamera() flips the mode).
  useEffect(() => {
    if (mode !== "camera") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute("playsinline", "true");
    void video.play().catch(() => { /* muted+playsInline satisfies autoplay */ });
  }, [mode]);

  const stopCamera = () => {
    const stream = streamRef.current ?? (videoRef.current?.srcObject as MediaStream | null);
    stream?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const teardown = () => {
    stopCamera();
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    if (workerRef.current) { try { workerRef.current.terminate(); } catch { /* noop */ } workerRef.current = null; }
  };

  const setObjectPreview = (url: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreview(url);
  };

  // ── OCR worker (PSM 6 primary; PSM 11 fallback) ─────────────────────────────
  const ensureWorker = async () => {
    if (workerRef.current) return workerRef.current;
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
      // PSM 6 (single uniform block) reads both tight single-line VIN photos
      // (incl. moiré-heavy screen shots) AND multi-line CARFAX screenshots —
      // the only mode that handled every real sample. PSM 11 is a fallback below.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });
    workerRef.current = worker;
    return worker;
  };

  /**
   * Grayscale + global contrast-stretch, upscaled a bit when small. Gives OCR a
   * cleaner, higher-contrast image than a raw phone/webcam frame — especially
   * when the VIN label is small against a dark background.
   */
  const preprocessCanvas = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const scale = src.width < 1280 ? Math.min(2, 1280 / src.width) : 1;
    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(src, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const lum = new Uint8Array(w * h);
    let min = 255, max = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      lum[p] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = (((lum[p] - min) * 255) / range) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  };

  /** Central region of a frame — discards the dark background around a VIN label. */
  const cropCenter = (src: HTMLCanvasElement, wFrac = 0.92, hFrac = 0.5): HTMLCanvasElement => {
    const cw = Math.max(1, Math.round(src.width * wFrac));
    const ch = Math.max(1, Math.round(src.height * hFrac));
    const left = (src.width - cw) >> 1;
    const top = (src.height - ch) >> 1;
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const ctx = out.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(src, left, top, cw, ch, 0, 0, cw, ch);
    return out;
  };

  /**
   * Escalating OCR — returns on the first pass that yields a VIN, else unions
   * all candidates. Full-frame passes run FIRST (so multi-line screenshots are
   * caught before we'd ever crop); the center-crop passes only kick in for the
   * small-label-in-a-dark-frame camera case, where cropping out the background
   * is exactly what helps.
   */
  const ocrCanvas = async (canvas: HTMLCanvasElement): Promise<VinPick | null> => {
    const worker = await ensureWorker();
    const { PSM } = await import("tesseract.js");
    const preFull = preprocessCanvas(canvas);
    const preCrop = preprocessCanvas(cropCenter(canvas));
    const passes: Array<[HTMLCanvasElement, number]> = [
      [canvas, PSM.SINGLE_BLOCK],   // 1. raw full frame
      [preFull, PSM.SINGLE_BLOCK],  // 2. cleaned full frame
      [preCrop, PSM.SINGLE_BLOCK],  // 3. cropped + cleaned (kills dark background)
      [preCrop, PSM.SPARSE_TEXT],   // 4. cropped, sparse mode
    ];
    const candidates: string[] = [];
    try {
      for (const [cv, psm] of passes) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        const { data } = await worker.recognize(cv);
        const hit = readVinFromText(data?.text ?? "");
        if (hit) return hit;
        candidates.push(...extractVinCandidates(data?.text ?? ""));
      }
    } finally {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    }
    return pickBestVin(candidates);
  };

  // ── shared canvas → scan (barcode then OCR) ─────────────────────────────────
  const drawToCanvas = (
    source: HTMLImageElement | HTMLVideoElement, w: number, h: number,
  ): HTMLCanvasElement | null => {
    const canvas = canvasRef.current;
    if (!canvas || !w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    return canvas;
  };

  const canvasToBlobUrl = (canvas: HTMLCanvasElement) =>
    new Promise<string>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("no blob"))),
        "image/jpeg", 0.95,
      ),
    );

  const finish = (pick: VinPick) => {
    onDetected(pick.vin, pick.verified);
    onOpenChange(false);
  };

  const scanCanvas = async (canvas: HTMLCanvasElement) => {
    setBusy(true);
    setStatus("Reading image…");
    try {
      // 1) Barcode.
      let blobUrl: string | null = null;
      try {
        blobUrl = await canvasToBlobUrl(canvas);
        const { BrowserMultiFormatReader } = await import("@zxing/library");
        const reader: AnyWorker = new BrowserMultiFormatReader();
        const result = await reader.decodeFromImageUrl(blobUrl);
        try { reader.reset(); } catch { /* noop */ }
        if (result) {
          const pick = readVinFromText(result.getText());
          if (pick) { finish(pick); return; }
        }
      } catch { /* no barcode — fall through to OCR */ }
      finally { if (blobUrl) URL.revokeObjectURL(blobUrl); }

      // 2) OCR.
      const pick = await ocrCanvas(canvas);
      if (pick) { finish(pick); return; }
      setStatus("No VIN found — get closer so the VIN fills the frame, then try again.");
    } catch {
      setStatus("Couldn't read that image — try another photo.");
    } finally {
      setBusy(false);
    }
  };

  // ── upload path ─────────────────────────────────────────────────────────────
  const scanFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setObjectPreview(url);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
      if (canvas) await scanCanvas(canvas);
      else setStatus("Couldn't read that image — try another photo.");
    } catch {
      setStatus("Couldn't read that image — try another photo.");
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // allow re-picking the same file
    if (file) void scanFile(file);
  };

  const pickFile = () => { if (!busy) fileRef.current?.click(); };

  // ── camera path ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (busy) return;
    setStatus("Starting camera…");
    try {
      // Stash the stream; the mode-effect attaches it once the <video> mounts.
      // Request HD — an unconstrained webcam often defaults to 640×480, which
      // leaves the VIN characters too small for OCR once the label is in frame.
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setMode("camera");
      setStatus("Frame the VIN, then tap Capture.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMode("idle");
      setStatus(
        /permission|denied|notallowed/i.test(msg)
          ? "Camera blocked — allow it, or upload a photo instead."
          : "No camera available — upload a photo instead.",
      );
    }
  };

  const cancelCamera = () => { stopCamera(); setMode("idle"); setStatus("Take a photo of the VIN, or upload a screenshot."); };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = drawToCanvas(video, video.videoWidth, video.videoHeight);
    stopCamera();
    setMode("idle");
    if (!canvas) { setStatus("Capture failed — try again."); return; }
    setPreview(canvas.toDataURL("image/jpeg", 0.95)); // data URL preview (no revoke needed)
    await scanCanvas(canvas);
  };

  const toggleTorch = async () => {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as any);
      setTorchOn((v) => !v);
    } catch { /* torch unsupported — ignore */ }
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" /> Scan VIN
          </DialogTitle>
          <DialogDescription>
            Take a photo of the VIN barcode or printed number, or upload a screenshot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mode === "camera" ? (
            <>
              <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-16 w-[85%] rounded-md border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute bottom-2 right-2 rounded-full p-2 text-white transition ${torchOn ? "bg-amber-500" : "bg-black/50 hover:bg-black/70"}`}
                  title="Toggle flashlight"
                >
                  <Zap className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Camera className="h-4 w-4" /> Capture
                </button>
                <button
                  type="button"
                  onClick={cancelCamera}
                  className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {preview ? (
                <div className="relative overflow-hidden rounded-lg border bg-muted">
                  <img src={preview} alt="VIN capture" className="max-h-64 w-full object-contain" />
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-sm text-white">
                      <Loader2 className="h-4 w-4 animate-spin" /> Scanning…
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pickFile}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <ImageUp className="h-8 w-8" />
                  <span className="text-sm font-medium">Take a photo or upload a VIN image</span>
                  <span className="text-xs">Barcode, door-jamb label, registration, or a screenshot</span>
                </button>
              )}

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {status}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" /> {preview ? "Retake" : "Take photo"}
                </button>
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <ImageUp className="h-4 w-4" /> {preview ? "Choose another" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFilePicked}
            className="hidden"
          />
          <canvas ref={canvasRef} className="hidden" />

          <p className="text-[11px] text-muted-foreground">
            The photo isn’t saved — only the VIN is filled in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
