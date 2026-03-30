import { useState } from "react";
import { Mail, Phone, MessageCircle, PhoneCall, Search, Car, User } from "lucide-react";

type Channel = "All" | "Email" | "SMS" | "WhatsApp" | "Call";

const conversations = [
  { id: 1, customer: "Sarah Mitchell", channel: "WhatsApp" as Channel, vehicle: "Tesla Model 3", lastMsg: "Sure, I can come in at 10 AM for the test drive.", time: "2 min ago", unread: true },
  { id: 2, customer: "Michael Brown", channel: "Email" as Channel, vehicle: "Mercedes C300", lastMsg: "RE: Title transfer documents — Please see attached...", time: "30 min ago", unread: false },
  { id: 3, customer: "Robert Chen", channel: "Call" as Channel, vehicle: "Audi A4", lastMsg: "Call duration: 4 min 32s", time: "1 hr ago", unread: false },
  { id: 4, customer: "Chris Johnson", channel: "SMS" as Channel, vehicle: "Ford F-150", lastMsg: "Is the truck still available?", time: "2 hrs ago", unread: true },
  { id: 5, customer: "Tony Ramirez", channel: "Email" as Channel, vehicle: "Nissan Altima", lastMsg: "RE: Payment schedule — Thank you for the updated EMI plan.", time: "3 hrs ago", unread: false },
  { id: 6, customer: "Lisa Park", channel: "WhatsApp" as Channel, vehicle: "Toyota RAV4", lastMsg: "Can you send me more photos of the car?", time: "5 hrs ago", unread: true },
];

const channelIcons: Record<string, typeof Mail> = { Email: Mail, SMS: Phone, WhatsApp: MessageCircle, Call: PhoneCall };
const channelColors: Record<string, string> = { Email: "bg-blue-100 text-blue-700", SMS: "bg-violet-100 text-violet-700", WhatsApp: "bg-emerald-100 text-emerald-700", Call: "bg-amber-100 text-amber-700" };

const chatMessages = [
  { from: "Sarah Mitchell", role: "customer", text: "Hi! I saw the Tesla Model 3 listing. Is it still available?", time: "9:30 AM" },
  { from: "You", role: "agent", text: "Hi Sarah! Yes, the 2024 Tesla Model 3 Long Range is available. Would you like to schedule a test drive?", time: "9:35 AM" },
  { from: "Sarah Mitchell", role: "customer", text: "That would be great! What times are available this week?", time: "9:40 AM" },
  { from: "You", role: "agent", text: "We have slots available on Monday at 10 AM and Wednesday at 2 PM. Which works better for you?", time: "9:45 AM" },
  { from: "Sarah Mitchell", role: "customer", text: "Sure, I can come in at 10 AM for the test drive.", time: "9:50 AM" },
];

export default function Communication() {
  const [channel, setChannel] = useState<Channel>("All");
  const [selected, setSelected] = useState(1);
  const [search, setSearch] = useState("");

  const filtered = conversations.filter(
    (c) => (channel === "All" || c.channel === channel) && c.customer.toLowerCase().includes(search.toLowerCase())
  );
  const detail = conversations.find((c) => c.id === selected);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Communication Center</h1>
          <p className="text-muted-foreground text-sm">Unified messaging across all channels</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["All", "Email", "SMS", "WhatsApp", "Call"] as Channel[]).map((c) => (
          <button key={c} onClick={() => setChannel(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${channel === c ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>{c}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
        {/* Conversation List */}
        <div className="stat-card flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="bg-transparent text-sm outline-none w-full" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.map((c) => {
              const Icon = channelIcons[c.channel];
              return (
                <div key={c.id} onClick={() => setSelected(c.id)} className={`p-3 rounded-lg cursor-pointer transition-colors ${selected === c.id ? "bg-primary/5 border border-primary/20" : "hover:bg-muted"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.customer}</span>
                      {c.unread && <span className="h-2 w-2 bg-primary rounded-full" />}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${channelColors[c.channel]}`}><Icon className="h-3 w-3 inline" /></span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.lastMsg}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Car className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{c.vehicle}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{c.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat View */}
        <div className="lg:col-span-2 stat-card flex flex-col overflow-hidden">
          {detail ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>
                  <div>
                    <p className="font-medium">{detail.customer}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded ${channelColors[detail.channel]}`}>{detail.channel}</span>
                      <Car className="h-3 w-3" /> {detail.vehicle}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 hover:bg-muted rounded-lg"><Phone className="h-4 w-4" /></button>
                  <button className="p-2 hover:bg-muted rounded-lg"><Mail className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "agent" ? "flex-row-reverse" : ""}`}>
                    <div className={`max-w-[70%] ${m.role === "agent" ? "text-right" : ""}`}>
                      <div className={`p-3 rounded-xl text-sm ${m.role === "agent" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>{m.text}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 flex gap-2">
                <input placeholder="Type a message..." className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background" />
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">Send</button>
              </div>
            </>
          ) : <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation</div>}
        </div>
      </div>
    </div>
  );
}
