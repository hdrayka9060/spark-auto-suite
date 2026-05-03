export type Seller = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  status: "Active" | "Inactive" | "VIP";
  vehiclesListed: string[]; // vehicle IDs
  activeLeads: number;
  joinedDate: string;
  stage: "New" | "Contacted" | "Inspection" | "Negotiation" | "Sold" | "Rejected";
  traffic: number;
  activity: { date: string; type: string; detail: string }[];
};

export const sellers: Seller[] = [
  {
    id: "S-001", name: "Robert Chen", email: "robert@email.com", phone: "555-0101",
    location: "San Francisco, CA", status: "VIP", vehiclesListed: ["V-001", "V-005"],
    activeLeads: 6, joinedDate: "2025-08-12", stage: "Inspection", traffic: 142,
    activity: [
      { date: "2026-04-28", type: "Lead", detail: "New inquiry on V-001 from Robert M." },
      { date: "2026-04-25", type: "Upload", detail: "Listed 2023 Audi Q7 Premium" },
      { date: "2026-04-20", type: "Update", detail: "Updated pricing on BMW X5" },
      { date: "2026-04-15", type: "Inspection", detail: "Inspection scheduled at lot A" },
    ],
  },
  {
    id: "S-002", name: "Lisa Park", email: "lisa@email.com", phone: "555-0102",
    location: "Austin, TX", status: "Active", vehiclesListed: ["V-007"],
    activeLeads: 2, joinedDate: "2026-01-04", stage: "New", traffic: 0,
    activity: [
      { date: "2026-04-29", type: "Upload", detail: "Listed 2023 Toyota Camry SE" },
      { date: "2026-04-29", type: "Account", detail: "Account created" },
    ],
  },
  {
    id: "S-003", name: "David Martinez", email: "david@email.com", phone: "555-0103",
    location: "Miami, FL", status: "Active", vehiclesListed: ["V-002", "V-008"],
    activeLeads: 4, joinedDate: "2025-11-20", stage: "Negotiation", traffic: 89,
    activity: [
      { date: "2026-04-22", type: "Negotiation", detail: "Buyer offered $40,500 on C300" },
      { date: "2026-04-10", type: "Sale", detail: "Sold 2023 Mercedes C300" },
    ],
  },
  {
    id: "S-004", name: "Emily Walsh", email: "emily@email.com", phone: "555-0104",
    location: "Seattle, WA", status: "Active", vehiclesListed: ["V-004"],
    activeLeads: 3, joinedDate: "2025-09-15", stage: "Contacted", traffic: 56,
    activity: [
      { date: "2026-04-25", type: "Reservation", detail: "Reservation deposit received" },
      { date: "2026-04-18", type: "Upload", detail: "Listed Ford F-150 Lariat" },
    ],
  },
  {
    id: "S-005", name: "James Kim", email: "james@email.com", phone: "555-0105",
    location: "Denver, CO", status: "VIP", vehiclesListed: ["V-006"],
    activeLeads: 0, joinedDate: "2025-05-01", stage: "Sold", traffic: 310,
    activity: [
      { date: "2026-04-05", type: "Sale", detail: "Sold Chevrolet Tahoe to Family Buyer" },
    ],
  },
  {
    id: "S-006", name: "Maria Garcia", email: "maria@email.com", phone: "555-0106",
    location: "Phoenix, AZ", status: "Inactive", vehiclesListed: ["V-003"],
    activeLeads: 1, joinedDate: "2025-12-08", stage: "Rejected", traffic: 45,
    activity: [
      { date: "2026-04-15", type: "Listing", detail: "Listing flagged for review" },
    ],
  },
];

export const getSellerById = (id: string) => sellers.find((s) => s.id === id);
