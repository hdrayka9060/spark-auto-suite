import { useState } from "react";
import { Globe, Eye, ExternalLink, Car, Phone, CalendarDays, User, Search } from "lucide-react";

const pages = ["Landing", "Home", "Cars Listing", "Vehicle Details", "Test Drive Booking", "Login", "Booking History", "Support & Contact"];

const previewVehicles = [
  { title: "2024 BMW X5 xDrive40i", price: "$65,000", km: "1,200 km", year: 2024, img: "🚙" },
  { title: "2024 Tesla Model 3 LR", price: "$48,900", km: "800 km", year: 2024, img: "⚡" },
  { title: "2023 Audi Q7 Premium", price: "$58,500", km: "12,300 km", year: 2023, img: "🚙" },
  { title: "2023 Toyota Camry SE", price: "$28,500", km: "18,900 km", year: 2023, img: "🚗" },
];

export default function DealerWebsite() {
  const [activePage, setActivePage] = useState("Home");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dealer Website</h1>
          <p className="text-muted-foreground text-sm">Preview your auto-generated public website</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <ExternalLink className="h-4 w-4" /> Visit Live Site
        </button>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 bg-card border rounded-lg p-1">
        {pages.map((p) => (
          <button key={p} onClick={() => setActivePage(p)} className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activePage === p ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{p}</button>
        ))}
      </div>

      {/* Website Preview */}
      <div className="stat-card overflow-hidden">
        <div className="bg-muted rounded-lg p-1 mb-4 flex items-center gap-2">
          <div className="flex gap-1.5 ml-2"><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
          <div className="flex-1 bg-background rounded px-3 py-1 text-xs text-muted-foreground">https://autodealer.com/{activePage.toLowerCase().replace(/ /g, "-")}</div>
        </div>

        {activePage === "Home" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-8 text-primary-foreground">
              <h2 className="font-display text-3xl font-bold mb-2">Find Your Dream Car</h2>
              <p className="opacity-90 mb-4">Browse 247+ quality vehicles at unbeatable prices</p>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2 flex-1 max-w-md">
                  <Search className="h-4 w-4" /><input placeholder="Search make, model, year..." className="bg-transparent text-sm outline-none w-full placeholder:text-white/60" />
                </div>
                <button className="bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-medium">Search</button>
              </div>
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg mb-3">Featured Vehicles</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {previewVehicles.map((v) => (
                  <div key={v.title} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="bg-muted h-32 flex items-center justify-center text-5xl">{v.img}</div>
                    <div className="p-3">
                      <p className="font-medium text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground">{v.km} · {v.year}</p>
                      <p className="font-display font-bold text-primary mt-1">{v.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePage === "Landing" && (
          <div className="text-center py-16 space-y-4">
            <Car className="h-16 w-16 mx-auto text-primary" />
            <h2 className="font-display text-4xl font-bold">AutoDealer</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Your trusted destination for quality pre-owned and new vehicles. Financing available.</p>
            <div className="flex gap-3 justify-center">
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium">Browse Cars</button>
              <button className="border px-6 py-3 rounded-lg font-medium">Sell Your Car</button>
            </div>
          </div>
        )}

        {activePage === "Cars Listing" && (
          <div className="grid md:grid-cols-2 gap-4">
            {previewVehicles.map((v) => (
              <div key={v.title} className="flex gap-4 border rounded-xl p-4">
                <div className="bg-muted h-24 w-24 rounded-lg flex items-center justify-center text-4xl shrink-0">{v.img}</div>
                <div className="flex-1">
                  <p className="font-medium">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.km} · {v.year}</p>
                  <p className="font-display font-bold text-primary text-lg mt-1">{v.price}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded">View Details</button>
                    <button className="text-xs border px-3 py-1 rounded">Test Drive</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activePage === "Test Drive Booking" && (
          <div className="max-w-md mx-auto py-8 space-y-4">
            <h3 className="font-display font-semibold text-xl text-center">Book a Free Test Drive</h3>
            <input placeholder="Full Name" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Email" type="email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Phone" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
              <option>Select Vehicle</option>
              {previewVehicles.map((v) => <option key={v.title}>{v.title}</option>)}
            </select>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm">Book Test Drive</button>
          </div>
        )}

        {activePage === "Login" && (
          <div className="max-w-sm mx-auto py-12 space-y-4">
            <h3 className="font-display font-semibold text-xl text-center">Customer Login</h3>
            <input placeholder="Email" type="email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Password" type="password" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm">Sign In</button>
            <p className="text-center text-xs text-muted-foreground">Don't have an account? <span className="text-primary cursor-pointer">Sign up</span></p>
          </div>
        )}

        {["Vehicle Details", "Booking History", "Support & Contact"].includes(activePage) && (
          <div className="text-center py-16 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Preview of <strong>{activePage}</strong> page</p>
            <p className="text-xs mt-1">This page is auto-generated from your inventory data</p>
          </div>
        )}
      </div>
    </div>
  );
}
