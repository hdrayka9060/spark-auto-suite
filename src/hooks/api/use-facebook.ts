import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CreateGroupTargetInput,
  CreateListingInput,
  CreateTemplateInput,
  FacebookAnalytics,
  FacebookComment,
  FacebookConnection,
  FacebookConversation,
  FacebookGroupTarget,
  FacebookListing,
  FacebookTemplate,
  FbMessage,
  ServerFacebookComment,
  ServerFacebookConnection,
  ServerFacebookConversation,
  ServerFacebookGroupTarget,
  ServerFacebookListing,
  ServerFacebookMessage,
  ServerFacebookTemplate,
  StartConnectResult,
  UpdateListingInput,
  toClientComment,
  toClientConnection,
  toClientConversation,
  toClientFbMessage,
  toClientGroupTarget,
  toClientListing,
  toClientTemplate,
} from "@/lib/facebook-mapper";

export const FACEBOOK_KEY = ["facebook"] as const;

// ── Connected Pages ("Destinations") ───────────────────────────────────────

export function useFacebookConnections() {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "connections"],
    queryFn: async () => {
      const res = await api<ServerFacebookConnection[]>("/facebook/connections");
      return res.map(toClientConnection);
    },
  });
}

/**
 * Step 1 of connect. Returns `devMode` + the FB login URL. The page decides:
 * dev-mode → call useCompleteConnect directly (simulated); real-mode → redirect
 * the browser to `authUrl`.
 */
export function useStartConnect() {
  return useMutation({
    mutationFn: async (): Promise<StartConnectResult> =>
      api<StartConnectResult>("/facebook/connect/start", { method: "POST" }),
  });
}

/**
 * Step 2 of connect. In dev-mode the body is empty (the backend mints a mock
 * Page); in real-mode (Phase 0b) it carries the OAuth `code` + `state`.
 */
export function useCompleteConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { code?: string; state?: string } = {},
    ): Promise<FacebookConnection[]> => {
      const res = await api<ServerFacebookConnection[]>("/facebook/connect/callback", {
        method: "POST",
        body: input,
      });
      return res.map(toClientConnection);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/facebook/connections/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Set (or clear) a connection's Marketplace product-catalog id. Once set, the
 * Publish tab surfaces a "Marketplace (catalog)" destination for that Page and
 * the backend syncs vehicles into the catalog via the Item API.
 */
export function useSetConnectionCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      catalogId?: string;
      catalogToken?: string;
    }): Promise<void> => {
      const body: Record<string, string> = {};
      if (args.catalogId !== undefined) body.catalogId = args.catalogId;
      // Only send the token when present so a blank field leaves it unchanged.
      if (args.catalogToken !== undefined) body.catalogToken = args.catalogToken;
      await api(`/facebook/connections/${args.id}`, { method: "PATCH", body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FACEBOOK_KEY }),
  });
}

// ── Listings ────────────────────────────────────────────────────────────────

export interface ListingFilters {
  status?: string;
  vehicleId?: string;
  connectionId?: string;
}

export function useFacebookListings(filters: ListingFilters = {}) {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "listings", filters],
    queryFn: async () => {
      const res = await api<ServerFacebookListing[]>("/facebook/listings", {
        query: { ...filters },
      });
      return res.map(toClientListing);
    },
  });
}

export function useCreateListings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateListingInput): Promise<FacebookListing[]> => {
      const res = await api<ServerFacebookListing[]>("/facebook/listings", {
        method: "POST",
        body: input,
      });
      return res.map(toClientListing);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePublishListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<FacebookListing> => {
      const res = await api<ServerFacebookListing>(`/facebook/listings/${id}/publish`, {
        method: "POST",
      });
      return toClientListing(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRemoveListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/facebook/listings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: UpdateListingInput;
    }): Promise<FacebookListing> => {
      const res = await api<ServerFacebookListing>(`/facebook/listings/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      return toClientListing(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDuplicateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<FacebookListing> => {
      const res = await api<ServerFacebookListing>(`/facebook/listings/${id}/duplicate`, {
        method: "POST",
      });
      return toClientListing(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FACEBOOK_KEY }),
  });
}

// ── Templates ─────────────────────────────────────────────────────────────

export function useFacebookTemplates() {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "templates"],
    queryFn: async () => {
      const res = await api<ServerFacebookTemplate[]>("/facebook/templates");
      return res.map(toClientTemplate);
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput): Promise<FacebookTemplate> => {
      const res = await api<ServerFacebookTemplate>("/facebook/templates", {
        method: "POST",
        body: input,
      });
      return toClientTemplate(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/facebook/templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "templates"] }),
  });
}

// ── Engagement + comments (Phase 2) ─────────────────────────────────────────

export interface CommentFilters {
  listingId?: string;
  status?: string;
}

/** Polls every 20s (project convention: comments are dashboard-like data, not
 *  chat — so polling, not WebSockets, per PROJECT_MEMORY). */
const COMMENT_POLL_MS = 20_000;

export function useFacebookComments(filters: CommentFilters = {}) {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "comments", filters],
    queryFn: async () => {
      const res = await api<ServerFacebookComment[]>("/facebook/comments", {
        query: { ...filters },
      });
      return res.map(toClientComment);
    },
    refetchInterval: COMMENT_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useReplyComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; message: string }): Promise<FacebookComment> => {
      const res = await api<ServerFacebookComment>(`/facebook/comments/${args.id}/reply`, {
        method: "POST",
        body: { message: args.message },
      });
      return toClientComment(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "comments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<FacebookComment> => {
      const res = await api<ServerFacebookComment>(`/facebook/comments/${id}/resolve`, {
        method: "POST",
      });
      return toClientComment(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "comments"] }),
  });
}

/** Mark all of a listing's comments as read (seen). Invalidates the whole
 *  facebook cache so the per-row, tab, AND sidebar nav unread badges update. */
export function useMarkCommentsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string): Promise<void> => {
      await api(`/facebook/listings/${listingId}/comments/read`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FACEBOOK_KEY }),
  });
}

/** Total unread Facebook messages + comments — drives the sidebar nav badge.
 *  Pass `enabled=false` for users without Facebook view permission (avoids 403 loop). */
export function useFacebookUnreadCount(enabled = true) {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "unread-count"],
    queryFn: async () =>
      api<{ messages: number; comments: number; total: number }>("/facebook/unread-count"),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/** Refresh engagement + comments for a listing from Facebook (on-demand). */
export function useSyncListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/facebook/listings/${id}/sync`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FACEBOOK_KEY }),
  });
}

