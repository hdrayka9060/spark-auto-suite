import { User, Building, Bell, Shield, Palette, Database, Globe, CreditCard } from "lucide-react";

const sections = [
  { title: "Profile", icon: User, description: "Manage your account details" },
  { title: "Dealership", icon: Building, description: "Business information and branding" },
  { title: "Notifications", icon: Bell, description: "Email and push notification preferences" },
  { title: "Security", icon: Shield, description: "Password, 2FA, and access control" },
  { title: "Appearance", icon: Palette, description: "Theme and display settings" },
  { title: "Integrations", icon: Database, description: "Connected services and APIs" },
  { title: "Website", icon: Globe, description: "Public website configuration" },
  { title: "Billing", icon: CreditCard, description: "Subscription and payment methods" },
];

export default function Settings() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your dealership configuration</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="stat-card flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="p-3 bg-primary/10 text-primary rounded-xl"><s.icon className="h-5 w-5" /></div>
            <div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Profile Section Preview */}
      <div className="stat-card space-y-4">
        <h3 className="font-display font-semibold">Profile Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
            <input defaultValue="John Dealer" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
            <input defaultValue="john@autodealer.com" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
            <input defaultValue="555-0100" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
            <input defaultValue="Admin" disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-muted" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Save Changes</button>
        </div>
      </div>

      <div className="stat-card space-y-4">
        <h3 className="font-display font-semibold">Dealership Information</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Dealership Name</label>
            <input defaultValue="AutoDealer Motors" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
            <input defaultValue="1234 Main St, Auto City, CA 90210" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">License Number</label>
            <input defaultValue="DL-2024-98765" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Website</label>
            <input defaultValue="https://autodealer.com" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
