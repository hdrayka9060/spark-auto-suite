import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Paperclip, Search, Pencil, Trash2, X, Loader2, UserPlus, Settings2,
  FileText, Plus, Users, MessageSquare, ShieldCheck, LogOut,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { useCan } from "@/components/Can";
import { fileUrl, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  useConversations, useMessages, useCreateConversation, useSendMessage, useEditMessage,
  useDeleteMessage, useUpdateGroup, useDeleteGroup, useAddParticipants, useRemoveParticipant,
  useSetParticipantRole, useMarkRead, useMessagingDirectory,
} from "@/hooks/api/use-messaging";
import {
  Conversation, ChatMessage, conversationTitle, conversationSubtitle,
  canModifyMessage, initials, chatTime,
} from "@/lib/messaging-mapper";

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;

export default function Communication() {
  const { state } = useAuth();
  const myId = state.status === "authenticated" ? state.user._id : "";
  const canEdit = useCan("Communication", "edit");

  const convsQuery = useConversations();
  const conversations = convsQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState<null | "direct" | "group">(null);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

  const markRead = useMarkRead();

  useEffect(() => {
    if (!selectedId && conversations.length) setSelectedId(conversations[0]._id);
  }, [selectedId, conversations]);

  const selected = useMemo(
    () => conversations.find((c) => c._id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => conversationTitle(c).toLowerCase().includes(q));
  }, [conversations, search]);

  return (
    <div className="animate-fade-in">
      <div className="module-header mb-4">
        <div>
          <h1 className="module-title">Communication</h1>
          <p className="text-muted-foreground text-sm">Message your team — direct chats and groups.</p>
        </div>
      </div>

      <div className="flex border rounded-xl overflow-hidden bg-card h-[calc(100vh-12rem)]">
        {/* Left: conversation list */}
        <div className="w-72 shrink-0 border-r flex flex-col">
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-1.5">
              <button
                disabled={!canEdit}
                onClick={() => setNewOpen("direct")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg px-2 py-2 hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
              <button
                disabled={!canEdit}
                onClick={() => setNewOpen("group")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border rounded-lg px-2 py-2 hover:bg-muted disabled:opacity-50"
              >
                <Users className="h-3.5 w-3.5" /> New group
              </button>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats…"
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {convsQuery.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No conversations yet.</div>
            ) : (
              filtered.map((c) => (
                <ConversationRow key={c._id} conv={c} active={c._id === selectedId} onClick={() => setSelectedId(c._id)} />
              ))
            )}
          </div>
        </div>

        {/* Right: thread */}
        {selected ? (
          <ChatThread
            key={selected._id}
            conv={selected}
            myId={myId}
            canEdit={canEdit}
            onMarkRead={() => markRead.mutate(selected._id)}
            onOpenGroupSettings={() => setGroupSettingsOpen(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Select a conversation or start a new one.
            </div>
          </div>
        )}
      </div>

      {newOpen && (
        <NewConversationDialog
          mode={newOpen}
          myId={myId}
          onClose={() => setNewOpen(null)}
          onCreated={(id) => { setNewOpen(null); setSelectedId(id); }}
        />
      )}
      {groupSettingsOpen && selected && selected.type === "group" && (
        <GroupSettingsDialog
          conv={selected}
          myId={myId}
          onClose={() => setGroupSettingsOpen(false)}
          onDeleted={() => { setGroupSettingsOpen(false); setSelectedId(null); }}
        />
      )}
    </div>
  );
}

// ── Conversation list row ────────────────────────────────────────────────

function ConversationRow({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const title = conversationTitle(conv);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b flex items-center gap-3 transition-colors ${
        active ? "bg-primary/5" : "hover:bg-muted/60"
      }`}
    >
      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
        conv.type === "group" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
      }`}>
        {conv.type === "group" ? <Users className="h-4 w-4" /> : initials(title)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">{title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{chatTime(conv.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">
            {conv.lastMessagePreview || conversationSubtitle(conv)}
          </span>
          {conv.unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Thread (header + messages + composer) ──────────────────────────────────

function ChatThread({
  conv, myId, canEdit, onMarkRead, onOpenGroupSettings,
}: {
  conv: Conversation; myId: string; canEdit: boolean;
  onMarkRead: () => void; onOpenGroupSettings: () => void;
}) {
  const messagesQuery = useMessages(conv._id);
  const messages = messagesQuery.data ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark read on open + whenever the message set grows while open (incoming).
  // We intentionally do NOT gate on conv.unreadCount: that prop comes from a
  // separately-refetching query and is usually still stale (0) at the instant a
  // socket-pushed message bumps messages.length — gating on it left the badge
  // stuck at 1 until the user interacted. markRead is a cheap PATCH and only
  // invalidates conversations/unread (not messages), so this can't loop.
  useEffect(() => {
    onMarkRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv._id, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const title = conversationTitle(conv);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-14 border-b px-4 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{conversationSubtitle(conv)}</p>
        </div>
        {conv.type === "group" && (
          <button
            onClick={onOpenGroupSettings}
            className="flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 hover:bg-muted"
            title="Group settings"
          >
            <Settings2 className="h-3.5 w-3.5" /> Manage
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messagesQuery.isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center mt-8">No messages yet — say hello 👋</div>
        ) : (
          messages.map((m) => <MessageBubble key={m._id} msg={m} conv={conv} isGroup={conv.type === "group"} />)
        )}
      </div>

      {canEdit ? (
        <Composer conversationId={conv._id} />
      ) : (
        <div className="border-t p-3 text-xs text-muted-foreground text-center">
          You have read-only access to Communication.
        </div>
      )}
    </div>
  );
}

// ── A single message ────────────────────────────────────────────────────────

function MessageBubble({ msg, conv, isGroup }: { msg: ChatMessage; conv: Conversation; isGroup: boolean }) {
  const editMsg = useEditMessage(conv._id);
  const deleteMsg = useDeleteMessage(conv._id);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body);

  const mine = msg.isMine;
  const canMod = canModifyMessage(msg);

  // System/event notice — centered, no bubble, no actions.
  if (msg.isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-3 py-1 text-center">
          {msg.body}
        </span>
      </div>
    );
  }

  const saveEdit = async () => {
    if (!draft.trim()) return;
    try {
      await editMsg.mutateAsync({ messageId: msg._id, body: draft.trim() });
      setEditing(false);
    } catch (e) {
      toast({ title: "Edit failed", description: errMsg(e, "Could not edit"), variant: "destructive" });
    }
  };

  const doDelete = async () => {
    const ok = await confirm({ title: "Delete message?", description: "This removes it for everyone. Allowed within 6 hours of sending.", confirmText: "Delete" });
    if (!ok) return;
    try {
      await deleteMsg.mutateAsync(msg._id);
    } catch (e) {
      toast({ title: "Delete failed", description: errMsg(e, "Could not delete"), variant: "destructive" });
    }
  };

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
        {isGroup && !mine && <span className="text-[11px] text-muted-foreground mb-0.5 px-1">{msg.senderName}</span>}
        <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
          {msg.isDeleted ? (
            <span className="italic opacity-70">This message was deleted</span>
          ) : editing ? (
            <div className="space-y-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="w-full text-sm rounded-md px-2 py-1 text-foreground bg-background border" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setEditing(false); setDraft(msg.body); }} className="text-xs opacity-80 hover:opacity-100">Cancel</button>
                <button onClick={saveEdit} disabled={editMsg.isPending} className="text-xs font-medium underline">Save</button>
              </div>
            </div>
          ) : (
            <>
              {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
              {msg.attachments.length > 0 && (
                <div className={`space-y-1.5 ${msg.body ? "mt-2" : ""}`}>
                  {msg.attachments.map((a, i) => (
                    <Attachment key={i} url={a.url} name={a.name} mimeType={a.mimeType} size={a.size} mine={mine} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-0.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-muted-foreground">
            {chatTime(msg.createdAt)}{msg.isEdited && !msg.isDeleted ? " · edited" : ""}
          </span>
          {canMod && !editing && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
              <button onClick={() => { setEditing(true); setDraft(msg.body); }} title="Edit" className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={doDelete} title="Delete" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Attachment({ url, name, mimeType, size, mine }: { url: string; name: string; mimeType: string; size: number; mine: boolean }) {
  const href = fileUrl(url);
  if (mimeType.startsWith("image/")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        <img src={href} alt={name} className="max-h-48 rounded-lg border" />
      </a>
    );
  }
  const kb = size ? `${(size / 1024).toFixed(0)} KB` : "";
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${mine ? "bg-white/15" : "bg-background border"}`}>
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate max-w-[180px]">{name || "file"}</span>
      {kb && <span className="opacity-70 shrink-0">{kb}</span>}
    </a>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────

function Composer({ conversationId }: { conversationId: string }) {
  const send = useSendMessage(conversationId);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content up to a max height, then scroll inside.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = async () => {
    if (!text.trim() && files.length === 0) return;
    try {
      await send.mutateAsync({ body: text.trim() || undefined, files });
      setText("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast({ title: "Send failed", description: errMsg(e, "Could not send"), variant: "destructive" });
    }
  };

  return (
    <div className="border-t p-3 shrink-0">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs bg-muted rounded-full pl-2.5 pr-1.5 py-1">
              <FileText className="h-3 w-3" /> <span className="truncate max-w-[140px]">{f.name}</span>
              <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button onClick={() => fileRef.current?.click()} title="Attach files" className="p-2 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((p) => [...p, ...picked].slice(0, 10));
          }}
        />
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm bg-background overflow-y-auto leading-5"
        />
        <button
          onClick={submit}
          disabled={send.isPending || (!text.trim() && files.length === 0)}
          className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── New DM / New Group dialog ──────────────────────────────────────────────

function NewConversationDialog({
  mode, myId, onClose, onCreated,
}: { mode: "direct" | "group"; myId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const staffQuery = useMessagingDirectory();
  const create = useCreateConversation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const options = (staffQuery.data ?? []).filter((s) => s.id !== myId);
  const visible = options.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  const toggle = (id: string) => {
    if (mode === "direct") setSelected([id]);
    else setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const submit = async () => {
    if (selected.length === 0) { toast({ title: mode === "direct" ? "Pick someone to chat with" : "Pick at least one member", variant: "destructive" }); return; }
    if (mode === "group" && !name.trim()) { toast({ title: "Group name is required", variant: "destructive" }); return; }
    try {
      const conv = await create.mutateAsync({
        type: mode,
        participantIds: selected,
        name: mode === "group" ? name.trim() : undefined,
        description: mode === "group" ? description.trim() : undefined,
      });
      onCreated(conv._id);
    } catch (e) {
      toast({ title: "Could not create", description: errMsg(e, "Failed"), variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "direct" ? "New direct message" : "New group"}</DialogTitle>
          <DialogDescription>
            {mode === "direct" ? "Pick a teammate to start chatting." : "Name the group and add members."}
          </DialogDescription>
        </DialogHeader>

        {mode === "group" && (
          <div className="space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name *" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
        )}

        {mode === "direct" && (
          <button
            onClick={async () => {
              try {
                const conv = await create.mutateAsync({ type: "direct", participantIds: [myId] });
                onCreated(conv._id);
              } catch (e) {
                toast({ title: "Could not open", description: errMsg(e, "Failed"), variant: "destructive" });
              }
            }}
            disabled={create.isPending}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border hover:bg-muted/60 text-left disabled:opacity-60"
          >
            <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Self</p>
              <p className="text-xs text-muted-foreground">A private space to jot notes & save files</p>
            </div>
          </button>
        )}

        <div className="flex items-center gap-2 bg-muted rounded-lg px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="bg-transparent text-sm outline-none w-full" />
        </div>

        <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
          {staffQuery.isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading staff…</div>
          ) : visible.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No staff found.</div>
          ) : (
            visible.map((s) => {
              const checked = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60">
                  <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center">{initials(s.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.roleName || s.email}</p>
                  </div>
                  {checked && <ShieldCheck className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={submit} disabled={create.isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60 flex items-center gap-2">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "direct" ? "Start chat" : "Create group"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Group settings (edit name/desc, add/remove members, delete) ─────────────

function GroupSettingsDialog({
  conv, myId, onClose, onDeleted,
}: { conv: Conversation; myId: string; onClose: () => void; onDeleted: () => void }) {
  const update = useUpdateGroup(conv._id);
  const del = useDeleteGroup();
  const addMembers = useAddParticipants(conv._id);
  const removeMember = useRemoveParticipant(conv._id);
  const setRole = useSetParticipantRole(conv._id);
  const staffQuery = useMessagingDirectory();
  const confirm = useConfirm();

  const [name, setName] = useState(conv.name);
  const [description, setDescription] = useState(conv.description);
  const [shareHistory, setShareHistory] = useState(conv.shareHistoryWithNewMembers);
  const [adding, setAdding] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const isAdmin = conv.myRole === "admin" || conv.createdBy === myId;
  const activeMembers = conv.participants.filter((p) => !p.hasLeft);
  const activeIds = activeMembers.map((p) => p.userId);
  const candidates = (staffQuery.data ?? []).filter((s) => !activeIds.includes(s.id));
  const visibleCandidates = candidates.filter((s) => s.name.toLowerCase().includes(addSearch.trim().toLowerCase()));
  const amOnlyMember = activeMembers.length === 1;
  const amLastAdmin = isAdmin && activeMembers.filter((p) => !p.isYou && p.role === "admin").length === 0;

  // Group detail edits (name / description / history setting) are NOT saved
  // per-field. They commit together when the admin clicks Done — and only if
  // something actually changed. (Member add/remove/role actions are immediate.)
  const dirty = isAdmin && (
    name.trim() !== conv.name ||
    description.trim() !== conv.description ||
    shareHistory !== conv.shareHistoryWithNewMembers
  );
  const handleDone = async () => {
    if (!dirty) { onClose(); return; }
    if (name.trim() === "") {
      toast({ title: "Group name can't be empty", variant: "destructive" });
      return;
    }
    const patch: { name?: string; description?: string; shareHistoryWithNewMembers?: boolean } = {};
    if (name.trim() !== conv.name) patch.name = name.trim();
    if (description.trim() !== conv.description) patch.description = description.trim();
    if (shareHistory !== conv.shareHistoryWithNewMembers) patch.shareHistoryWithNewMembers = shareHistory;
    try {
      await update.mutateAsync(patch);
      onClose();
    } catch (e) {
      toast({ title: "Update failed", description: errMsg(e, "Failed"), variant: "destructive" });
    }
  };
  const doAdd = async () => {
    if (adding.length === 0) return;
    try {
      await addMembers.mutateAsync(adding);
      setAdding([]); setAddOpen(false); setAddSearch("");
      toast({ title: "Members added" });
    } catch (e) { toast({ title: "Add failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
  };
  const doSetRole = async (userId: string, label: string, role: "admin" | "member") => {
    try {
      await setRole.mutateAsync({ userId, role });
      toast({ title: role === "admin" ? `${label} is now an admin` : `${label} is no longer an admin` });
    } catch (e) { toast({ title: "Failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
  };
  const doRemove = async (userId: string, label: string) => {
    const ok = await confirm({ title: `Remove ${label}?`, confirmText: "Remove" });
    if (!ok) return;
    try { await removeMember.mutateAsync(userId); }
    catch (e) { toast({ title: "Failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
  };
  const doLeave = async () => {
    // Last member → leaving deletes the group.
    if (amOnlyMember) {
      const ok = await confirm({
        title: "Leave & delete group?",
        description: "You're the last member — leaving will permanently delete this group.",
        confirmText: "Leave & delete",
      });
      if (!ok) return;
      try { await removeMember.mutateAsync(myId); onDeleted(); }
      catch (e) { toast({ title: "Failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
      return;
    }
    // Sole admin with others remaining → must hand off admin first.
    if (amLastAdmin) {
      toast({
        title: "You're the only admin",
        description: "Make another member an admin before leaving the group.",
        variant: "destructive",
      });
      return;
    }
    const ok = await confirm({ title: "Leave group?", confirmText: "Leave" });
    if (!ok) return;
    try { await removeMember.mutateAsync(myId); onClose(); }
    catch (e) { toast({ title: "Failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
  };
  const doDelete = async () => {
    const ok = await confirm({ title: `Delete "${conv.name}"?`, description: "The group and its history are removed for everyone.", confirmText: "Delete" });
    if (!ok) return;
    try { await del.mutateAsync(conv._id); onDeleted(); }
    catch (e) { toast({ title: "Delete failed", description: errMsg(e, "Failed"), variant: "destructive" }); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleDone(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Group settings</DialogTitle>
          <DialogDescription>{isAdmin ? "Edit details and manage members." : "Group details. Only admins can edit."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} placeholder="Group name" className="w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:bg-muted" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isAdmin} placeholder="Description" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:bg-muted" />
          <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
            <input type="checkbox" checked={shareHistory} disabled={!isAdmin} onChange={(e) => setShareHistory(e.target.checked)} className="h-3.5 w-3.5 accent-primary mt-0.5" />
            <span>New members can read messages from before they joined. Changing this only affects people added afterwards.</span>
          </label>
          {isAdmin && dirty && (
            <p className="text-[11px] text-amber-600">Unsaved changes — click <span className="font-medium">Done</span> to save.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members ({activeMembers.length})</p>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:opacity-90 shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add member
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
            {activeMembers.map((p) => (
              <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5">
                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-[9px] font-semibold flex items-center justify-center">{initials(p.name)}</div>
                <span className="text-sm flex-1 truncate">{p.name}{p.isYou ? " (you)" : ""}</span>
                {p.role === "admin" && <span className="text-[10px] text-violet-700 bg-violet-100 rounded px-1.5 py-0.5">admin</span>}
                {isAdmin && !p.isYou && (
                  <button
                    onClick={() => doSetRole(p.userId, p.name, p.role === "admin" ? "member" : "admin")}
                    disabled={setRole.isPending}
                    className="text-[10px] text-primary hover:underline whitespace-nowrap"
                  >
                    {p.role === "admin" ? "Remove admin" : "Make admin"}
                  </button>
                )}
                {isAdmin && !p.isYou && (
                  <button onClick={() => doRemove(p.userId, p.name)} title="Remove from group" className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add-member picker — revealed by the prominent "Add member" button.
            Any member can add (not just admins). */}
        {addOpen && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-primary" /> Add people to this group
              </p>
              <button onClick={() => { setAddOpen(false); setAdding([]); setAddSearch(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Everyone is already in this group.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-1.5 border">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search staff…" className="bg-transparent text-sm outline-none w-full" />
                </div>
                <div className="max-h-44 overflow-y-auto border rounded-lg divide-y bg-background">
                  {visibleCandidates.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-3">No staff match.</p>
                  ) : (
                    visibleCandidates.map((s) => {
                      const checked = adding.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => setAdding((p) => checked ? p.filter((x) => x !== s.id) : [...p, s.id])}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/60"}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0">{initials(s.name)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.roleName || s.email}</p>
                          </div>
                          {checked && <ShieldCheck className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  onClick={doAdd}
                  disabled={adding.length === 0 || addMembers.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {addMembers.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {adding.length ? `Add ${adding.length} ${adding.length === 1 ? "person" : "people"}` : "Select people to add"}
                </button>
              </>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between gap-2">
          <div className="flex items-center gap-4">
            <button onClick={doLeave} disabled={removeMember.isPending} className="text-xs text-amber-700 hover:underline flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Leave group
            </button>
            {isAdmin && (
              <button onClick={doDelete} disabled={del.isPending} className="text-xs text-red-600 hover:underline flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete group
              </button>
            )}
          </div>
          <button onClick={handleDone} disabled={update.isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60 flex items-center gap-2">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
