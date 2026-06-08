/**
 * Facebook Listings mapper. Translates the backend `facebook_connections`
 * shape into the client shape the UI consumes. Pure functions only — no React,
 * no api() (project convention: mappers translate, they don't fetch).
 *
 * Phase 0a covers connected Pages ("Destinations"). Listing / engagement /
 * inbox types will be added to this file as those phases land.
 */

export type FacebookConnectionStatus = "active" | "expired" | "revoked";

/** Server shape (mirrors FacebookConnection schema; the encrypted token field
 *  is `select: false` so it never reaches the client). */
export interface ServerFacebookConnection {
  _id: string;
  pageId: string;
  pageName: string;
  businessId?: string;
  catalogId?: string;
  scopes: string[];
  status: FacebookConnectionStatus;
  tokenExpiresAt?: string;
  connectedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Client shape used by the Destinations tab. */
export interface FacebookConnection {
  id: string;
  pageId: string;
  pageName: string;
  businessId?: string;
  catalogId?: string;
  scopes: string[];
  status: FacebookConnectionStatus;
  /** ISO timestamp (server `createdAt`). */
  connectedAt: string;
}

/** Response shape of `POST /facebook/connect/start`. */
export interface StartConnectResult {
  /** True when the backend has no live Meta app — the UI simulates the connect. */
  devMode: boolean;
  /** Facebook login URL to redirect to in real-mode; null in dev-mode. */
  authUrl: string | null;
  /** CSRF nonce echoed back on the OAuth callback. */
  state: string;
}

export const CONNECTION_STATUS_BADGE_CLASS: Record<FacebookConnectionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-amber-100 text-amber-700",
  revoked: "bg-slate-100 text-slate-700",
};

export const CONNECTION_STATUS_LABEL: Record<FacebookConnectionStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export function toClientConnection(s: ServerFacebookConnection): FacebookConnection {
  return {
    id: s._id,
    pageId: s.pageId,
    pageName: s.pageName,
    businessId: s.businessId || undefined,
    catalogId: s.catalogId || undefined,
    scopes: s.scopes ?? [],
    status: s.status,
    connectedAt: s.createdAt,
  };
}

// ── Listings (Phase 1) ──────────────────────────────────────────────────────

export type FacebookListingStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "sold"
  | "expired"
  | "removed"
  | "failed";

export interface ServerFacebookListing {
  _id: string;
  vehicle: string;
  vehicleTitle: string;
  destinationType: "page" | "marketplace_catalog" | "group_manual";
  connection?: string;
  destinationName: string;
  destinationUrl?: string;
  title: string;
  description: string;
  price: number;
  photos: string[];
  location: string;
  contact: string;
  status: FacebookListingStatus;
  fbPostId: string;
  fbPermalink: string;
  scheduledAt?: string;
  publishedAt?: string;
  lastError: string;
  engagement?: {
    reactions?: number;
    comments?: number;
    shares?: number;
    views?: number;
    leads?: number;
    fetchedAt?: string;
  };
  unreadComments?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FacebookListing {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  destinationType: "page" | "marketplace_catalog" | "group_manual";
  destinationName: string;
  destinationUrl: string;
  title: string;
  description: string;
  price: number;
  photos: string[];
  location: string;
  contact: string;
  engagement: { reactions: number; comments: number; shares: number; views: number };
  /** Count of unread (not-yet-seen) comments on this listing. */
  unreadComments: number;
  status: FacebookListingStatus;
  fbPermalink: string;
  publishedAt?: string;
  lastError: string;
  createdAt: string;
}

export interface CreateListingInput {
  vehicleId: string;
  vehicleTitle?: string;
  title: string;
  description?: string;
  price?: number;
  photos?: string[];
  location?: string;
  contact?: string;
  connectionIds?: string[];
  groupTargetIds?: string[];
  destinationType?: "page" | "marketplace_catalog" | "group_manual";
  publishNow?: boolean;
  scheduledAt?: string;
}

// ── Group targets (Phase 5 — assisted-manual) ───────────────────────────────

export interface ServerFacebookGroupTarget {
  _id: string;
  name: string;
  groupUrl: string;
  groupId: string;
  category: string;
  notes: string;
  createdAt: string;
}

export interface FacebookGroupTarget {
  id: string;
  name: string;
  groupUrl: string;
  category: string;
  notes: string;
}

export interface CreateGroupTargetInput {
  name: string;
  groupUrl: string;
  category?: string;
  notes?: string;
}

export function toClientGroupTarget(s: ServerFacebookGroupTarget): FacebookGroupTarget {
  return {
    id: s._id,
    name: s.name,
    groupUrl: s.groupUrl,
    category: s.category ?? "",
    notes: s.notes ?? "",
  };
}

// ── Analytics (Phase 6) ─────────────────────────────────────────────────────

export interface FacebookAnalytics {
  summary: {
    activeListings: number;
    reactions: number;
    comments: number;
    shares: number;
    newComments: number;
    unreadConversations: number;
  };
  topListings: {
    id: string;
    title: string;
    destinationName: string;
    reactions: number;
    comments: number;
    shares: number;
    score: number;
  }[];
  trend: { date: string; reactions: number; comments: number; shares: number }[];
  followUp: { newComments: number; unreadConversations: number };
}

export const DESTINATION_TYPE_LABEL: Record<
  "page" | "marketplace_catalog" | "group_manual",
  string
> = {
  page: "Page",
  marketplace_catalog: "Marketplace",
  group_manual: "Group",
};

export const ALL_LISTING_STATUSES: FacebookListingStatus[] = [
  "draft",
  "scheduled",
  "active",
  "sold",
  "expired",
  "removed",
  "failed",
];

export const LISTING_STATUS_LABEL: Record<FacebookListingStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  sold: "Sold",
  expired: "Expired",
  removed: "Removed",
  failed: "Failed",
};

