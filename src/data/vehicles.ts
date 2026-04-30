export type Vehicle = {
  id: string;
  title: string;
  company: string;
  model: string;
  year: number;
  km: number;
  price: number;
  discount: number;
  owners: number;
  status: "Sold" | "Pending" | "Unsold";
  hosting: "Self" | "Platform";
  image: string;
  description: string;
  vin: string;
  color: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  gallery: string[];
  history: { date: string; event: string; detail: string }[];
  activity: { views: number; inquiries: number; testDrives: number; favorites: number };
  logs: { date: string; type: string; description: string }[];
};

export const vehicles: Vehicle[] = [
  {
    id: "V-001", title: "2024 BMW X5 xDrive40i", company: "BMW", model: "X5", year: 2024, km: 1200,
    price: 65000, discount: 0, owners: 0, status: "Unsold", hosting: "Self", image: "🚙",
    description: "Pristine 2024 BMW X5 xDrive40i with the M Sport package. Loaded with premium features including panoramic sunroof, Harman Kardon sound system, heated seats, and adaptive cruise control. Single owner, dealer maintained.",
    vin: "5UXCR6C09P9N12345", color: "Alpine White", fuel: "Petrol", transmission: "8-Speed Automatic", bodyType: "SUV",
    gallery: ["🚙", "🚗", "🛣️", "🏁"],
    history: [
      { date: "2024-01-15", event: "Manufactured", detail: "Built at BMW Spartanburg Plant" },
      { date: "2024-02-20", event: "Delivered to Dealer", detail: "Received at AutoDealer Lot A" },
      { date: "2024-03-05", event: "Listed for Sale", detail: "Added to inventory by John Dealer" },
    ],
    activity: { views: 1247, inquiries: 38, testDrives: 12, favorites: 89 },
    logs: [
      { date: "2026-04-28", type: "Inquiry", description: "Email inquiry from Robert M." },
      { date: "2026-04-26", type: "Test Drive", description: "Scheduled with Sarah K." },
      { date: "2026-04-22", type: "Price Update", description: "No change — market reviewed" },
      { date: "2026-04-18", type: "Photo Update", description: "Added 3 new gallery images" },
    ],
  },
  {
    id: "V-002", title: "2023 Mercedes-Benz C300", company: "Mercedes", model: "C300", year: 2023, km: 15400,
    price: 42500, discount: 2000, owners: 1, status: "Sold", hosting: "Platform", image: "🚗",
    description: "Elegant 2023 Mercedes-Benz C300 with AMG line exterior. Premium leather interior, MBUX infotainment, and excellent service history.",
    vin: "W1KAF4HB2PR123456", color: "Obsidian Black", fuel: "Petrol", transmission: "9G-TRONIC", bodyType: "Sedan",
    gallery: ["🚗", "🚙", "🏎️", "🛣️"],
    history: [
      { date: "2023-05-10", event: "First Registered", detail: "Original owner in California" },
      { date: "2026-01-12", event: "Trade-In", detail: "Acquired via trade-in" },
      { date: "2026-04-10", event: "Sold", detail: "Sold to Michael T." },
    ],
    activity: { views: 892, inquiries: 24, testDrives: 8, favorites: 41 },
    logs: [{ date: "2026-04-10", type: "Sale Closed", description: "Final paperwork signed" }],
  },
  {
    id: "V-003", title: "2024 Tesla Model 3 LR", company: "Tesla", model: "Model 3", year: 2024, km: 800,
    price: 48900, discount: 0, owners: 0, status: "Unsold", hosting: "Self", image: "⚡",
    description: "Brand new 2024 Tesla Model 3 Long Range. Dual motor AWD, autopilot included, premium interior, and full self-driving capability ready.",
    vin: "5YJ3E1EA8PF123456", color: "Pearl White", fuel: "Electric", transmission: "Single-Speed", bodyType: "Sedan",
    gallery: ["⚡", "🚗", "🔋", "🏎️"],
    history: [
      { date: "2024-02-01", event: "Manufactured", detail: "Tesla Fremont Factory" },
      { date: "2024-03-15", event: "Listed for Sale", detail: "Added to inventory" },
    ],
    activity: { views: 2103, inquiries: 67, testDrives: 19, favorites: 142 },
    logs: [
      { date: "2026-04-29", type: "Inquiry", description: "WhatsApp inquiry from Priya S." },
      { date: "2026-04-27", type: "View Spike", description: "Featured on homepage" },
    ],
  },
  {
    id: "V-004", title: "2022 Ford F-150 Lariat", company: "Ford", model: "F-150", year: 2022, km: 32100,
    price: 52000, discount: 3000, owners: 1, status: "Pending", hosting: "Platform", image: "🛻",
    description: "Powerful 2022 Ford F-150 Lariat 4x4 with 3.5L EcoBoost V6. Tow package, leather seats, SYNC 4 infotainment, and well maintained.",
    vin: "1FTFW1E83NFA12345", color: "Race Red", fuel: "Petrol", transmission: "10-Speed Automatic", bodyType: "Pickup Truck",
    gallery: ["🛻", "🚚", "🏔️", "🛣️"],
    history: [
      { date: "2022-08-15", event: "First Registered", detail: "Texas owner" },
      { date: "2026-02-20", event: "Acquired", detail: "Purchased from auction" },
      { date: "2026-04-25", event: "Pending Sale", detail: "Reservation deposit received" },
    ],
    activity: { views: 654, inquiries: 19, testDrives: 6, favorites: 33 },
    logs: [{ date: "2026-04-25", type: "Reservation", description: "Deposit from David W." }],
  },
  {
    id: "V-005", title: "2023 Audi Q7 Premium", company: "Audi", model: "Q7", year: 2023, km: 12300,
    price: 58500, discount: 1500, owners: 1, status: "Unsold", hosting: "Self", image: "🚙",
    description: "2023 Audi Q7 Premium Plus with quattro AWD. Three-row seating, virtual cockpit, Bang & Olufsen sound system.",
    vin: "WA1LXAF74PD123456", color: "Glacier White", fuel: "Petrol", transmission: "8-Speed Tiptronic", bodyType: "SUV",
    gallery: ["🚙", "🚗", "🛣️"],
    history: [
      { date: "2023-06-20", event: "First Registered", detail: "Florida owner" },
      { date: "2026-03-12", event: "Acquired", detail: "Trade-in" },
    ],
    activity: { views: 543, inquiries: 14, testDrives: 4, favorites: 27 },
    logs: [{ date: "2026-04-20", type: "Inquiry", description: "Phone inquiry from Anna L." }],
  },
  {
    id: "V-006", title: "2024 Chevrolet Tahoe LT", company: "Chevrolet", model: "Tahoe", year: 2024, km: 5600,
    price: 61000, discount: 0, owners: 0, status: "Sold", hosting: "Platform", image: "🚙",
    description: "Spacious 2024 Chevrolet Tahoe LT 4WD. Eight-passenger seating, advanced safety suite.",
    vin: "1GNSKNKD2RR123456", color: "Black", fuel: "Petrol", transmission: "10-Speed Automatic", bodyType: "Full-Size SUV",
    gallery: ["🚙", "🛻", "🛣️"],
    history: [
      { date: "2024-01-10", event: "Manufactured", detail: "GM Arlington Assembly" },
      { date: "2026-04-05", event: "Sold", detail: "Sold to Family Buyer" },
    ],
    activity: { views: 712, inquiries: 21, testDrives: 7, favorites: 35 },
    logs: [{ date: "2026-04-05", type: "Sale Closed", description: "Delivered to customer" }],
  },
  {
    id: "V-007", title: "2023 Toyota Camry SE", company: "Toyota", model: "Camry", year: 2023, km: 18900,
    price: 28500, discount: 500, owners: 1, status: "Unsold", hosting: "Self", image: "🚗",
    description: "Reliable 2023 Toyota Camry SE. Sport-tuned suspension, Apple CarPlay, Toyota Safety Sense.",
    vin: "4T1G11AK4PU123456", color: "Celestial Silver", fuel: "Petrol", transmission: "8-Speed Automatic", bodyType: "Sedan",
    gallery: ["🚗", "🛣️"],
    history: [
      { date: "2023-04-12", event: "First Registered", detail: "Original owner" },
      { date: "2026-03-30", event: "Acquired", detail: "Trade-in" },
    ],
    activity: { views: 489, inquiries: 11, testDrives: 3, favorites: 18 },
    logs: [{ date: "2026-04-15", type: "Inquiry", description: "Online form submission" }],
  },
  {
    id: "V-008", title: "2022 Honda Accord Sport", company: "Honda", model: "Accord", year: 2022, km: 27400,
    price: 31200, discount: 1000, owners: 2, status: "Pending", hosting: "Self", image: "🚗",
    description: "2022 Honda Accord Sport 1.5T. Sleek design, fuel efficient, Honda Sensing safety suite.",
    vin: "1HGCV1F37NA123456", color: "Modern Steel", fuel: "Petrol", transmission: "CVT", bodyType: "Sedan",
    gallery: ["🚗", "🛣️"],
    history: [
      { date: "2022-09-01", event: "First Registered", detail: "Original owner" },
      { date: "2024-11-10", event: "Second Owner", detail: "Resold" },
      { date: "2026-04-01", event: "Acquired", detail: "Trade-in" },
    ],
    activity: { views: 398, inquiries: 9, testDrives: 2, favorites: 15 },
    logs: [{ date: "2026-04-22", type: "Reservation", description: "Pending finance approval" }],
  },
];

export const getVehicleById = (id: string) => vehicles.find((v) => v.id === id);