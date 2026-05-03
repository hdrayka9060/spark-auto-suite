import { useState } from "react";
import { Shield, Plus, Check } from "lucide-react";
import { roles, allModules, type Permission, type Role } from "@/data/staff";

const allPerms: Permission[] = ["view", "edit", "delete"];

export default function RolesPermissions() {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0].id);
  const [showAdd, setShowAdd] = useState(false);
  const role: Role | undefined = roles.find((r) => r.id === selectedRoleId);

  const hasPerm = (module: string, perm: Permission) =>
    role?.modules.find((m) => m.module === module)?.permissions.includes(perm) ?? false;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">Define roles and control module access</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Role
        </button>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Create Role</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Role Name" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Description" className="border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Create</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Roles list */}
        <div className="stat-card lg:col-span-1 space-y-2">
          <h3 className="font-display font-semibold mb-2 text-sm uppercase text-muted-foreground tracking-wide">Roles</h3>
          {roles.map((r) => (
            <button key={r.id} onClick={() => setSelectedRoleId(r.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedRoleId === r.id ? "bg-primary/5 border-primary" : "border-transparent hover:bg-muted"}`}>
              <div className="flex items-center gap-2">
                <Shield className={`h-4 w-4 ${selectedRoleId === r.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-medium text-sm">{r.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.staffCount} staff · {r.modules.length} modules</p>
            </button>
          ))}
        </div>

        {/* Permission Matrix */}
        <div className="stat-card lg:col-span-3">
          {role && (
            <>
              <div className="mb-4">
                <h3 className="font-display font-semibold text-lg">{role.name}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {allPerms.map((p) => (
                        <th key={p} className="text-center capitalize">{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allModules.map((m) => (
                      <tr key={m}>
                        <td className="font-medium text-sm">{m}</td>
                        {allPerms.map((p) => (
                          <td key={p} className="text-center">
                            <input type="checkbox" defaultChecked={hasPerm(m, p)} className="h-4 w-4 accent-primary" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <Check className="h-4 w-4" /> Save Permissions
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
