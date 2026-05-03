export type Lead = {
  id: string;
  buyerId: string;
  buyerName: string;
  vehicleId: string;
  vehicleTitle: string;
  source: "Website" | "Google Ads" | "Meta Ads" | "Referral" | "Walk-in";
  status: "New" | "Contacted" | "Test Drive" | "Negotiation" | "Closed";
  assignedTo: string;
  createdAt: string;
  notes: string;
  timeline: { date: string; action: string; by: string }[];
  log: { date: string; channel: "Call" | "Email" | "WhatsApp" | "SMS"; summary: string }[];
};

export const staffNames = ["Alex Rivera", "Priya Singh", "Tom Becker", "Nina Costa", "Jordan Hayes"];

export const leads: Lead[] = [
  {
    id: "L-1001", buyerId: "B-001", buyerName: "Sarah Mitchell",
    vehicleId: "V-003", vehicleTitle: "2024 Tesla Model 3 LR",
    source: "Website", status: "Test Drive", assignedTo: "Alex Rivera",
    createdAt: "2026-04-25", notes: "Very interested in autopilot upgrade",
    timeline: [
      { date: "2026-04-30", action: "Test drive scheduled", by: "Alex Rivera" },
      { date: "2026-04-27", action: "Status moved to Contacted", by: "Alex Rivera" },
      { date: "2026-04-25", action: "Lead created from website form", by: "System" },
    ],
    log: [
      { date: "2026-04-29", channel: "WhatsApp", summary: "Sent vehicle brochure" },
      { date: "2026-04-27", channel: "Call", summary: "10 min discovery call" },
    ],
  },
  {
    id: "L-1002", buyerId: "B-004", buyerName: "Chris Johnson",
    vehicleId: "V-004", vehicleTitle: "2022 Ford F-150 Lariat",
    source: "Google Ads", status: "Negotiation", assignedTo: "Priya Singh",
    createdAt: "2026-04-18", notes: "Wants $2k off, pre-approved financing",
    timeline: [
      { date: "2026-04-28", action: "Counter-offer sent: $50,500", by: "Priya Singh" },
      { date: "2026-04-22", action: "Test drive completed", by: "Priya Singh" },
    ],
    log: [{ date: "2026-04-26", channel: "SMS", summary: "Confirmed appointment" }],
  },
  {
    id: "L-1003", buyerId: "B-003", buyerName: "Jennifer Lee",
    vehicleId: "V-005", vehicleTitle: "2023 Audi Q7 Premium",
    source: "Meta Ads", status: "Contacted", assignedTo: "Tom Becker",
    createdAt: "2026-04-20", notes: "Comparing with Lexus RX",
    timeline: [{ date: "2026-04-21", action: "Initial email sent", by: "Tom Becker" }],
    log: [{ date: "2026-04-20", channel: "Email", summary: "Welcome email + brochure" }],
  },
  {
    id: "L-1004", buyerId: "B-002", buyerName: "Michael Brown",
    vehicleId: "V-002", vehicleTitle: "2023 Mercedes-Benz C300",
    source: "Referral", status: "Closed", assignedTo: "Nina Costa",
    createdAt: "2026-03-15", notes: "Sale closed at $40,500",
    timeline: [
      { date: "2026-04-10", action: "Sale closed", by: "Nina Costa" },
      { date: "2026-03-28", action: "Test drive completed", by: "Nina Costa" },
    ],
    log: [{ date: "2026-04-10", channel: "Email", summary: "Final paperwork sent" }],
  },
  {
    id: "L-1005", buyerId: "B-005", buyerName: "Amanda Taylor",
    vehicleId: "V-007", vehicleTitle: "2023 Toyota Camry SE",
    source: "Walk-in", status: "New", assignedTo: "Jordan Hayes",
    createdAt: "2026-04-29", notes: "First-time buyer",
    timeline: [{ date: "2026-04-29", action: "Lead created", by: "System" }],
    log: [],
  },
  {
    id: "L-1006", buyerId: "B-001", buyerName: "Sarah Mitchell",
    vehicleId: "V-001", vehicleTitle: "2024 BMW X5 xDrive40i",
    source: "Website", status: "Contacted", assignedTo: "Alex Rivera",
    createdAt: "2026-04-22", notes: "Cross-shopping with Tesla",
    timeline: [{ date: "2026-04-23", action: "Reached out via email", by: "Alex Rivera" }],
    log: [{ date: "2026-04-23", channel: "Email", summary: "Sent comparison sheet" }],
  },
];

export const getLeadById = (id: string) => leads.find((l) => l.id === id);
