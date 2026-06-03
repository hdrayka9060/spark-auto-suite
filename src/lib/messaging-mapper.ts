/**
 * Types + small display helpers for staff chat. The backend already returns
 * client-friendly shapes (see MessagingService.enrich / shapeMessage), so this
 * file is mostly type definitions plus a couple of pure helpers — no API calls,
 * no React (the mapper-per-entity convention).
 */

export type ConversationType = "direct" | "group";
export type ParticipantRole = "member" | "admin";

export interface ChatParticipant {
  userId: string;
  name: string;
  role: ParticipantRole;
  /** True if the participant left / was removed / had their staff account deleted. */
  hasLeft: boolean;
  isYou: boolean;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  name: string;
  description: string;
  /** Group setting: do members added later see prior history? (admin-controlled) */
  shareHistoryWithNewMembers: boolean;
  createdBy: string | null;
  participants: ChatParticipant[];
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
  myRole: ParticipantRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  senderId: string;
  senderName: string;
  isMine: boolean;
  /** System/event notice ("Alice added Bob", "Carol left the group") — centered, non-editable. */
  isSystem: boolean;
  body: string;
  attachments: ChatAttachment[];
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  /** Server-computed: sender may edit/delete until this instant (6h after send). */
  editableUntil: string;
}

/** The other party in a DM (the participant that isn't me). */
export function otherParticipant(conv: Conversation): ChatParticipant | undefined {
  return conv.participants.find((p) => !p.isYou);
}

/** A "Notes to self" chat — a direct conversation whose only participant is you. */
export function isSelfChat(conv: Conversation): boolean {
  return conv.type === "direct" && !conv.participants.some((p) => !p.isYou);
}

/** Display title: group name, "Self", or the DM counterpart's name. */
export function conversationTitle(conv: Conversation): string {
  if (conv.type === "group") return conv.name || "Untitled group";
  if (isSelfChat(conv)) return "Self";
  const other = otherParticipant(conv);
  if (!other) return "Conversation";
  return other.hasLeft ? `${other.name} (left)` : other.name;
}

/** Short subtitle for the list row (member count for groups, role for DMs). */
export function conversationSubtitle(conv: Conversation): string {
  if (conv.type === "group") {
    const active = conv.participants.filter((p) => !p.hasLeft).length;
    return `${active} member${active === 1 ? "" : "s"}`;
  }
  if (isSelfChat(conv)) return "Message yourself";
  return otherParticipant(conv)?.hasLeft ? "User left" : "Direct message";
}

/** Whether the current user can still edit/delete this (own + within 6h + not gone). */
export function canModifyMessage(msg: ChatMessage): boolean {
  if (msg.isSystem || !msg.isMine || msg.isDeleted) return false;
  return Date.now() < new Date(msg.editableUntil).getTime();
}

/** Two-letter initials for an avatar bubble. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact time/date label for message + list rows. */
export function chatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