export const LISTING_STATUS_BADGE_CLASS: Record<FacebookListingStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  sold: "bg-violet-100 text-violet-700",
  expired: "bg-amber-100 text-amber-700",
  removed: "bg-slate-100 text-slate-500",
  failed: "bg-red-100 text-red-700",
};

export function toClientListing(s: ServerFacebookListing): FacebookListing {
  return {
    id: s._id,
    vehicleId: typeof s.vehicle === "string" ? s.vehicle : "",
    vehicleTitle: s.vehicleTitle,
    destinationType: s.destinationType,
    destinationName: s.destinationName,
    destinationUrl: s.destinationUrl ?? "",
    title: s.title,
    description: s.description,
    price: s.price ?? 0,
    photos: s.photos ?? [],
    location: s.location ?? "",
    contact: s.contact ?? "",
    engagement: {
      reactions: s.engagement?.reactions ?? 0,
      comments: s.engagement?.comments ?? 0,
      shares: s.engagement?.shares ?? 0,
      views: s.engagement?.views ?? 0,
    },
    unreadComments: s.unreadComments ?? 0,
    status: s.status,
    fbPermalink: s.fbPermalink,
    publishedAt: s.publishedAt,
    lastError: s.lastError,
    createdAt: s.createdAt,
  };
}

// ── Templates + helpers (Phase 1b) ──────────────────────────────────────────

export interface ServerFacebookTemplate {
  _id: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  defaultLocation: string;
  defaultContact: string;
  createdAt: string;
}

export interface FacebookTemplate {
  id: string;
  name: string;
  titleTemplate: string;
  descriptionTemplate: string;
  defaultLocation: string;
  defaultContact: string;
}

export interface CreateTemplateInput {
  name: string;
  titleTemplate?: string;
  descriptionTemplate?: string;
  defaultLocation?: string;
  defaultContact?: string;
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  price?: number;
  photos?: string[];
  location?: string;
  contact?: string;
  scheduledAt?: string;
}

export function toClientTemplate(s: ServerFacebookTemplate): FacebookTemplate {
  return {
    id: s._id,
    name: s.name,
    titleTemplate: s.titleTemplate ?? "",
    descriptionTemplate: s.descriptionTemplate ?? "",
    defaultLocation: s.defaultLocation ?? "",
    defaultContact: s.defaultContact ?? "",
  };
}

/**
 * Substitute `{{var}}` placeholders in a template string. Keys are matched
 * case-insensitively against `vars` (e.g. {{year}}, {{make}}, {{model}},
 * {{trim}}, {{price}}, {{km}}, {{vin}}, {{color}}, {{title}}). Unknown keys
 * resolve to ''.
 */
