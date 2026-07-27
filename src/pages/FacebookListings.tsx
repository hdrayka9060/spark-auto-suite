import { useEffect, useMemo, useRef, useState } from "react";
import {
  Facebook,
  Plus,
  Trash2,
  Loader2,
  Send,
  ExternalLink,
  Copy,
  Pencil,
  CalendarClock,
  X,
  ThumbsUp,
  MessageSquare,
  Share2,
  RefreshCw,
  Clock,
  Store,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, fileUrl } from "@/lib/api";
import {
  useFacebookConnections,
  useStartConnect,
  useCompleteConnect,
  useDisconnect,
  useSetConnectionCatalog,
  useFacebookListings,
  useCreateListings,
  usePublishListing,
  useRemoveListing,
  useUpdateListing,
  useDuplicateListing,
  useFacebookTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useFacebookComments,
  useReplyComment,
  useMarkCommentsRead,
  useSyncListing,
  useSyncAllEngagement,
  useFacebookConversations,
  useConversationMessages,
  useSendFbReply,
  useSyncConversations,
  useGroupTargets,
  useCreateGroupTarget,
  useDeleteGroupTarget,
  useMarkPosted,
  useFacebookAnalytics,
  FACEBOOK_KEY,
} from "@/hooks/api/use-facebook";
import { useQueryClient } from "@tanstack/react-query";
import { useVehicles } from "@/hooks/api/use-vehicles";
import {
  FacebookConnection,
  CONNECTION_STATUS_BADGE_CLASS,
  CONNECTION_STATUS_LABEL,
  FacebookListing,
  ALL_LISTING_STATUSES,
  LISTING_STATUS_BADGE_CLASS,
  LISTING_STATUS_LABEL,
  applyTemplateVars,
  FacebookComment,
  DESTINATION_TYPE_LABEL,
} from "@/lib/facebook-mapper";
import { Vehicle } from "@/lib/vehicle-mapper";
import Can, { useCan } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

/** Mirror the Inventory list's rule (its `VehicleThumb`): a real photo is a
 *  path/URL (contains "/"), while the vehicle mapper's no-photo fallback is a
 *  "🚗" emoji rendered as text. Using the same check keeps the two surfaces
 *  identical — real inventory photos show; photo-less cars show the emoji. */
const isImagePath = (s?: string): boolean => !!s && s.includes("/");

/** How often an open tab/dialog auto-pulls fresh data from Facebook so the UI
 *  feels live without a manual Refresh. Polling-based on purpose: Facebook can't
 *  push to localhost (webhooks need a public URL) and PROJECT_MEMORY reserves
 *  WebSockets for staff chat. The manual Refresh buttons remain as a fallback. */
const AUTO_SYNC_MS = 30_000;

/** Fire `fn` on an interval while `enabled`. Skips a tick if the previous run is
 *  still in flight or the browser tab is hidden (saves Graph API quota). Errors
 *  are swallowed — auto-sync must never toast or throw. */
function useAutoSync(fn: () => Promise<unknown>, enabled: boolean) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const inFlight = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (inFlight.current || document.hidden) return;
      inFlight.current = true;
      Promise.resolve(fnRef.current())
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
        });
    };
    const id = window.setInterval(tick, AUTO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}

/** Small red count pill for tab triggers / rows (hidden when zero). */
function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold leading-none text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Facebook Listings page.
 *  - Destinations: connect/disconnect Pages (0a/0b).
 *  - Publish (Phase 1 + 1b): compose from one OR many vehicles using {{var}}
 *    templates, publish now or schedule, post to one/many Pages.
 *  - Listings (Phase 1 + 1b): manage, edit, duplicate, retry, remove.
 *  - Inbox + Analytics: later phases.
 *
 * Dev-mode mints mock posts so the whole loop works without a live Meta app.
 */
