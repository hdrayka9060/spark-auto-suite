import { useState } from "react";
import { Plus, DollarSign, Calendar, CheckCircle, AlertCircle } from "lucide-react";

const loans = [
  { id: "BHPH-001", customer: "Tony Ramirez", vehicle: "2021 Nissan Altima", total: 24000, paid: 14400, remaining: 9600, emi: 800, nextDue: "2026-04-01", status: "Active", installments: 30, completed: 18 },
  { id: "BHPH-002", customer: "Diane Foster", vehicle: "2020 Chevy Malibu", total: 18000, paid: 6000, remaining: 12000, emi: 600, nextDue: "2026-04-05", status: "Active", installments: 30, completed: 10 },
  { id: "BHPH-003", customer: "Marcus Lee", vehicle: "2019 Ford Focus", total: 15000, paid: 15000, remaining: 0, emi: 625, nextDue: "-", status: "Completed", installments: 24, completed: 24 },
  { id: "BHPH-004", customer: "Angela White", vehicle: "2022 Hyundai Elantra", total: 22000, paid: 4400, remaining: 17600, emi: 733, nextDue: "2026-04-03", status: "Overdue", installments: 30, completed: 6 },
];

const paymentHistory = [
  { date: "2026-03-28", customer: "Tony Ramirez", amount: 800, method: "Bank Transfer", loan: "BHPH-001" },
  { date: "2026-03-25", customer: "Diane Foster", amount: 600, method: "Cash", loan: "BHPH-002" },
  { date: "2026-03-20", customer: "Tony Ramirez", amount: 800, method: "Bank Transfer", loan: "BHPH-001" },
  { date: "2026-03-15", customer: "Angela White", amount: 733, method: "Card", loan: "BHPH-004" },
];

const statusColors: Record<string, string> = { Active: "bg-emerald-100 text-emerald-700", Completed: "bg-blue-100 text-blue-700", Overdue: "bg-red-100 text-red-700" };

export default function BHPH() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string | null>("BHPH-001");
  const detail = loans.find((l) => l.id === selectedLoan);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Buy Here Pay Here</h1>
          <p className="text-muted-foreground text-sm">Dealer financing management</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Create Loan
        </button>
      </div>

      {showCreate && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Loan</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <input placeholder="Customer Name" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Vehicle" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Loan Amount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="EMI Amount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Total Installments" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Start Date" type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Create Loan</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><div className="bg-primary/10 text-primary p-2 rounded-lg w-fit mb-2"><DollarSign className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">$79K</p><p className="text-xs text-muted-foreground">Total Financed</p></div>
        <div className="stat-card"><div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg w-fit mb-2"><CheckCircle className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">$39.8K</p><p className="text-xs text-muted-foreground">Total Collected</p></div>
        <div className="stat-card"><div className="bg-amber-50 text-amber-600 p-2 rounded-lg w-fit mb-2"><Calendar className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">$39.2K</p><p className="text-xs text-muted-foreground">Outstanding</p></div>
        <div className="stat-card"><div className="bg-red-50 text-red-600 p-2 rounded-lg w-fit mb-2"><AlertCircle className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">1</p><p className="text-xs text-muted-foreground">Overdue Loans</p></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Loans Table */}
        <div className="lg:col-span-2 stat-card overflow-x-auto">
          <h3 className="font-display font-semibold mb-4">Active Loans</h3>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>EMI</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className={`cursor-pointer ${selectedLoan === l.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedLoan(l.id)}>
                  <td className="font-mono text-xs">{l.id}</td>
                  <td className="font-medium text-sm">{l.customer}</td>
                  <td className="text-sm">{l.vehicle}</td>
                  <td className="text-sm font-medium">${l.emi}/mo</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${(l.completed / l.installments) * 100}%` }} /></div>
                      <span className="text-xs text-muted-foreground">{l.completed}/{l.installments}</span>
                    </div>
                  </td>
                  <td><span className={`status-badge ${statusColors[l.status]}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Loan Detail */}
        <div className="stat-card">
          {detail ? (
            <div className="space-y-4">
              <h3 className="font-display font-semibold">{detail.customer}</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Vehicle:</span> {detail.vehicle}</p>
                <p><span className="text-muted-foreground">Total:</span> ${detail.total.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Paid:</span> ${detail.paid.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Remaining:</span> ${detail.remaining.toLocaleString()}</p>
                <p><span className="text-muted-foreground">Next Due:</span> {detail.nextDue}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">EMI SCHEDULE</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: detail.installments }, (_, i) => (
                    <div key={i} className={`h-6 w-full rounded text-[10px] flex items-center justify-center font-medium ${i < detail.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : <div className="text-center text-muted-foreground py-12 text-sm">Select a loan</div>}
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Payment History</h3>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Loan</th><th>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {paymentHistory.map((p, i) => (
              <tr key={i}>
                <td className="text-xs text-muted-foreground">{p.date}</td>
                <td className="text-sm">{p.customer}</td>
                <td className="font-mono text-xs">{p.loan}</td>
                <td className="font-medium text-sm">${p.amount}</td>
                <td className="text-sm text-muted-foreground">{p.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
