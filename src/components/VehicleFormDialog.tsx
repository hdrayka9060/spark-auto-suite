/**
 * Reusable vehicle entry dialog. Same form structure as the Inventory page's
 * "Add Vehicle" panel — VIN decoder, full spec fields, image picker — so any
 * place a vehicle needs to be created (Inventory, Seller CRM) shows the same
 * UX.
 *
 * The parent provides `onSubmit(input, images)`. The dialog calls it on save
 * and is responsible for closing/resetting itself.
 */
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, ScanLine, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";
import { useDecodeVin } from "@/hooks/api/use-vehicles";
import { ALL_BODY_TYPES, decodedVinToFormPatch, type VehicleFormInput } from "@/lib/vehicle-mapper";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  isSaving?: boolean;
  onSubmit: (input: VehicleFormInput, images: File[]) => Promise<void> | void;
}

const emptyForm = () => ({
  title: "", company: "", model: "", trim: "", year: "", engine: "",
  fuel: "", transmission: "", bodyType: "", plant: "",
  km: "", price: "", discount: "", owners: "", color: "", description: "",
  hosting: "Self" as "Self" | "Platform",
});

export function VehicleFormDialog({
  open, onOpenChange, title = "Add Vehicle",
  description = "Enter a VIN to auto-fill specs, or fill manually.",
  submitLabel = "Add to Inventory", isSaving = false, onSubmit,
}: Props) {
  const [form, setForm] = useState(emptyForm());
  const [vin, setVin] = useState("");
  const decodeVinMut = useDecodeVin();
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinDecoded, setVinDecoded] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const isVinValid = VIN_RE.test(vin.trim());

  const reset = () => {
    setForm(emptyForm());
    setVin(""); setVinError(null); setVinDecoded(false);
    setPendingImages([]);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
  };

  // Reset whenever the dialog reopens; keeps stale state from leaking
  // between independent "add vehicle" attempts.
  useEffect(() => { if (open) reset(); }, [open]);

  const setField = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Decode runs server-side (NHTSA vPIC via the backend) so the same lookup
  // powers both this dialog and bulk upload, and the field-mapping lives in one
  // place (vehicle-mapper.decodedVinToFormPatch). Decoded specs land in the
  // editable fields below — the user reviews/tweaks, then Adds.
  const decodeVin = async () => {
    const v = vin.trim().toUpperCase();
    setVinError(null);
    if (!VIN_RE.test(v)) {
      setVinError("VIN must be 17 characters (letters & digits, no I/O/Q).");
      return;
    }
    try {
      const decoded = await decodeVinMut.mutateAsync({
        vin: v,
        year: form.year ? parseInt(form.year, 10) : undefined,
      });
      setForm((f) => ({ ...f, ...decodedVinToFormPatch(decoded) }));
      setVinDecoded(true);
      toast({
        title: "VIN decoded",
        description: [decoded.modelYear, decoded.make, decoded.model].filter(Boolean).join(" ") || "Specs auto-filled",
      });
    } catch (e) {
      setVinError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to decode VIN");
      setVinDecoded(false);
    }
  };

  const handleImagesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (pendingImages.length + files.length > 10) {
      toast({ title: "Too many images", description: "Maximum 10 per vehicle.", variant: "destructive" });
      return;
    }
    setPendingImages((prev) => [...prev, ...files]);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
  };
  const removePendingImage = (idx: number) => setPendingImages((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title || !form.company || !form.model) {
      toast({ title: "Missing info", description: "Title, company and model are required.", variant: "destructive" });
      return;
    }
    if (!form.year || !form.price) {
      toast({ title: "Missing info", description: "Year and price are required.", variant: "destructive" });
      return;
    }
    const yearNum = parseInt(form.year, 10);
    const priceNum = parseFloat(form.price);
    if (Number.isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      toast({ title: "Invalid year", variant: "destructive" });
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }

    const input: VehicleFormInput = {
      title: form.title,
      company: form.company,
      model: form.model,
      year: yearNum,
      price: priceNum,
      km: form.km ? parseInt(form.km, 10) : undefined,
      discount: form.discount ? parseFloat(form.discount) : undefined,
      owners: form.owners ? parseInt(form.owners, 10) : undefined,
      fuel: form.fuel || undefined,
      transmission: form.transmission || undefined,
      color: form.color || undefined,
      vin: vin.trim() || undefined,
      bodyType: form.bodyType || undefined,
      trim: form.trim || undefined,
      engine: form.engine || undefined,
      description: form.description || undefined,
      hosting: form.hosting,
    };

    await onSubmit(input, pendingImages);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* VIN Lookup */}
        <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5" /> Quick Add by VIN
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={vin}
                onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinError(null); }}
                placeholder="e.g. 2HGFC2F59KH123456"
                maxLength={17}
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono tracking-wider uppercase pr-20 ${
                  vin && !isVinValid ? "border-red-400" : vinDecoded ? "border-emerald-400" : ""
                }`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                {vin.length}/17
              </span>
            </div>
            <button
              onClick={decodeVin}
              disabled={!isVinValid || decodeVinMut.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {decodeVinMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {decodeVinMut.isPending ? "Decoding…" : "Decode VIN"}
            </button>
          </div>
          {vinError && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {vinError}
            </div>
          )}
          {vinDecoded && !vinError && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Details auto-filled below — edit any field before saving.
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vehicle Details</p>
          <div className="grid md:grid-cols-3 gap-3">
            {([
              ["title", "Vehicle Title", "text"],
              ["company", "Make / Company", "text"],
              ["model", "Model", "text"],
              ["trim", "Trim / Series", "text"],
              ["year", "Year", "number"],
              ["engine", "Engine", "text"],
              ["fuel", "Fuel Type", "text"],
              ["transmission", "Transmission", "text"],
            ] as const).map(([k, label, type]) => (
              <div key={k}>
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <input
                  type={type}
                  value={form[k]}
                  onChange={(e) => setField(k, e.target.value)}
                  placeholder={label}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
            ))}
            {/* Body type: canonical-enum dropdown so dealers don't free-form
                values like "sedan" / "Sedan" / "Sedan/Saloon" inconsistently. */}
            <div>
              <label className="text-[11px] text-muted-foreground">Body Type</label>
              <select
                value={form.bodyType}
                onChange={(e) => setField("bodyType", e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Select body type…</option>
                {ALL_BODY_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Listing & Pricing */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Listing & Pricing</p>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={form.km} onChange={(e) => setField("km", e.target.value)} placeholder="KM Driven" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="Price ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.discount} onChange={(e) => setField("discount", e.target.value)} placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.owners} onChange={(e) => setField("owners", e.target.value)} placeholder="Owner Count" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.color} onChange={(e) => setField("color", e.target.value)} placeholder="Color (e.g. Pearl White)" type="text" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={form.hosting} onChange={(e) => setField("hosting", e.target.value as "Self" | "Platform")} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="Self">Self Hosted</option>
              <option value="Platform">Platform</option>
            </select>
          </div>
        </div>

        <textarea
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Description"
          className="border rounded-lg px-3 py-2 text-sm bg-background w-full"
          rows={2}
        />

        {/* Image picker */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Photos (optional)</p>
          <div
            onClick={() => imagesInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Click to pick photos (max 10). They'll upload right after the vehicle is saved.
          </div>
          <input
            ref={imagesInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesPicked}
            className="hidden"
          />
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {pendingImages.map((file, idx) => {
                const url = URL.createObjectURL(file);
                return (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={file.name}
                      className="h-20 w-28 object-cover rounded border"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removePendingImage(idx); }}
                      title="Remove this photo"
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground h-5 w-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
