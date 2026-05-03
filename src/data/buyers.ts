export type Buyer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "Active" | "Converted" | "Dropped";
  interestedVehicles: string[]; // vehicle IDs
  bookings: number;
  purchases: string[];
  testDrives: { vehicleId: string; date: string; status: "Scheduled" | "Completed" | "Cancelled" }[];
  viewed: string[];
  communications: { date: string; channel: "Call" | "Email" | "WhatsApp" | "SMS"; summary: string }[];
};

export const buyers: Buyer[] = [
  {
    id: "B-001", name: "Sarah Mitchell", email: "sarah@email.com", phone: "555-0201",
    status: "Active", interestedVehicles: ["V-003", "V-001"], bookings: 1, purchases: [],
    testDrives: [{ vehicleId: "V-003", date: "2026-03-30", status: "Scheduled" }],
    viewed: ["V-003", "V-001", "V-005"],
    communications: [
      { date: "2026-04-29", channel: "WhatsApp", summary: "Asked about Tesla autopilot package" },
      { date: "2026-04-27", channel: "Call", summary: "10 min – discussed financing" },
    ],
  },
  {
    id: "B-002", name: "Michael Brown", email: "mike@email.com", phone: "555-0202",
    status: "Converted", interestedVehicles: ["V-002"], bookings: 1, purchases: ["V-002"],
    testDrives: [{ vehicleId: "V-002", date: "2026-03-28", status: "Completed" }],
    viewed: ["V-002", "V-001"],
    communications: [
      { date: "2026-04-10", channel: "Email", summary: "Sent purchase agreement" },
      { date: "2026-03-28", channel: "Call", summary: "Test drive feedback – very interested" },
    ],
  },
  {
    id: "B-003", name: "Jennifer Lee", email: "jen@email.com", phone: "555-0203",
    status: "Active", interestedVehicles: ["V-005"], bookings: 0, purchases: [],
    testDrives: [], viewed: ["V-005", "V-001"],
    communications: [{ date: "2026-04-20", channel: "Email", summary: "Inquired about Audi Q7 features" }],
  },
  {
    id: "B-004", name: "Chris Johnson", email: "chris@email.com", phone: "555-0204",
    status: "Active", interestedVehicles: ["V-004"], bookings: 1, purchases: [],
    testDrives: [{ vehicleId: "V-004", date: "2026-03-31", status: "Scheduled" }],
    viewed: ["V-004", "V-006"],
    communications: [{ date: "2026-04-26", channel: "SMS", summary: "Confirmed test drive appointment" }],
  },
  {
    id: "B-005", name: "Amanda Taylor", email: "amanda@email.com", phone: "555-0205",
    status: "Dropped", interestedVehicles: ["V-007"], bookings: 1, purchases: [],
    testDrives: [{ vehicleId: "V-007", date: "2026-03-25", status: "Completed" }],
    viewed: ["V-007"],
    communications: [
      { date: "2026-04-02", channel: "Call", summary: "Decided not to proceed – budget" },
      { date: "2026-03-25", channel: "WhatsApp", summary: "Test drive completed" },
    ],
  },
];

export const getBuyerById = (id: string) => buyers.find((b) => b.id === id);
