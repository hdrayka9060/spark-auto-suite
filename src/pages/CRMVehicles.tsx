import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Search, ArrowUpDown, Users, UserCheck, TrendingUp, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { vehicles } from "@/data/vehicles";
import { sellers } from "@/data/sellers";
import { buyers } from "@/data/buyers";

type SortKey = "title" | "price" | "year" | "km" | "views" | "inquiries";

export default function CRMVehicles() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hostingFilter, setHostingFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const enriched = useMemo(() => {
    return vehicles.map((v) => {
      const seller = sellers.find((s) => s.vehiclesListed.includes(v.id));
      const interested = buyers.filter((b) => b.interestedVehicles.includes(v.id));
      const buyer = buyers.find((b) => b.purchases.includes(v.id));
      return { ...v, seller, interested, buyer };
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = enriched.filter((v) => {
      const match =
        !q ||
        v.title.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q) ||
        v.company.toLowerCase().includes(q) ||
        v.seller?.name.toLowerCase().includes(q) ||
        v.buyer?.name.toLowerCase().includes(q);
      const sOk = statusFilter === "all" || v.status === statusFilter;
      const hOk = hostingFilter === "all" || v.hosting === hostingFilter;
      return match && sOk && hOk;
    });
    list = [...list].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "price": return (a.price - b.price) * dir;
        case "year": return (a.year - b.year) * dir;
        case "km": return (a.km - b.km) * dir;
        case "views": return (a.activity.views - b.activity.views) * dir;
        case "inquiries": return (a.activity.inquiries - b.activity.inquiries) * dir;
        default: return a.title.localeCompare(b.title) * dir;
      }
    });
    return list;
  }, [enriched, search, statusFilter, hostingFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const totalValue = filtered.reduce((s, v) => s + v.price, 0);
  const totalInquiries = filtered.reduce((s, v) => s + v.activity.inquiries, 0);
  const withSeller = filtered.filter((v) => v.seller).length;
  const withBuyer = filtered.filter((v) => v.buyer).length;

  const statusVariant = (s: string) =>
    s === "Sold" ? "default" : s === "Pending" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Vehicle CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage every vehicle with seller, buyer, and engagement context in one place.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Vehicles", value: filtered.length, icon: Car },
          { label: "Inventory Value", value: `$${(totalValue / 1000).toFixed(0)}k`, icon: DollarSign },
          { label: "With Active Seller", value: withSeller, icon: Users },
          { label: "Engaged Buyers", value: withBuyer + filtered.reduce((s, v) => s + v.interested.length, 0), icon: UserCheck },
        ].map((k) => (
          <div key={k.label} className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-2">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by vehicle, VIN, seller or buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Unsold">Unsold</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Sold">Sold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={hostingFilter} onValueChange={setHostingFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Hosting" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Hosting</SelectItem>
            <SelectItem value="Self">Self</SelectItem>
            <SelectItem value="Platform">Platform</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button onClick={() => toggleSort("title")} className="flex items-center gap-1 hover:text-foreground">
                  Vehicle <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>VIN / ID</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("year")} className="flex items-center gap-1 hover:text-foreground">
                  Year / KM <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort("price")} className="flex items-center gap-1 hover:text-foreground">
                  Price <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Buyer / Interest</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("views")} className="flex items-center gap-1 hover:text-foreground">
                  Engagement <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow
                key={v.id}
                onClick={() => navigate(`/inventory/${v.id}`)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{v.image}</div>
                    <div>
                      <p className="font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground">{v.company} · {v.bodyType}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  <p className="font-mono">{v.id}</p>
                  <p className="text-muted-foreground font-mono">{v.vin.slice(-8)}</p>
                </TableCell>
                <TableCell className="text-sm">
                  <p>{v.year}</p>
                  <p className="text-xs text-muted-foreground">{v.km.toLocaleString()} km</p>
                </TableCell>
                <TableCell>
                  <p className="font-semibold">${v.price.toLocaleString()}</p>
                  {v.discount > 0 && (
                    <p className="text-xs text-emerald-600">-${v.discount.toLocaleString()}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{v.hosting}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {v.seller ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/crm-sellers/${v.seller!.id}`); }}
                      className="text-left hover:text-primary"
                    >
                      <p className="font-medium">{v.seller.name}</p>
                      <p className="text-xs text-muted-foreground">{v.seller.location}</p>
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {v.buyer ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/crm-buyers/${v.buyer!.id}`); }}
                      className="text-left hover:text-primary"
                    >
                      <p className="font-medium">{v.buyer.name}</p>
                      <p className="text-xs text-emerald-600">Purchased</p>
                    </button>
                  ) : v.interested.length > 0 ? (
                    <div>
                      <p className="font-medium">{v.interested.length} interested</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {v.interested.map((b) => b.name.split(" ")[0]).join(", ")}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      {v.activity.views}
                    </span>
                    <span className="text-muted-foreground">{v.activity.inquiries} inq</span>
                    <span className="text-muted-foreground">{v.activity.testDrives} TD</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No vehicles match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}