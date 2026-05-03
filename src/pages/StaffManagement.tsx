import { useState } from "react";
import { Plus, Upload, Search, Mail, Phone } from "lucide-react";
import { staff, roles, getRoleById } from "@/data/staff";

const statusColors: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Invited: "bg-amber-100 text-amber-700",
  Suspended: "bg-red-100 text-red-700",
};

export default function StaffManagement() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [roleFilter, setRoleFilter] = useState("All");

  const filtered = staff.filter(
    (s) =>
      (roleFilter === "All" || s.roleId === roleFilter) &&
      (s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Staff Management</h1>
          <p className="text-muted-foreground text-sm">{staff.length} team members</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"><Upload className="h-4 w-4" /> Bulk Upload</button>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Staff
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Invite Staff Member</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Full Name" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Email" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Phone" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-background">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Send Invite</button>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRoleFilter("All")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${roleFilter === "All" ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>All</button>
          {roles.map((r) => (
            <button key={r.id} onClick={() => setRoleFilter(r.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${roleFilter === r.id ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>{r.name}</button>
          ))}
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Joined</th><th>Last Active</th></tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const role = getRoleById(s.roleId);
              return (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {s.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm">
                    <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" /> {s.email}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {s.phone}</p>
                  </td>
                  <td><span className="status-badge bg-blue-50 text-blue-700">{role?.name}</span></td>
                  <td><span className={`status-badge ${statusColors[s.status]}`}>{s.status}</span></td>
                  <td className="text-xs text-muted-foreground">{s.joinedDate}</td>
                  <td className="text-xs text-muted-foreground">{s.lastActive}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
