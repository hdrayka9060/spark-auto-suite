import { useState } from "react";
import { Plus, Upload, Search, Filter, Eye, Edit, Trash2, Image } from "lucide-react";

const vehicles = [
  { id: "V-001", title: "2024 BMW X5 xDrive40i", company: "BMW", model: "X5", year: 2024, km: 1200, price: 65000, discount: 0, owners: 0, status: "Unsold", hosting: "Self", image: "🚙" },
  { id: "V-002", title: "2023 Mercedes-Benz C300", company: "Mercedes", model: "C300", year: 2023, km: 15400, price: 42500, discount: 2000, owners: 1, status: "Sold", hosting: "Platform", image: "🚗" },
  { id: "V-003", title: "2024 Tesla Model 3 LR", company: "Tesla", model: "Model 3", year: 2024, km: 800, price: 48900, discount: 0, owners: 0, status: "Unsold", hosting: "Self", image: "⚡" },
  { id: "V-004", title: "2022 Ford F-150 Lariat", company: "Ford", model: "F-150", year: 2022, km: 32100, price: 52000, discount: 3000, owners: 1, status: "Pending", hosting: "Platform", image: "🛻" },
  { id: "V-005", title: "2023 Audi Q7 Premium", company: "Audi", model: "Q7", year: 2023, km: 12300, price: 58500, discount: 1500, owners: 1, status: "Unsold", hosting: "Self", image: "🚙" },
  { id: "V-006", title: "2024 Chevrolet Tahoe LT", company: "Chevrolet", model: "Tahoe", year: 2024, km: 5600, price: 61000, discount: 0, owners: 0, status: "Sold", hosting: "Platform", image: "🚙" },
  { id: "V-007", title: "2023 Toyota Camry SE", company: "Toyota", model: "Camry", year: 2023, km: 18900, price: 28500, discount: 500, owners: 1, status: "Unsold", hosting: "Self", image: "🚗" },
  { id: "V-008", title: "2022 Honda Accord Sport", company: "Honda", model: "Accord", year: 2022, km: 27400, price: 31200, discount: 1000, owners: 2, status: "Pending", hosting: "Self", image: "🚗" },
];

const statusClass: Record<string, string> = {
  Sold: "sold",
  Pending: "pending",
  Unsold: "unsold",
};

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = vehicles.filter(
    (v) =>
      (statusFilter === "All" || v.status === statusFilter) &&
      (v.title.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Inventory Management</h1>
          <p className="text-muted-foreground text-sm">{vehicles.length} vehicles in inventory</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            <Upload className="h-4 w-4" /> Bulk CSV
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Add Vehicle Form */}
      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Add New Vehicle</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <input placeholder="Vehicle Title" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Company" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Model" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Year" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="KM Driven" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Price ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Owner Count" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option>Self Hosted</option>
              <option>Platform</option>
            </select>
          </div>
          <textarea placeholder="Description" className="border rounded-lg px-3 py-2 text-sm bg-background w-full" rows={2} />
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
            <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Drop images here or click to upload (multiple)
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Save Vehicle</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ID..."
            className="bg-transparent text-sm outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {["All", "Unsold", "Pending", "Sold"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th></th>
              <th>Vehicle</th>
              <th>Year</th>
              <th>KM</th>
              <th>Price</th>
              <th>Owners</th>
              <th>Status</th>
              <th>Hosting</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id}>
                <td className="font-mono text-xs">{v.id}</td>
                <td className="text-2xl">{v.image}</td>
                <td className="font-medium">{v.title}</td>
                <td>{v.year}</td>
                <td>{v.km.toLocaleString()}</td>
                <td className="font-medium">${v.price.toLocaleString()}{v.discount > 0 && <span className="text-xs text-emerald-600 ml-1">-${v.discount.toLocaleString()}</span>}</td>
                <td>{v.owners}</td>
                <td><span className={`status-badge ${statusClass[v.status]}`}>{v.status}</span></td>
                <td className="text-xs text-muted-foreground">{v.hosting}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
