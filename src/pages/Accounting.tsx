import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stats = [
  { label: "Total Sales", value: "$2.4M", icon: DollarSign, color: "bg-primary/10 text-primary" },
  { label: "Revenue", value: "$1.8M", icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
  { label: "Profit", value: "$680K", icon: TrendingUp, color: "bg-amber-50 text-amber-600" },
  { label: "Outstanding", value: "$124K", icon: AlertCircle, color: "bg-red-50 text-red-600" },
];

const plData = [
  { month: "Jan", revenue: 180, expenses: 135, profit: 45 },
  { month: "Feb", revenue: 220, expenses: 158, profit: 62 },
  { month: "Mar", revenue: 195, expenses: 144, profit: 51 },
  { month: "Apr", revenue: 310, expenses: 222, profit: 88 },
  { month: "May", revenue: 280, expenses: 204, profit: 76 },
  { month: "Jun", revenue: 350, expenses: 248, profit: 102 },
];

const salesLedger = [
  { id: "INV-001", vehicle: "2023 Mercedes C300", buyer: "Michael Brown", amount: 42500, date: "2026-03-28", status: "Paid" },
  { id: "INV-002", vehicle: "2024 Chevrolet Tahoe", buyer: "Karen White", amount: 61000, date: "2026-03-25", status: "Paid" },
  { id: "INV-003", vehicle: "2022 Ford F-150", buyer: "Chris Johnson", amount: 49000, date: "2026-03-22", status: "Pending" },
  { id: "INV-004", vehicle: "2024 Ford Bronco Sport", buyer: "James Kim", amount: 38500, date: "2026-03-20", status: "Paid" },
  { id: "INV-005", vehicle: "2023 Honda Accord", buyer: "Amanda Taylor", amount: 30200, date: "2026-03-18", status: "Overdue" },
];

const expenses = [
  { category: "Vehicle Acquisition", amount: 1120000 },
  { category: "Staff Salaries", amount: 245000 },
  { category: "Rent & Utilities", amount: 86000 },
  { category: "Marketing", amount: 62000 },
  { category: "Insurance", amount: 45000 },
  { category: "Maintenance", amount: 32000 },
];

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-700",
};

export default function Accounting() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Accounting</h1>
          <p className="text-muted-foreground text-sm">Financial overview and records</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Export Report</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${s.color} mb-3`}><s.icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Profit & Loss ($K)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={plData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="revenue" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(220 13% 80%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="hsl(152 60% 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            {expenses.map((e) => (
              <div key={e.category} className="flex items-center justify-between">
                <span className="text-sm">{e.category}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${(e.amount / 1200000) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-20 text-right">${(e.amount / 1000).toFixed(0)}K</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Sales Ledger</h3>
        <table className="data-table">
          <thead>
            <tr><th>Invoice</th><th>Vehicle</th><th>Buyer</th><th>Amount</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {salesLedger.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.id}</td>
                <td className="text-sm">{s.vehicle}</td>
                <td className="text-sm">{s.buyer}</td>
                <td className="font-medium">${s.amount.toLocaleString()}</td>
                <td className="text-xs text-muted-foreground">{s.date}</td>
                <td><span className={`status-badge ${statusColors[s.status]}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
