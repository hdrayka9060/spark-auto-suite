import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, MessageCircle, PhoneCall, Search, Car, User, Plus, X, Loader2, AlertCircle, Send } from "lucide-react";
import { useCommunicationLogs, useSendCommunication } from "@/hooks/api/use-communication";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError } from "@/lib/api";
import { ClientCommChannel, Conversation } from "@/lib/communication-mapper";
import { toast } from "@/hooks/use-toast";

const ALL_CHANNELS: ClientCommChannel[] = ["Email", "SMS", "WhatsApp", "Call"];

const channelIcons: Record<ClientCommChannel, typeof Mail> = {
  Email: Mail,
  SMS: Phone,
  WhatsApp: MessageCircle,
  Call: PhoneCall,
};
const channelColors: Record<ClientCommChannel, string> = {
  Email: "bg-blue-100 text-blue-700",
  SMS: "bg-violet-100 text-violet-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
  Call: "bg-amber-100 text-amber-700",
};

type FilterChannel = "All" | ClientCommChannel;

export default function Communication() {
  const [channel, setChannel] = useState<FilterChannel>("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const logsQuery = useCommunicationLogs({ channel });
  const sendComm = useSendCommunication();
  const vehiclesQuery = useVehicles({ limit: 100 });

  const conversations = logsQuery.data?.conversations ?? [];

  const filtered = useMemo(
    () => conversations.filter((c) => c.customer.toLowerCase().includes(search.toLowerCase()) || c.contact.toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );

  useEffect(() => {
    if (selected && filtered.some((c) => c.id === selected)) return;
    if (filtered.length > 0) setSelected(filtered[0].id);
    else setSelected(null);
  }, [filtered, selected]);

  const detail = filtered.find((c) => c.id === selected) ?? null;

  const [replyText, setReplyText] = useState("");
  const [replyChannel, setReplyChannel] = useState<ClientCommChannel>("Email");
  useEffect(() => {
    if (detail) setReplyChannel(detail.lastChannel);
  }, [detail?.id]);

  const [newForm, setNewForm] = useState({
    recipientName: "", recipientContact: "", channel: "Email" as ClientCommChannel,
    subject: "", message: "", linkedVehicleId: "",
  });

  const resetNewForm = () => setNewForm({
    recipientName: "", recipientContact: "", channel: "Email",
    subject: "", message: "", linkedVehicleId: "",
  });

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    try {
      await sendComm.mutateAsync({
        channel: replyChannel,
        recipientName: detail.customer,
        recipientContact: detail.contact,
        subject: replyChannel === "Email" ? `Re: ${detail.messages.find((m) => m.subject)?.subject ?? "(no subject)"}` : undefined,
        message: replyText.trim(),
      });
      setReplyText("");
      toast({ title: `${replyChannel} sent`, description: detail.customer });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Send failed";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    }
  };

  const handleNewConversation = async () => {
    if (!newForm.recipientName || !newForm.recipientContact || !newForm.message) {
      toast({ title: "Missing info", description: "Name, contact, and message are required.", variant: "destructive" });
      return;
    }
    try {
      await sendComm.mutateAsync({
        channel: newForm.channel,
        recipientName: newForm.recipientName,
        recipientContact: newForm.recipientContact,
        subject: newForm.subject || undefined,
        message: newForm.message,
        linkedVehicleId: newForm.linkedVehicleId || undefined,
      });
      toast({ title: `${newForm.channel} sent`, description: newForm.recipientName });
      setSelected(newForm.recipientContact);
      resetNewForm();
      setComposerOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Send failed";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Communication Center</h1>
          <p className="text-muted-foreground text-sm">Unified messaging across all channels</p>
        </div>
        <button
          onClick={() => setComposerOpen(!composerOpen)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {composerOpen ? "Cancel" : "New Message"}
        </button>
      </div>

      {composerOpen && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Start a New Conversation</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={newForm.recipientName} onChange={(e) => setNewForm({ ...newForm, recipientName: e.target.value })} placeholder="Recipient name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={newForm.recipientContact} onChange={(e) => setNewForm({ ...newForm, recipientContact: e.target.value })} placeholder="Email or phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={newForm.channel} onChange={(e) => setNewForm({ ...newForm, channel: e.target.value as ClientCommChannel })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
            {newForm.channel === "Email" && (
              <input value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Subject" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            )}
            <select value={newForm.linkedVehicleId} onChange={(e) => setNewForm({ ...newForm, linkedVehicleId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Link a vehicle (optional)…</option>
              {(vehiclesQuery.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
          <textarea
            value={newForm.message}
            onChange={(e) => setNewForm({ ...newForm, message: e.target.value })}
            placeholder="Message *"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setComposerOpen(false); resetNewForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleNewConversation}
              disabled={sendComm.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {sendComm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["All", ...ALL_CHANNELS] as FilterChannel[]).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${channel === c ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-360px)] min-h-[400px]">
        <div className="stat-card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or contact…" className="bg-transparent text-sm outline-none w-full" />
          </div>

          {logsQuery.isLoading && (
            <div className="flex items-center justify-center text-muted-foreground text-sm gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {logsQuery.error && (
            <div className="text-red-600 text-sm py-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {logsQuery.error instanceof Error ? logsQuery.error.message : "Could not load"}
            </div>
          )}

          {!logsQuery.isLoading && filtered.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center px-3">
              No conversations match. Click "New Message" to start one.
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.map((c) => <ConversationListItem key={c.id} c={c} selected={selected === c.id} onSelect={() => setSelected(c.id)} />)}
          </div>
        </div>

        <div className="lg:col-span-2 stat-card flex flex-col overflow-hidden">
          {detail ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>
                  <div>
                    <p className="font-medium">{detail.customer}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{detail.contact}</span>
                      {[...detail.channels].map((c) => (
                        <span key={c} className={`px-1.5 py-0.5 rounded ${channelColors[c]}`}>{c}</span>
                      ))}
                      {detail.vehicleTitle && (
                        <span className="flex items-center gap-1"><Car className="h-3 w-3" />{detail.vehicleTitle}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {detail.messages.map((m) => {
                  const isAgent = m.direction === "outbound";
                  const Icon = channelIcons[m.channel];
                  return (
                    <div key={m.id} className={`flex gap-3 ${isAgent ? "flex-row-reverse" : ""}`}>
                      <div className={`max-w-[70%] ${isAgent ? "text-right" : ""}`}>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                          <Icon className="h-3 w-3" />
                          <span>{m.channel}</span>
                          {m.subject && m.channel === "Email" && (
                            <span className="ml-1 font-medium">{m.subject}</span>
                          )}
                        </div>
                        <div className={`p-3 rounded-xl text-sm whitespace-pre-wrap ${isAgent ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                          {m.message || (m.channel === "Call" && m.callDurationSeconds ? `Call · ${Math.round(m.callDurationSeconds / 60)} min` : "(no content)")}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {isAgent && m.sentByName ? `${m.sentByName} · ` : ""}{m.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Send via:</span>
                  {ALL_CHANNELS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setReplyChannel(c)}
                      className={`px-2 py-1 rounded text-xs ${replyChannel === c ? `${channelColors[c]} font-medium` : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                    placeholder={`Type a ${replyChannel} message…`}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sendComm.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    {sendComm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm text-center px-6">
              {logsQuery.isLoading ? "Loading conversations…" : "Select a conversation, or start a new one with the \"New Message\" button above."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationListItem({ c, selected, onSelect }: { c: Conversation; selected: boolean; onSelect: () => void }) {
  const Icon = channelIcons[c.lastChannel];
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${selected ? "bg-primary/5 border border-primary/20" : "hover:bg-muted"}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{c.customer}</span>
          {c.unread && <span className="h-2 w-2 bg-primary rounded-full shrink-0" />}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${channelColors[c.lastChannel]}`}>
          <Icon className="h-3 w-3 inline" />
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
      <div className="flex items-center gap-2 mt-1">
        {c.vehicleTitle && (
          <>
            <Car className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">{c.vehicleTitle}</span>
          </>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{c.lastTime}</span>
      </div>
    </div>
  );
}
