import { useEffect, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buyers } from "@/data/buyers";

const statusColors: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  Converted: "bg-emerald-100 text-emerald-700",
  Dropped: "bg-gray-100 text-gray-600",
};

const filters = ["All", "Active", "Converted", "Dropped"];

export default function CRMBuyers() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: string } | null) ?? null;
  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "All");

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter } }, "");
  }, [search, statusFilter]);

  const filtered = buyers.filter(
    (b) => (statusFilter === "All" || b.status === statusFilter) && b.name.toLowerCase().includes(search.toLowerCase())
  );

  const open = (id: string) => navigate(`/crm-buyers/${id}`, { state: { search, statusFilter } });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Buyers</h1>
          <p className="text-muted-foreground text-sm">Customers looking to buy vehicles</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
            {s} {s !== "All" && <span className="ml-1 opacity-70">({buyers.filter((x) => x.status === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyers..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Buyer Name</th>
              <th>Contact</th>
              <th>Interested Vehicles</th>
              <th>Bookings</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} onClick={() => open(b.id)} className="cursor-pointer">
                <td className="font-medium">{b.name}</td>
                <td className="text-sm">
                  <p>{b.email}</p>
                  <p className="text-xs text-muted-foreground">{b.phone}</p>
                </td>
                <td className="text-sm">{b.interestedVehicles.length}</td>
                <td className="text-sm">{b.bookings}</td>
                <td><span className={`status-badge ${statusColors[b.status]}`}>{b.status}</span></td>
                <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