export function applyTemplateVars(
  tpl: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ── Comments (Phase 2) ──────────────────────────────────────────────────────

export type FacebookCommentStatus = "new" | "replied" | "resolved";

export interface ServerFacebookComment {
  _id: string;
  listing?: string;
  fbPostId: string;
  authorName: string;
  authorId: string;
  message: string;
  fbCreatedTime?: string;
  status: FacebookCommentStatus;
  replyText: string;
  repliedAt?: string;
  /** Seen/unseen flag (independent of status). New comments arrive unread;
   *  leaving the listing's comments marks them read. Drives the "New" badge. */
  unread?: boolean;
  createdAt: string;
}

export interface FacebookComment {
  id: string;
  listingId: string;
  authorName: string;
  message: string;
  createdTime?: string;
  status: FacebookCommentStatus;
  replyText: string;
  repliedAt?: string;
  /** True until the comment has been seen (then navigated away from). */
  unread: boolean;
}

export const COMMENT_STATUS_LABEL: Record<FacebookCommentStatus, string> = {
  new: "New",
  replied: "Replied",
  resolved: "Resolved",
};

export const COMMENT_STATUS_BADGE_CLASS: Record<FacebookCommentStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  replied: "bg-emerald-100 text-emerald-700",
  resolved: "bg-slate-100 text-slate-500",
};

export function toClientComment(s: ServerFacebookComment): FacebookComment {
  return {
    id: s._id,
    listingId: typeof s.listing === "string" ? s.listing : "",
    authorName: s.authorName,
    message: s.message,
    createdTime: s.fbCreatedTime,
    status: s.status,
    replyText: s.replyText ?? "",
    repliedAt: s.repliedAt,
    // Treat a missing flag as unread (matches the backend's `$ne: false` count).
    unread: s.unread ?? true,
  };
}

// ── Messenger conversations + lead pipeline (Phase 3) ───────────────────────

export type FacebookLeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "negotiating"
  | "sold"
  | "closed";

export interface ServerFacebookConversation {
  _id: string;
  participantName: string;
  participantId: string;
  snippet: string;
  leadStatus: FacebookLeadStatus;
  assignedTo?: string;
  assignedToName: string;
  lastMessageAt?: string;
  lastInboundAt?: string;
  unread: boolean;
  lead?: string;
  createdAt: string;
}

export interface FacebookConversation {
  id: string;
  participantName: string;
  snippet: string;
  leadStatus: FacebookLeadStatus;
  assignedTo: string;
  assignedToName: string;
  lastMessageAt?: string;
  unread: boolean;
  /** Linked CDMS Lead id once promoted (empty if not yet promoted). */
  leadId: string;
  /** Whether the 24h standard messaging window is still open (derived from
   *  lastInboundAt at map time; refreshed by the conversation poll). */
  windowOpen: boolean;
}

export interface ServerFacebookMessage {
  _id: string;
  direction: "in" | "out";
  text: string;
  sentByName: string;
  fbCreatedTime?: string;
  createdAt: string;
}

export interface FbMessage {
  id: string;
  direction: "in" | "out";
  text: string;
  sentByName: string;
  at?: string;
}

export const FB_LEAD_STATUSES: FacebookLeadStatus[] = [
  "new",
  "contacted",
  "interested",
  "negotiating",
  "sold",
  "closed",
];

export const FB_LEAD_STATUS_LABEL: Record<FacebookLeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  negotiating: "Negotiating",
  sold: "Sold",
  closed: "Closed",
};

export const FB_LEAD_STATUS_BADGE_CLASS: Record<FacebookLeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-cyan-100 text-cyan-700",
  interested: "bg-amber-100 text-amber-700",
  negotiating: "bg-violet-100 text-violet-700",
  sold: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
};

const FB_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function toClientConversation(s: ServerFacebookConversation): FacebookConversation {
  const windowOpen = s.lastInboundAt
    ? Date.now() - new Date(s.lastInboundAt).getTime() < FB_MESSAGING_WINDOW_MS
    : false;
  return {
    id: s._id,
    participantName: s.participantName,
    snippet: s.snippet,
    leadStatus: s.leadStatus,
    assignedTo: s.assignedTo ?? "",
    assignedToName: s.assignedToName ?? "",
    lastMessageAt: s.lastMessageAt,
    unread: !!s.unread,
    leadId: s.lead ?? "",
    windowOpen,
  };
}

export function toClientFbMessage(s: ServerFacebookMessage): FbMessage {
  return {
    id: s._id,
    direction: s.direction,
    text: s.text,
    sentByName: s.sentByName ?? "",
    at: s.fbCreatedTime ?? s.createdAt,
  };
}