/** Refresh engagement (reactions/comments/shares) + comments for ALL active
 *  listings in one call — used by the page-level 30s auto-sync. */
export function useSyncAllEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api(`/facebook/sync-engagement`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FACEBOOK_KEY }),
  });
}

// ── Messenger conversations + lead pipeline (Phase 3) ───────────────────────

export interface ConversationFilters {
  leadStatus?: string;
  assignedTo?: string;
}

export function useFacebookConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "conversations", filters],
    queryFn: async () => {
      const res = await api<ServerFacebookConversation[]>("/facebook/conversations", {
        query: { ...filters },
      });
      return res.map(toClientConversation);
    },
    refetchInterval: COMMENT_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useConversationMessages(convId: string | null) {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "messages", convId],
    queryFn: async () => {
      const res = await api<ServerFacebookMessage[]>(
        `/facebook/conversations/${convId}/messages`,
      );
      return res.map(toClientFbMessage);
    },
    enabled: !!convId,
    refetchInterval: 15_000,
    staleTime: 0,
  });
}

export function useSendFbReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; message: string }): Promise<void> => {
      await api(`/facebook/conversations/${args.id}/reply`, {
        method: "POST",
        body: { message: args.message },
      });
    },
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "messages", args.id] });
      qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "conversations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: { assignedTo?: string; assignedToName?: string; leadStatus?: string };
    }): Promise<FacebookConversation> => {
      const res = await api<ServerFacebookConversation>(`/facebook/conversations/${args.id}`, {
        method: "PATCH",
        body: args.input,
      });
      return toClientConversation(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "conversations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSyncConversations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api(`/facebook/sync-conversations`, { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "conversations"] }),
  });
}

export interface PromoteLeadInput {
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  notes?: string;
}

/** Promote a Messenger conversation into a real CDMS Lead (creates a BuyerLead
 *  + Lead). Invalidates the leads/buyers caches too since real CRM rows are made. */
export function usePromoteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      input: PromoteLeadInput;
    }): Promise<FacebookConversation> => {
      const res = await api<ServerFacebookConversation>(
        `/facebook/conversations/${args.id}/promote-lead`,
        { method: "POST", body: args.input },
      );
      return toClientConversation(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "conversations"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Group targets + assisted-manual (Phase 5) ───────────────────────────────

export function useGroupTargets() {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "groups"],
    queryFn: async () => {
      const res = await api<ServerFacebookGroupTarget[]>("/facebook/groups");
      return res.map(toClientGroupTarget);
    },
  });
}

export function useCreateGroupTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGroupTargetInput): Promise<FacebookGroupTarget> => {
      const res = await api<ServerFacebookGroupTarget>("/facebook/groups", {
        method: "POST",
        body: input,
      });
      return toClientGroupTarget(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "groups"] }),
  });
}

export function useDeleteGroupTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/facebook/groups/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...FACEBOOK_KEY, "groups"] }),
  });
}

// ── Analytics (Phase 6) ─────────────────────────────────────────────────────

export function useFacebookAnalytics() {
  return useQuery({
    queryKey: [...FACEBOOK_KEY, "analytics"],
    queryFn: async () => api<FacebookAnalytics>("/facebook/analytics"),
    // Refresh every 30s. The page-level auto-sync re-pulls engagement from Meta
    // on the same cadence (and invalidates the facebook cache), so the analytics
    // tab reflects fresh Meta data without a manual refresh.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/** Mark a group-manual listing as posted (after pasting into the group). */
export function useMarkPosted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; permalink?: string }): Promise<void> => {
      await api(`/facebook/listings/${args.id}/mark-posted`, {
        method: "POST",
        body: { permalink: args.permalink },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FACEBOOK_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
