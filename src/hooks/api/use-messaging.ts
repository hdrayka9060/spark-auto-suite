import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ChatMessage, Conversation, ConversationType } from "@/lib/messaging-mapper";

export const MESSAGING_KEY = ["messaging"] as const;
const convKey = () => [...MESSAGING_KEY, "conversations"];
const msgKey = (id: string) => [...MESSAGING_KEY, "messages", id];
const unreadKey = () => [...MESSAGING_KEY, "unread"];

function invalidate(qc: ReturnType<typeof useQueryClient>, convId?: string) {
  qc.invalidateQueries({ queryKey: convKey() });
  qc.invalidateQueries({ queryKey: unreadKey() });
  if (convId) qc.invalidateQueries({ queryKey: msgKey(convId) });
}

// ── Queries ──────────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: convKey(),
    queryFn: () => api<Conversation[]>("/messaging/conversations"),
    staleTime: 5_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: msgKey(conversationId ?? "none"),
    queryFn: () => api<ChatMessage[]>(`/messaging/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  });
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  roleName?: string;
}

/** Active staff for the chat people-picker — Communication-gated (not Staff:view). */
export function useMessagingDirectory() {
  return useQuery({
    queryKey: [...MESSAGING_KEY, "directory"],
    queryFn: () => api<DirectoryUser[]>("/messaging/directory"),
    staleTime: 60_000,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: unreadKey(),
    queryFn: () => api<{ total: number }>("/messaging/unread-count"),
    enabled,
    // Socket events invalidate this live; the interval is a cheap safety net.
    refetchInterval: 60_000,
    staleTime: 5_000,
  });
}

// ── Conversation / group mutations ─────────────────────────────────────────

export interface CreateConversationInput {
  type: ConversationType;
  participantIds: string[];
  name?: string;
  description?: string;
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConversationInput) =>
      api<Conversation>("/messaging/conversations", { method: "POST", body: input }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateGroup(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string; shareHistoryWithNewMembers?: boolean }) =>
      api<Conversation>(`/messaging/conversations/${conversationId}`, { method: "PATCH", body: input }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useSetParticipantRole(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "member" }) =>
      api<Conversation>(`/messaging/conversations/${conversationId}/participants/${input.userId}/role`, {
        method: "PATCH",
        body: { role: input.role },
      }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api(`/messaging/conversations/${conversationId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddParticipants(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      api<Conversation>(`/messaging/conversations/${conversationId}/participants`, { method: "POST", body: { userIds } }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useRemoveParticipant(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<Conversation>(`/messaging/conversations/${conversationId}/participants/${userId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

// ── Messages ────────────────────────────────────────────────────────────────

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body?: string; files?: File[] }) => {
      const fd = new FormData();
      if (input.body) fd.append("body", input.body);
      for (const f of input.files ?? []) fd.append("files", f);
      return api<ChatMessage>(`/messaging/conversations/${conversationId}/messages`, {
        method: "POST",
        body: fd,
        rawBody: true,
      });
    },
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useEditMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { messageId: string; body: string }) =>
      api<ChatMessage>(`/messaging/conversations/${conversationId}/messages/${input.messageId}`, {
        method: "PATCH",
        body: { body: input.body },
      }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api<ChatMessage>(`/messaging/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc, conversationId),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api(`/messaging/conversations/${conversationId}/read`, { method: "PATCH" }),
    onSuccess: () => invalidate(qc),
  });
}
