/**
 * Communication log mapper.
 *
 * The backend `communication_logs` collection stores flat per-message records.
 * The prototype Communication page renders threaded conversations grouped by
 * customer. We bridge the gap by grouping client-side: all logs sharing the
 * same `recipientContact` form one conversation.
 *
 * Inbound vs outbound is preserved in the schema; UI shows agent ("You") vs
 * customer bubbles accordingly.
 */

export type ServerCommChannel = "email" | "sms" | "whatsapp" | "call";
export type ServerCommDirection = "inbound" | "outbound";
export type ClientCommChannel = "Email" | "SMS" | "WhatsApp" | "Call";

export interface ServerCommunicationLog {
  _id: string;
  channel: ServerCommChannel;
  direction: ServerCommDirection;
  recipientName: string;
  recipientContact: string;
  subject: string;
  message: string;
  linkedVehicle?: { _id: string; title: string; vehicleNumber?: string } | string | null;
  linkedLeadId?: string;
  contactType?: string;
  sentBy?: { _id: string; firstName: string; lastName: string } | string | null;
  deliveryStatus: string;
  callDurationSeconds?: number;
  createdAt: string;
}

export interface CommMessage {
  id: string;
  channel: ClientCommChannel;
  direction: ServerCommDirection;
  recipientName: string;
  recipientContact: string;
  subject: string;
  message: string;
  vehicleId?: string;
  vehicleTitle?: string;
  sentByName?: string;
  createdAt: string;
  /** "9:35 AM" */
  time: string;
  /** Total call duration in seconds (channel === "Call"). */
  callDurationSeconds?: number;
}

export interface Conversation {
  /** Stable key — the customer's recipientContact (email or phone). */
  id: string;
  customer: string;
  contact: string;
  channels: Set<ClientCommChannel>;
  /** The most-recent channel used. Drives the channel badge in the list view. */
  lastChannel: ClientCommChannel;
  /** Most-recent vehicle linked across all messages in this conversation. */
  vehicleTitle?: string;
  lastMessage: string;
  lastTime: string; // pretty short — "2 min ago", "9:35 AM"
  lastTimestamp: string; // ISO
  unread: boolean; // always false until inbound provider integration lands
  messages: CommMessage[];
}

const CHANNEL_TO_CLIENT: Record<ServerCommChannel, ClientCommChannel> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Call",
};

const CHANNEL_TO_SERVER: Record<ClientCommChannel, ServerCommChannel> = {
  Email: "email",
  SMS: "sms",
  WhatsApp: "whatsapp",
  Call: "call",
};

export function commChannelToServer(c: ClientCommChannel): ServerCommChannel {
  return CHANNEL_TO_SERVER[c];
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const delta = Math.max(0, now - then);
  const min = Math.floor(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function refTitle(v: ServerCommunicationLog["linkedVehicle"]): string | undefined {
  if (!v || typeof v === "string") return undefined;
  return v.title;
}
function refId(v: ServerCommunicationLog["linkedVehicle"]): string | undefined {
  if (!v) return undefined;
  return typeof v === "string" ? v : v._id;
}

export function toClientMessage(s: ServerCommunicationLog): CommMessage {
  const sentBy = typeof s.sentBy === "string" || !s.sentBy ? null : s.sentBy;
  return {
    id: s._id,
    channel: CHANNEL_TO_CLIENT[s.channel],
    direction: s.direction,
    recipientName: s.recipientName,
    recipientContact: s.recipientContact,
    subject: s.subject,
    message: s.message,
    vehicleId: refId(s.linkedVehicle),
    vehicleTitle: refTitle(s.linkedVehicle),
    sentByName: sentBy ? `${sentBy.firstName} ${sentBy.lastName}`.trim() : undefined,
    createdAt: s.createdAt,
    time: formatClock(s.createdAt),
    callDurationSeconds: s.callDurationSeconds,
  };
}

/**
 * Group a flat log stream into conversations keyed by recipientContact.
 * Each conversation's messages are sorted chronologically (oldest first).
 */
export function groupByConversation(logs: ServerCommunicationLog[]): Conversation[] {
  const buckets = new Map<string, CommMessage[]>();
  for (const log of logs) {
    const key = log.recipientContact;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(toClientMessage(log));
  }

  const conversations: Conversation[] = [];
  for (const [contact, messages] of buckets) {
    messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = messages[messages.length - 1];
    const channels = new Set<ClientCommChannel>(messages.map((m) => m.channel));
    // Pick most-recent vehicle ref if any
    const vehicleTitle = [...messages].reverse().find((m) => m.vehicleTitle)?.vehicleTitle;
    conversations.push({
      id: contact,
      customer: last.recipientName,
      contact,
      channels,
      lastChannel: last.channel,
      vehicleTitle,
      lastMessage: last.message || `(${last.channel.toLowerCase()})`,
      lastTime: formatRelativeTime(last.createdAt),
      lastTimestamp: last.createdAt,
      unread: false,
      messages,
    });
  }

  // Sort conversations by newest activity first
  conversations.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));
  return conversations;
}

// ── Write direction ────────────────────────────────────────────────────────

export interface SendMessageInput {
  channel: ClientCommChannel;
  recipientName: string;
  recipientContact: string;
  subject?: string;
  message: string;
  linkedVehicleId?: string;
  callDurationSeconds?: number;
}

export function toServerSendPayload(input: SendMessageInput) {
  // Backend's subject is required. For SMS/WhatsApp/Call, synthesize one.
  const subject =
    input.subject?.trim() ||
    (input.channel === "Call" ? "Call interaction" : input.channel === "Email" ? "(no subject)" : input.message.slice(0, 60));
  return {
    recipientName: input.recipientName,
    recipientContact: input.recipientContact,
    subject,
    message: input.message,
    linkedVehicle: input.linkedVehicleId,
    callDurationSeconds: input.callDurationSeconds,
  };
}