export default function FacebookListings() {
  const [tab, setTab] = useState("publish");
  // Ref to the listing whose comments are open in the Listings tab. Leaving the
  // Listings sub-tab marks that listing's comments seen — done HERE (not in the
  // detail's unmount) so the mark-read mutation's observer stays mounted and its
  // cache invalidation actually runs. Fixes "New" lingering after tabbing to
  // Publish and back.
  const openListingRef = useRef<string | null>(null);
  const markListingCommentsRead = useMarkCommentsRead();

  // Live data: while this page is open, pull comments + reactions/likes + Messenger
  // messages from Facebook every 30s so the UI stays current without manual Refresh.
  // Only runs when a Page is connected and the user can edit (sync routes need edit).
  const canEdit = useCan("Facebook Listings", "edit");
  const connections = useFacebookConnections().data ?? [];
  const syncAllEngagement = useSyncAllEngagement();
  const liveSyncOn = canEdit && connections.length > 0;
  // Inbox (Messenger) is hidden for now, so we only auto-sync engagement +
  // comments — not conversations. The backend cron still keeps threads fresh.
  useAutoSync(() => syncAllEngagement.mutateAsync(), liveSyncOn);

  return (
    <div className="animate-fade-in">
      <div className="module-header">
        <div>
          <h1 className="module-title">Facebook Listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Publish inventory to your Facebook Page, work comments, and track
            analytics — all from CDMS.
          </p>
        </div>
        {liveSyncOn ? (
          <span className="status-badge bg-emerald-100 text-emerald-700 inline-flex items-center gap-1 h-fit">
            <RefreshCw className="h-3 w-3" />
            Live · auto-syncs every 30s
          </span>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          // Switching away from Listings while a listing's comments are open
          // marks them seen (clears the "New" badge reliably).
          if (v !== "listings" && openListingRef.current) {
            markListingCommentsRead.mutate(openListingRef.current);
          }
          setTab(v);
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="publish">Publish</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="page">Page</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="publish">
          <PublishTab onPublished={() => setTab("listings")} />
        </TabsContent>
        <TabsContent value="listings">
          <ListingsTab openListingRef={openListingRef} />
        </TabsContent>
        <TabsContent value="page">
          <DestinationsTab />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Publish tab ───────────────────────────────────────────────────────────────

const TEMPLATE_VARS = "{{year}} {{make}} {{model}} {{trim}} {{price}} {{km}} {{vin}} {{color}}";

function varsFor(v: Vehicle): Record<string, string | number> {
  return {
    year: v.year ?? "",
    make: v.company ?? "",
    model: v.model ?? "",
    trim: v.trim ?? "",
    price: v.price ? v.price.toLocaleString() : "",
    km: v.km ? v.km.toLocaleString() : "",
    vin: v.vin ?? "",
    color: v.color ?? "",
    title: v.title ?? "",
  };
}

function PublishTab({ onPublished }: { onPublished: () => void }) {
  const canEdit = useCan("Facebook Listings", "edit");
  const confirm = useConfirm();
  const connectionsQuery = useFacebookConnections();
  const connections = (connectionsQuery.data ?? []).filter((c) => c.status === "active");

  const [search, setSearch] = useState("");
  const vehiclesQuery = useVehicles({ search: search || undefined, limit: 24 });
  // Hide sold cars from the publish picker — you can't list a vehicle that's sold.
  const vehicles = (vehiclesQuery.data?.data ?? []).filter((v) => v.status !== "Sold");

  // Persist selection across searches via an id→Vehicle map.
  const [selectedMap, setSelectedMap] = useState<Record<string, Vehicle>>({});
  const selected = Object.values(selectedMap);
  const first = selected[0];

  const [titleTpl, setTitleTpl] = useState("");
  const [descTpl, setDescTpl] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  // Posts go to the Facebook Page feed only. Marketplace catalog (partner-gated)
  // and Groups (manual) were removed — a plain Page post needs no special access.
  const [destIds, setDestIds] = useState<string[]>([]);

  const templatesQuery = useFacebookTemplates();
  const templates = templatesQuery.data ?? [];
  const createListings = useCreateListings();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const toggleVehicle = (v: Vehicle) =>
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[v.id]) delete next[v.id];
      else next[v.id] = v;
      return next;
    });

  // Prefill template fields the first time a vehicle is added (if still blank).
  const onPickVehicle = (v: Vehicle) => {
    toggleVehicle(v);
    if (!titleTpl && !selectedMap[v.id]) {
      setTitleTpl("{{year}} {{make}} {{model}}");
      setDescTpl("{{year}} {{make}} {{model}} • {{km}} km • {{color}}\n\nContact us today!");
    }
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitleTpl(t.titleTemplate);
    setDescTpl(t.descriptionTemplate);
    if (t.defaultLocation) setLocation(t.defaultLocation);
    if (t.defaultContact) setContact(t.defaultContact);
  };

  const toggleDest = (id: string) =>
    setDestIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const saveTemplate = async () => {
    if (!saveName.trim()) {
      toast.error("Template name is required");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: saveName.trim(),
        titleTemplate: titleTpl,
        descriptionTemplate: descTpl,
        defaultLocation: location,
        defaultContact: contact,
      });
      toast.success("Template saved");
      setSaveOpen(false);
      setSaveName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save template");
    }
  };

  const removeTemplate = async (id: string, name: string) => {
    const ok = await confirm({ title: "Delete template?", description: `"${name}" will be removed.`, confirmText: "Delete" });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete template");
    }
  };

  const publish = async () => {
    if (!selected.length) {
      toast.error("Pick at least one vehicle");
      return;
    }
    if (!titleTpl.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!destIds.length) {
      toast.error("Select at least one Facebook Page");
      return;
    }

    try {
      let total = 0;
      let failed = 0;
      for (const v of selected) {
        const vars = varsFor(v);
        const r = await createListings.mutateAsync({
          vehicleId: v.id,
          vehicleTitle: v.title,
          title: applyTemplateVars(titleTpl, vars).trim() || v.title,
          description: applyTemplateVars(descTpl, vars).trim(),
          price: priceOverride ? Number(priceOverride) : v.price ?? 0,
          // Only real photo paths — never the "🚗" emoji fallback (Facebook
          // can't fetch it; backend also guards). Real S3 URLs publish as photos.
          photos: (v.gallery ?? []).filter(isImagePath),
          location: location.trim(),
          contact: contact.trim(),
          publishNow: true,
          connectionIds: destIds,
          destinationType: "page",
        });
        total += r.length;
        failed += r.filter((l) => l.status === "failed").length;
      }
      if (failed) toast.warning(`Published ${total} post(s), ${failed} failed — check Listings`);
      else toast.success(`Published ${total} post(s) to Facebook`);
      setSelectedMap({});
      setDestIds([]);
      onPublished();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not publish");
    }
  };

  if (!canEdit) {
    return (
      <div className="stat-card mt-4 text-muted-foreground">
        You have read-only access to Facebook Listings.
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Step 1 — vehicle multi-select */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">1 · Pick vehicles</h2>
          {selected.length > 0 && (
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          )}
        </div>
        <Input
          placeholder="Search inventory…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />
        <div className="space-y-1 max-h-[440px] overflow-y-auto">
          {vehiclesQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No vehicles found.</p>
          ) : (
            vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => onPickVehicle(v)}
                className={cn(
                  "w-full text-left flex items-center gap-3 p-2 rounded-lg border transition-colors",
                  selectedMap[v.id]
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-muted/50",
                )}
              >
                <Checkbox checked={!!selectedMap[v.id]} className="pointer-events-none" />
                {isImagePath(v.image) ? (
                  <img
                    src={fileUrl(v.image)}
                    alt=""
                    className="h-12 w-16 object-cover rounded bg-muted shrink-0"
                  />
                ) : (
                  <div className="h-12 w-16 rounded bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-2xl shrink-0">
                    {v.image}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-medium truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground">
                    ${v.price?.toLocaleString()} · {v.status}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Steps 2 + 3 — compose (templated) + destinations */}
      <div className="stat-card">
        {selected.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Facebook className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Select one or more vehicles to compose a listing.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">2 · Compose</h2>
              <div className="flex items-center gap-2">
                {templates.length > 0 && (
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder="Apply template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
                  Save as template
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Placeholders: <code className="text-[11px]">{TEMPLATE_VARS}</code> — filled per vehicle.
            </p>

            <div>
              <Label>Title</Label>
              <Input value={titleTpl} onChange={(e) => setTitleTpl(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={descTpl} onChange={(e) => setDescTpl(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price override</Label>
                <Input
                  type="number"
                  placeholder="each vehicle's price"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>

            {/* live preview for the first selected vehicle */}
            {first && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Preview · {first.title}
                </div>
                <div className="font-medium text-sm">
                  {applyTemplateVars(titleTpl, varsFor(first)) || first.title}
                </div>
                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {applyTemplateVars(descTpl, varsFor(first))}
                </div>
                {first.gallery?.length ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
                    {first.gallery.slice(0, 5).map((p, i) =>
                      isImagePath(p) ? (
                        <img
                          key={i}
                          src={fileUrl(p)}
                          alt=""
                          className="h-14 w-20 object-cover rounded border shrink-0"
                        />
                      ) : (
                        <div
                          key={i}
                          className="h-14 w-20 rounded border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-3xl shrink-0"
                        >
                          {p}
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <div>
              <Label>3 · Facebook Page</Label>
              <div className="mt-1.5">
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No connected Page — connect one in the <strong>Page</strong> tab.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {connections.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={destIds.includes(c.id)}
                          onCheckedChange={() => toggleDest(c.id)}
                        />
                        <Facebook className="h-3.5 w-3.5 text-blue-600" /> {c.pageName}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* saved-template chips */}
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5"
                  >
                    {t.name}
                    <button
                      onClick={() => removeTemplate(t.id, t.name)}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label={`Delete template ${t.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Button
              onClick={publish}
              disabled={createListings.isPending || !destIds.length}
              className="w-full"
            >
              {createListings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publish now · {selected.length} vehicle
              {selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </div>

      {/* Save-as-template dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save listing template</DialogTitle>
            <DialogDescription>
              Saves the current title, description, location and contact (with their {`{{`}var{`}}`}{" "}
              placeholders) for reuse.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Template name</Label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Used sedan — standard"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Listings tab ──────────────────────────────────────────────────────────────

function ListingsTab({
  openListingRef,
}: {
  openListingRef: { current: string | null };
}) {
  const canEdit = useCan("Facebook Listings", "edit");
  const confirm = useConfirm();
  const [status, setStatus] = useState<string>("All");
  const listingsQuery = useFacebookListings({ status: status === "All" ? undefined : status });
  const listings = listingsQuery.data ?? [];
  const publish = usePublishListing();
  const remove = useRemoveListing();
  const duplicate = useDuplicateListing();
  const update = useUpdateListing();
  const sync = useSyncListing();
  const [preparing, setPreparing] = useState<FacebookListing | null>(null);
  // Open a listing's detail/comments view (an inner page, not a modal). Derive the
  // live listing from the query so its engagement stays fresh while auto-sync runs.
  const [openListingId, setOpenListingId] = useState<string | null>(null);
  const openListing = openListingId
    ? listings.find((l) => l.id === openListingId) ?? null
    : null;

  // Report the open listing up to the page so a sub-tab switch can mark its
  // comments seen (the page's mark-read observer stays mounted; this tab's
  // wouldn't if the tab content unmounts on switch).
  useEffect(() => {
    openListingRef.current = openListingId;
    return () => {
      openListingRef.current = null;
    };
  }, [openListingId, openListingRef]);

  const [editing, setEditing] = useState<FacebookListing | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    contact: "",
  });

  const openEdit = (l: FacebookListing) => {
    setEditing(l);
    setEditForm({
      title: l.title,
      description: l.description,
      price: l.price ? String(l.price) : "",
      location: l.location,
      contact: l.contact,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        input: {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          price: editForm.price ? Number(editForm.price) : 0,
          location: editForm.location.trim(),
          contact: editForm.contact.trim(),
        },
      });
      toast.success("Listing updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update");
    }
  };

  const onRetry = async (l: FacebookListing) => {
    try {
      await publish.mutateAsync(l.id);
      toast.success("Listing published");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not publish");
    }
  };

  const onSync = async (l: FacebookListing) => {
    try {
      await sync.mutateAsync(l.id);
      toast.success("Refreshed engagement & comments from Facebook");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not refresh");
    }
  };

  const onDuplicate = async (l: FacebookListing) => {
    try {
      await duplicate.mutateAsync(l.id);
      toast.success("Listing duplicated (draft)");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not duplicate");
    }
  };

  const onRemove = async (l: FacebookListing) => {
    const ok = await confirm({
      title: "Remove this listing?",
      description: `"${l.title}" will be unpublished from ${l.destinationName}.`,
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(l.id);
      toast.success("Listing removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove");
    }
  };

  return (
    <>
      {openListing ? (
        <ListingCommentsDetail
          listing={openListing}
          onBack={() => setOpenListingId(null)}
          canEdit={canEdit}
          onEdit={() => openEdit(openListing)}
          onPublish={() => onRetry(openListing)}
          onRemove={async () => {
            await onRemove(openListing);
            setOpenListingId(null);
          }}
          publishing={publish.isPending}
          removing={remove.isPending}
        />
      ) : (
        <div className="stat-card mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All listings</h2>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {ALL_LISTING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LISTING_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listingsQuery.isError ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500/70" />
          <p className="font-medium text-red-700">Couldn't load listings</p>
          <p className="text-sm text-red-600/80">
            {listingsQuery.error instanceof ApiError
              ? listingsQuery.error.message
              : "Refresh failed — check your connection and try again."}
          </p>
        </div>
      ) : listingsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Facebook className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No listings yet</p>
          <p className="text-sm">Use the Publish tab to post a vehicle to your Page.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Listing</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Engagement</th>
              <th>Posted</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr
                key={l.id}
                className="cursor-pointer"
                onClick={() => setOpenListingId(l.id)}
                title="Open comments"
              >
                <td>
                  <div className="font-medium flex items-center gap-2">
                    <span>{l.title}</span>
                    {l.unreadComments > 0 ? (
                      <span
                        className="inline-flex h-[18px] items-center gap-0.5 rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white"
                        title={`${l.unreadComments} unread comment${l.unreadComments > 1 ? "s" : ""}`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {l.unreadComments}
                      </span>
                    ) : null}
                  </div>
                  {l.status === "failed" && l.lastError ? (
                    <div
                      className="text-xs text-red-600 truncate max-w-[280px]"
                      title={l.lastError}
                    >
                      {l.lastError}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{l.vehicleTitle}</div>
                  )}
                </td>
                <td className="text-muted-foreground">
                  {l.destinationName}{" "}
                  <span className="text-xs">· {DESTINATION_TYPE_LABEL[l.destinationType]}</span>
                </td>
                <td>
                  <span className={cn("status-badge", LISTING_STATUS_BADGE_CLASS[l.status])}>
                    {LISTING_STATUS_LABEL[l.status]}
                  </span>
                </td>
                <td>
                  {l.status === "active" ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3" />
                        {l.engagement.reactions}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {l.engagement.comments}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Share2 className="h-3 w-3" />
                        {l.engagement.shares}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground">
                  {l.publishedAt ? new Date(l.publishedAt).toLocaleDateString() : "—"}
                </td>
                <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {l.fbPermalink ? (
                    <a
                      href={l.fbPermalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary mr-1 inline-flex items-center align-middle"
                      title="View on Facebook"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                  {canEdit &&
                  l.destinationType !== "group_manual" &&
                  (l.status === "failed" || l.status === "draft") ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRetry(l)}
                      disabled={publish.isPending}
                    >
                      Publish
                    </Button>
                  ) : null}
                  {canEdit && l.destinationType === "group_manual" ? (
                    <Button variant="ghost" size="sm" onClick={() => setPreparing(l)}>
                      Prepare
                    </Button>
                  ) : null}
                  {canEdit && l.status === "active" && l.destinationType !== "group_manual" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSync(l)}
                      disabled={sync.isPending}
                      title="Refresh engagement & comments"
                    >
                      <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
                    </Button>
                  ) : null}
                  <Can module="Facebook Listings" action="edit">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(l)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDuplicate(l)}
                      disabled={duplicate.isPending}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </Can>
                  <Can module="Facebook Listings" action="delete">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(l)}
                      disabled={remove.isPending}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
        </div>
      )}

      {/* Edit dialog — mounted in both the table AND detail views so Edit works
          from either (the detail is the openListing branch above). */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>
              Editing the text of an already-published post updates it on Facebook. Photos can't be
              changed after publishing — remove &amp; re-publish for that.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Contact</Label>
              <Input
                value={editForm.contact}
                onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupPrepareDialog
        listing={preparing}
        onOpenChange={(o) => {
          if (!o) setPreparing(null);
        }}
      />
    </>
  );
}

// ── Listing detail / comments (inner page, opened from a Listings row) ──────────

function ListingCommentsDetail({
  listing,
  onBack,
  canEdit,
  onEdit,
  onPublish,
  onRemove,
  publishing,
  removing,
}: {
  listing: FacebookListing;
  onBack: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onRemove: () => void;
  publishing: boolean;
  removing: boolean;
}) {
  const photo = listing.photos?.[0];
  // "New" comments stay visible WHILE you read them; they're marked read only
  // once you LEAVE — the browser tab is hidden (switch tab) OR this view unmounts
  // (Back to listings / another sub-tab). That clears the "New" badge + the
  // row/tab/nav unread counts for next time. (Not on open — so reading them
  // doesn't instantly wipe the badge in front of you.)
  const markRead = useMarkCommentsRead();
  useEffect(() => {
    if (listing.destinationType !== "page") return;
    const id = listing.id;
    const markSeen = () => markRead.mutate(id);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markSeen();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      markSeen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);
  const canPublish =
    canEdit &&
    listing.destinationType !== "group_manual" &&
    (listing.status === "failed" || listing.status === "draft");
  return (
    <div className="mt-4 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hover:underline">Back to listings</span>
      </button>

      <div className="stat-card">
        <div className="flex items-start gap-4">
          {isImagePath(photo) ? (
            <img
              src={fileUrl(photo as string)}
              alt={listing.title}
              className="h-20 w-28 rounded-md object-cover shrink-0"
            />
          ) : (
            <div className="h-20 w-28 rounded-md bg-muted flex items-center justify-center text-2xl shrink-0">
              🚗
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{listing.title}</h2>
              <span className={cn("status-badge", LISTING_STATUS_BADGE_CLASS[listing.status])}>
                {LISTING_STATUS_LABEL[listing.status]}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">{listing.vehicleTitle}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {listing.destinationName} · {DESTINATION_TYPE_LABEL[listing.destinationType]}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                {listing.engagement.reactions}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {listing.engagement.comments}
              </span>
              <span className="inline-flex items-center gap-1">
                <Share2 className="h-4 w-4" />
                {listing.engagement.shares}
              </span>
              {listing.fbPermalink ? (
                <a
                  href={listing.fbPermalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Facebook
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canPublish ? (
              <Button size="sm" onClick={onPublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit listing">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            <Can module="Facebook Listings" action="delete">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={removing}
                title="Remove listing"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </Can>
          </div>
        </div>
      </div>

      {listing.lastError ? (
        <div className="stat-card border border-red-200 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-700">
                {listing.status === "failed" ? "Publishing failed" : "Last error"}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-red-700">
                {listing.lastError}
              </p>
              <p className="mt-1.5 text-xs text-red-600/80">
                Fix the cause on Facebook, then use the <span className="font-medium">Publish</span> button
                above to retry.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {listing.destinationType === "page" ? (
        <CommentsView listing={listing} />
      ) : (
        <div className="stat-card text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Comments aren't available for this destination</p>
          <p className="text-sm">
            Comments come from Facebook Page posts. This is a{" "}
            {DESTINATION_TYPE_LABEL[listing.destinationType]} listing.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Destinations tab ──────────────────────────────────────────────────────────

function DestinationsTab() {
  const canEdit = useCan("Facebook Listings", "edit");
  const confirm = useConfirm();
  const connectionsQuery = useFacebookConnections();
  const startConnect = useStartConnect();
  const completeConnect = useCompleteConnect();
  const disconnect = useDisconnect();
  const connecting = startConnect.isPending || completeConnect.isPending;
  const connections = connectionsQuery.data ?? [];

  const handleConnect = async () => {
    try {
      const start = await startConnect.mutateAsync();
      if (start.devMode) {
        await completeConnect.mutateAsync({});
        toast.success("Connected a Facebook Page (dev mode)");
      } else if (start.authUrl) {
        sessionStorage.setItem("fb_connect_state", start.state);
        window.location.href = start.authUrl;
      } else {
        toast.error("Facebook connect is not configured yet.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not connect Facebook");
    }
  };

  const handleDisconnect = async (conn: FacebookConnection) => {
    const ok = await confirm({
      title: "Disconnect this Page?",
      description: `"${conn.pageName}" will be removed from your Facebook destinations. You can reconnect it later.`,
      confirmText: "Disconnect",
    });
    if (!ok) return;
    try {
      await disconnect.mutateAsync(conn.id);
      toast.success("Facebook Page disconnected");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not disconnect");
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Connected Pages</h2>
          <p className="text-muted-foreground text-sm">
            Facebook Pages this dealership can publish to and receive leads from.
          </p>
        </div>
        <Can module="Facebook Listings" action="edit">
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Connect Facebook
          </Button>
        </Can>
      </div>

      {connectionsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Facebook className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No Facebook Pages connected yet</p>
          <p className="text-sm">
            {canEdit
              ? 'Click "Connect Facebook" to add your first Page.'
              : "Ask an admin to connect a Facebook Page."}
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Status</th>
              <th>Permissions</th>
              <th>Connected</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium">{c.pageName}</div>
                      <div className="text-xs text-muted-foreground">Page ID: {c.pageId}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={cn("status-badge", CONNECTION_STATUS_BADGE_CLASS[c.status])}>
                    {CONNECTION_STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="text-muted-foreground">
                  {c.scopes.length} scope{c.scopes.length === 1 ? "" : "s"}
                </td>
                <td className="text-muted-foreground">
                  {new Date(c.connectedAt).toLocaleDateString()}
                </td>
                <td className="text-right">
                  <Can module="Facebook Listings" action="delete">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(c)}
                      disabled={disconnect.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        Connect the dealership's Facebook Page to publish inventory posts, read &amp; reply to
        comments, and see analytics. The Page token is stored encrypted.
      </p>
      </div>
    </div>
  );
}

/** Inline editor for a connection's Marketplace product-catalog id. Setting it
 *  turns on the Marketplace (catalog) destination + Item API sync for the Page. */
function CatalogIdCell({ conn }: { conn: FacebookConnection }) {
  const canEdit = useCan("Facebook Listings", "edit");
  const setCatalog = useSetConnectionCatalog();
  const [catalogId, setCatalogId] = useState(conn.catalogId ?? "");
  const [token, setToken] = useState("");
  useEffect(() => {
    setCatalogId(conn.catalogId ?? "");
  }, [conn.catalogId]);

  if (!canEdit) {
    return <span className="text-xs text-muted-foreground">{conn.catalogId || "—"}</span>;
  }

  const idChanged = catalogId.trim() !== (conn.catalogId ?? "");
  const tokenEntered = token.trim().length > 0;
  const dirty = idChanged || tokenEntered;

  const save = async () => {
    try {
      await setCatalog.mutateAsync({
        id: conn.id,
        catalogId: catalogId.trim(),
        // Only send the token when typed — a blank field keeps the stored one.
        ...(tokenEntered ? { catalogToken: token.trim() } : {}),
      });
      toast.success("Catalog settings saved");
      setToken("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save catalog settings");
    }
  };

  return (
    <div className="space-y-1">
      <Input
        value={catalogId}
        onChange={(e) => setCatalogId(e.target.value)}
        placeholder="Catalog ID"
        className="h-8 w-52 text-xs"
      />
      <Input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Catalog token (System User) — blank keeps current"
        className="h-8 w-52 text-xs"
      />
      {dirty ? (
        <Button size="sm" variant="outline" onClick={save} disabled={setCatalog.isPending}>
          {setCatalog.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      ) : null}
    </div>
  );
}

// ── Facebook Groups registry (Phase 5) ──────────────────────────────────────

function GroupRegistry() {
  const confirm = useConfirm();
  const groupsQuery = useGroupTargets();
  const groups = groupsQuery.data ?? [];
  const createGroup = useCreateGroupTarget();
  const deleteGroup = useDeleteGroupTarget();
  const [form, setForm] = useState({ name: "", groupUrl: "", category: "", notes: "" });

  const byCategory = useMemo(() => {
    const m: Record<string, typeof groups> = {};
    groups.forEach((g) => {
      const c = g.category || "Uncategorized";
      (m[c] ||= []).push(g);
    });
    return m;
  }, [groups]);

  const add = async () => {
    if (!form.name.trim() || !form.groupUrl.trim()) {
      toast.error("Name and group URL are required");
      return;
    }
    try {
      await createGroup.mutateAsync({
        name: form.name.trim(),
        groupUrl: form.groupUrl.trim(),
        category: form.category.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Group added");
      setForm({ name: "", groupUrl: "", category: "", notes: "" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add group");
    }
  };

  const remove = async (g: { id: string; name: string }) => {
    const ok = await confirm({
      title: "Remove this group?",
      description: `"${g.name}" will be removed from your group registry.`,
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      await deleteGroup.mutateAsync(g.id);
      toast.success("Group removed");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove");
    }
  };

  return (
    <div className="stat-card">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Facebook Groups</h2>
        <p className="text-muted-foreground text-sm">
          Groups can't be posted to via API — CDMS prepares the caption + photos and you paste
          manually. Organise them by category.
        </p>
      </div>

      <Can module="Facebook Listings" action="edit">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
          <Input
            placeholder="Group name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Group URL"
            value={form.groupUrl}
            onChange={(e) => setForm({ ...form, groupUrl: e.target.value })}
          />
          <Input
            placeholder="Category (e.g. Local Car Sales)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Button onClick={add} disabled={createGroup.isPending}>
            {createGroup.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add
          </Button>
        </div>
      </Can>

      {groupsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No groups yet. Add the Facebook groups you post vehicles to.
        </p>
      ) : (
        <div className="space-y-3">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-xs font-medium text-muted-foreground mb-1">{cat}</div>
              <div className="space-y-1">
                {list.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between border rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={g.groupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary truncate inline-flex items-center gap-1"
                      >
                        {g.name} <ExternalLink className="h-3 w-3" />
                      </a>
                      {g.notes ? (
                        <div className="text-xs text-muted-foreground truncate">{g.notes}</div>
                      ) : null}
                    </div>
                    <Can module="Facebook Listings" action="delete">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(g)}
                        disabled={deleteGroup.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </Can>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inbox tab: Comments | Messages sub-tabs ─────────────────────────────────

function InboxTab() {
  // Inbox is now Messages-only; comments moved to a per-car dialog on the Listings tab.
  return <MessagesView />;
}

function CommentsView({ listing }: { listing?: FacebookListing }) {
  const canEdit = useCan("Facebook Listings", "edit");
  // No status filter: comments are a simple two-state list — "New" until you
  // reply, then "Replied". We always show every comment on this car.
  const commentsQuery = useFacebookComments({
    listingId: listing?.id,
  });
  const comments = commentsQuery.data ?? [];
  const listingsQuery = useFacebookListings({});
  const titleById = useMemo(() => {
    const m: Record<string, string> = {};
    (listingsQuery.data ?? []).forEach((l) => {
      m[l.id] = l.title;
    });
    return m;
  }, [listingsQuery.data]);

  const reply = useReplyComment();
  const sync = useSyncListing();
  // Auto-refresh THIS listing's comments from Facebook every 30s while the detail
  // page is open. Uses the per-listing route (already mapped) so it works even if
  // the page-level global sync route hasn't been picked up by a backend restart.
  useAutoSync(
    () => (listing ? sync.mutateAsync(listing.id) : Promise.resolve()),
    !!listing && canEdit,
  );
  const onSync = async () => {
    if (!listing) return;
    try {
      await sync.mutateAsync(listing.id);
      toast.success("Refreshed from Facebook");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not refresh");
    }
  };
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const sendReply = async (c: FacebookComment) => {
    if (!replyText.trim()) {
      toast.error("Reply can't be empty");
      return;
    }
    try {
      await reply.mutateAsync({ id: c.id, message: replyText.trim() });
      toast.success("Reply sent");
      setReplyId(null);
      setReplyText("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reply");
    }
  };

  return (
    <div className={listing ? "stat-card" : "stat-card mt-4"}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Comments</h2>
          <p className="text-muted-foreground text-sm">
            {listing
              ? "Comments on this car's Page post — auto-syncs from Facebook while open."
              : "Comments on your published Page posts — auto-refreshes every 20s."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listing && canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={sync.isPending}
              title="Refresh from Facebook"
            >
              <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
            </Button>
          ) : null}
        </div>
      </div>

      {listing && sync.isError ? (
        <div className="mb-3 flex items-start gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>
            Couldn't refresh from Facebook:{" "}
            {sync.error instanceof ApiError ? sync.error.message : "please try again."}
          </span>
        </div>
      ) : null}

      {commentsQuery.isError ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500/70" />
          <p className="font-medium text-red-700">Couldn't load comments</p>
          <p className="text-sm text-red-600/80">
            {commentsQuery.error instanceof ApiError
              ? commentsQuery.error.message
              : "Refresh failed — check your connection and try again."}
          </p>
        </div>
      ) : commentsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No comments yet</p>
          <p className="text-sm">
            New comments sync from Facebook automatically (every 30s while this page is open).
            If this post has comments on Facebook but none show here, the Page access token is
            likely missing the <code>pages_read_user_content</code> permission (the comment{" "}
            <em>count</em> can show under Engagement with only <code>pages_read_engagement</code>,
            but reading the comments themselves needs <code>pages_read_user_content</code>) —
            reconnect the Page with that permission granted.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{c.authorName}</div>
                <div className="text-xs text-muted-foreground">
                  {c.createdTime ? new Date(c.createdTime).toLocaleString() : ""}
                </div>
              </div>
              {!listing && titleById[c.listingId] ? (
                <div className="text-xs text-muted-foreground mb-1">
                  on “{titleById[c.listingId]}”
                </div>
              ) : null}
              <p className="text-sm whitespace-pre-wrap">{c.message}</p>

              {c.replyText ? (
                <div className="text-sm mt-2 pl-3 border-l-2 border-emerald-300">
                  <span className="text-xs text-muted-foreground">Your reply</span>
                  <div>{c.replyText}</div>
                </div>
              ) : null}

              {canEdit && !c.replyText ? (
                <div className="mt-2">
                  {replyId === c.id ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => sendReply(c)} disabled={reply.isPending}>
                          {reply.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyId(null);
                            setReplyText("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyId(c.id);
                        setReplyText("");
                      }}
                    >
                      Reply
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Messages sub-view (Messenger two-pane) ──────────────────────────────────

function MessagesView() {
  const convQuery = useFacebookConversations({});
  const conversations = convQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );
  const messagesQuery = useConversationMessages(selectedId);
  const messages = messagesQuery.data ?? [];
  const sendReply = useSendFbReply();
  const syncConvs = useSyncConversations();
  // Opening a thread marks it read server-side (GET messages). Invalidate the
  // conversations list so the unread badge clears promptly ("as soon as seen").
  const qc = useQueryClient();
  useEffect(() => {
    if (selectedId && messagesQuery.isSuccess) {
      // Whole FB cache so the conversations list + sidebar nav badge both update.
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
    }
  }, [selectedId, messagesQuery.isSuccess, qc]);
  const [text, setText] = useState("");

  const onSend = async () => {
    if (!selected || !text.trim()) return;
    try {
      await sendReply.mutateAsync({ id: selected.id, message: text.trim() });
      setText("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not send");
    }
  };
  const onSync = async () => {
    try {
      await syncConvs.mutateAsync();
      toast.success("Refreshed conversations");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not refresh");
    }
  };

  return (
    <div className="flex border rounded-xl overflow-hidden bg-card mt-2 h-[calc(100vh-20rem)] min-h-[420px]">
      {/* Left — conversation list */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-2 border-b flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Conversations</span>
          <Can module="Facebook Listings" action="edit">
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncConvs.isPending}
              title="Refresh from Facebook"
            >
              <RefreshCw className={cn("h-4 w-4", syncConvs.isPending && "animate-spin")} />
            </Button>
          </Can>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-3">
              No conversations. Use Refresh to pull threads from Facebook.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-b hover:bg-muted/40",
                  selectedId === c.id && "bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm truncate", c.unread && "font-semibold")}>
                    {c.participantName}
                  </span>
                  {c.unread ? (
                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 ml-1" />
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.snippet}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — thread */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a conversation.
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-2 border-b flex items-center gap-2">
            <div className="font-medium text-sm">{selected.participantName}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messagesQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                    m.direction === "out"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className="text-[10px] mt-1 opacity-70">
                    {m.direction === "out" ? m.sentByName || "You" : selected.participantName}
                    {m.at ? ` · ${new Date(m.at).toLocaleString()}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-2">
            {!selected.windowOpen ? (
              <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
                <Clock className="h-3 w-3" /> 24-hour reply window may be closed — Facebook can
                reject this message.
              </div>
            ) : null}
            <Can
              module="Facebook Listings"
              action="edit"
              fallback={<div className="text-xs text-muted-foreground">Read-only access.</div>}
            >
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a reply…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Button onClick={onSend} disabled={sendReply.isPending || !text.trim()}>
                  {sendReply.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </Can>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group "prepare & paste" dialog ──────────────────────────────────────────

function GroupPrepareDialog({
  listing,
  onOpenChange,
}: {
  listing: FacebookListing | null;
  onOpenChange: (o: boolean) => void;
}) {
  const markPosted = useMarkPosted();
  const [permalink, setPermalink] = useState("");

  const caption = listing
    ? [
        listing.title,
        listing.description,
        listing.price ? `Price: $${listing.price.toLocaleString()}` : "",
        listing.location ? `Location: ${listing.location}` : "",
        listing.contact ? `Contact: ${listing.contact}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const copy = () => {
    navigator.clipboard?.writeText(caption);
    toast.success("Caption copied");
  };

  const mark = async () => {
    if (!listing) return;
    try {
      await markPosted.mutateAsync({ id: listing.id, permalink: permalink.trim() || undefined });
      toast.success("Marked as posted");
      setPermalink("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not update");
    }
  };

  return (
    <Dialog open={!!listing} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare for {listing?.destinationName}</DialogTitle>
          <DialogDescription>
            Groups can't be auto-posted. Copy the caption, open the group, paste it, then mark it
            posted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Caption</Label>
            <Textarea readOnly rows={6} value={caption} />
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={copy}>
                Copy caption
              </Button>
              {listing?.destinationUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(listing.destinationUrl, "_blank")}
                >
                  Open group ↗
                </Button>
              ) : null}
            </div>
          </div>
          {listing?.photos?.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {listing.photos.slice(0, 6).map((p, i) => (
                <img
                  key={i}
                  src={fileUrl(p)}
                  alt=""
                  className="h-16 w-24 object-cover rounded border shrink-0"
                />
              ))}
            </div>
          ) : null}
          <div>
            <Label>Posted URL (optional)</Label>
            <Input
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              placeholder="Paste the group post URL"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={mark} disabled={markPosted.isPending}>
            {markPosted.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Mark as posted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Analytics tab ───────────────────────────────────────────────────────────

function AnalyticsTab() {
  const q = useFacebookAnalytics();
  const a = q.data;

  if (q.isLoading || !a) {
    return (
      <div className="stat-card mt-4 flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Active listings", value: a.summary.activeListings },
    { label: "Reactions", value: a.summary.reactions },
    { label: "Comments", value: a.summary.comments },
    { label: "Shares", value: a.summary.shares },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="stat-card">
            <div className="text-2xl font-semibold">{k.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-3">Engagement trend (30 days)</h2>
        {a.trend.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No engagement data yet — use Refresh on active listings to start collecting snapshots.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={a.trend} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="reactions" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comments" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="shares" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-3">Best-performing listings</h2>
        {a.topListings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active listings yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Destination</th>
                <th>Reactions</th>
                <th>Comments</th>
                <th>Shares</th>
              </tr>
            </thead>
            <tbody>
              {a.topListings.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.title}</td>
                  <td className="text-muted-foreground">{l.destinationName}</td>
                  <td>{l.reactions}</td>
                  <td>{l.comments}</td>
                  <td>{l.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
