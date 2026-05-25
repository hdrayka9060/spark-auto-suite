import { useEffect, useRef, useState } from "react";
import { Plus, Paperclip, Search, Loader2, AlertCircle, X, Send } from "lucide-react";
import {
  useCreateTicket, useReplyToTicket, useTicket, useTickets, useUpdateTicketStatus, useUploadTicketAttachments,
} from "@/hooks/api/use-tickets";
import { ApiError, fileUrl } from "@/lib/api";
import {
  ALL_TICKET_CATEGORIES, ALL_TICKET_PRIORITIES, ALL_TICKET_STATUSES,
  ClientTicketCategory, ClientTicketPriority, ClientTicketStatus, Ticket,
} from "@/lib/ticket-mapper";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";

const priorityColors: Record<ClientTicketPriority, string> = {
  Urgent: "bg-red-200 text-red-800",
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-blue-100 text-blue-700",
};

const statusBadgeClass: Record<ClientTicketStatus, string> = {
  Open: "open",
  "In Progress": "in-progress",
  Resolved: "resolved",
  Closed: "resolved",
};

export default function Support() {
  const { state } = useAuth();
  const currentUser = state.status === "authenticated" ? state.user : null;
  const agentName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : "Agent";
  const agentEmail = currentUser?.email;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientTicketStatus | "All">("All");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const ticketsQuery = useTickets({ search, status: statusFilter });
  const createTicket = useCreateTicket();
  const ticketDetailQuery = useTicket(selected ?? undefined);
  const replyTicket = useReplyToTicket(selected ?? "");
  const updateStatus = useUpdateTicketStatus(selected ?? "");
  const uploadAttachments = useUploadTicketAttachments(selected ?? "");

  const [newForm, setNewForm] = useState({
    subject: "", description: "",
    priority: "Medium" as ClientTicketPriority,
    category: "General" as ClientTicketCategory,
    raisedByName: "", raisedByEmail: "",
  });
  const resetNewForm = () => setNewForm({
    subject: "", description: "", priority: "Medium", category: "General", raisedByName: "", raisedByEmail: "",
  });

  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tickets = ticketsQuery.data?.data ?? [];
  const detail = ticketDetailQuery.data;

  useEffect(() => {
    if (selected && tickets.some((t) => t.id === selected)) return;
    if (tickets.length > 0) setSelected(tickets[0].id);
    else setSelected(null);
  }, [tickets, selected]);

  const handleCreate = async () => {
    if (!newForm.subject || !newForm.description || !newForm.raisedByName || !newForm.raisedByEmail) {
      toast({ title: "Missing info", description: "Subject, description, raiser name and email are required.", variant: "destructive" });
      return;
    }
    try {
      const ticket = await createTicket.mutateAsync(newForm);
      toast({ title: "Ticket created", description: ticket.subject });
      setSelected(ticket.id);
      resetNewForm();
      setShowNew(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create ticket";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      await replyTicket.mutateAsync({
        message: reply.trim(),
        sentByName: agentName,
        sentByEmail: agentEmail,
        isInternal,
      });
      setReply("");
      setIsInternal(false);
      toast({ title: "Reply sent" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Send failed";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: ClientTicketStatus) => {
    if (!selected) return;
    try {
      await updateStatus.mutateAsync({ status });
      toast({ title: "Status updated", description: status });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 5) {
      toast({ title: "Too many files", description: "Up to 5 at a time.", variant: "destructive" });
      return;
    }
    try {
      await uploadAttachments.mutateAsync(files);
      toast({ title: "Attached", description: `${files.length} file(s)` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Support</h1>
          <p className="text-muted-foreground text-sm">Ticket management and customer support</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? "Cancel" : "New Ticket"}
        </button>
      </div>

      {showNew && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Raise a Ticket</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Subject *" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            <input value={newForm.raisedByName} onChange={(e) => setNewForm({ ...newForm, raisedByName: e.target.value })} placeholder="Customer name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={newForm.raisedByEmail} onChange={(e) => setNewForm({ ...newForm, raisedByEmail: e.target.value })} placeholder="Customer email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value as ClientTicketPriority })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_TICKET_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={newForm.category} onChange={(e) => setNewForm({ ...newForm, category: e.target.value as ClientTicketCategory })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <textarea
            value={newForm.description}
            onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
            placeholder="Describe the issue… *"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground">Attach files after creating the ticket from the detail view.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNew(false); resetNewForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={createTicket.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createTicket.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Ticket
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["All", ...ALL_TICKET_STATUSES] as (ClientTicketStatus | "All")[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 stat-card space-y-1 max-h-[600px] overflow-y-auto">
          {ticketsQuery.isLoading && (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
            </div>
          )}
          {ticketsQuery.error && (
            <div className="text-red-600 text-sm p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Could not load"}
            </div>
          )}
          {!ticketsQuery.isLoading && !ticketsQuery.error && tickets.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No tickets. Click "New Ticket" to create one.
            </div>
          )}
          {tickets.map((t) => (
            <TicketListItem key={t.id} ticket={t} selected={selected === t.id} onSelect={() => setSelected(t.id)} />
          ))}
        </div>

        <div className="lg:col-span-2 stat-card">
          {!selected && (
            <div className="text-center text-muted-foreground py-12 text-sm">Select a ticket</div>
          )}
          {selected && ticketDetailQuery.isLoading && (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {selected && ticketDetailQuery.error && (
            <div className="text-red-600 text-sm flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4" /> {ticketDetailQuery.error instanceof Error ? ticketDetailQuery.error.message : "Could not load ticket"}
            </div>
          )}
          {detail && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-display font-semibold">{detail.subject}</h3>
                  <p className="text-sm text-muted-foreground">{detail.raisedByName} · <span className="font-mono">{detail.id.slice(-8)}</span> · {detail.createdAt}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`status-badge ${priorityColors[detail.priority]}`}>{detail.priority}</span>
                  <select
                    value={detail.status}
                    onChange={(e) => handleStatusChange(e.target.value as ClientTicketStatus)}
                    disabled={updateStatus.isPending}
                    className={`status-badge ${statusBadgeClass[detail.status]} border-0 cursor-pointer`}
                  >
                    {ALL_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm whitespace-pre-wrap mb-3"><span className="font-medium">Description:</span> {detail.description}</p>
                {detail.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {detail.attachments.map((a, i) => (
                      <a key={i} href={fileUrl(a)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 bg-muted rounded hover:bg-muted/80">
                        <Paperclip className="h-3 w-3" /> {a.split("/").pop()}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-4">
                {detail.thread.length === 0 && (
                  <p className="text-sm text-muted-foreground py-3">No replies yet.</p>
                )}
                {detail.thread.map((m, i) => {
                  const isAgent = m.sentByEmail === agentEmail || m.sentByName === agentName;
                  return (
                    <div key={i} className={`flex gap-3 ${isAgent ? "flex-row-reverse" : ""}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${isAgent ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.sentByName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className={`max-w-[70%] ${isAgent ? "text-right" : ""}`}>
                        {m.isInternal && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 mb-1">Internal note</span>
                        )}
                        <div className={`p-3 rounded-xl text-sm whitespace-pre-wrap ${isAgent ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"} ${m.isInternal ? "ring-2 ring-amber-200" : ""}`}>
                          {m.message}
                        </div>
                        {m.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 justify-end">
                            {m.attachments.map((a, j) => (
                              <a key={j} href={fileUrl(a)} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground hover:underline">
                                {a.split("/").pop()}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{m.sentByName} · {m.sentAt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                    Internal note (not sent to customer)
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                    placeholder="Type a reply…"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAttachments.isPending}
                    className="p-2 hover:bg-muted rounded-lg disabled:opacity-60"
                    title="Attach files"
                  >
                    {uploadAttachments.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleAttach}
                    className="hidden"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!reply.trim() || replyTicket.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    {replyTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketListItem({ ticket, selected, onSelect }: { ticket: Ticket; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${selected ? "bg-primary/5 border border-primary/20" : "hover:bg-muted"}`}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="font-mono text-xs text-muted-foreground">{ticket.id.slice(-6)}</span>
        <span className={`status-badge ${statusBadgeClass[ticket.status]}`}>{ticket.status}</span>
      </div>
      <p className="text-sm font-medium truncate">{ticket.subject}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-muted-foreground truncate">{ticket.raisedByName} · {ticket.createdAt}</p>
        <span className={`status-badge ${priorityColors[ticket.priority]} text-[10px]`}>{ticket.priority}</span>
      </div>
    </div>
  );
}
