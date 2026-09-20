import { useEffect, useState } from "react";
import { User, Building, Bell, Loader2, AlertCircle, Save, FileSignature } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDealerSettings, useUpdateDealerSettings } from "@/hooks/api/use-settings";
import { ApiError } from "@/lib/api";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { DocumentTemplatesManager } from "@/pages/DocumentTemplates";
import { toast } from "@/hooks/use-toast";

type Tab = "profile" | "dealership" | "notifications" | "documents";

const TABS: { key: Tab; label: string; icon: typeof User; description: string }[] = [
  { key: "profile", label: "Profile", icon: User, description: "Manage your account details" },
  { key: "dealership", label: "Dealership", icon: Building, description: "Business information and branding" },
  { key: "notifications", label: "Notifications", icon: Bell, description: "Email and alert preferences" },
  { key: "documents", label: "Documents", icon: FileSignature, description: "Signable document templates" },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account and dealership configuration</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`stat-card flex items-center gap-4 text-left transition-shadow ${tab === t.key ? "ring-2 ring-primary" : "hover:shadow-md"}`}
          >
            <div className={`p-3 rounded-xl ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">{t.label}</h3>
              <p className="text-sm text-muted-foreground">{t.description}</p>
            </div>
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileSection />}
      {tab === "dealership" && <DealershipSection />}
      {tab === "notifications" && <NotificationPreferences />}
      {tab === "documents" && <DocumentTemplatesManager />}
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────

function ProfileSection() {
  const { state, updateProfile } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    department: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        phone: user.phone ?? "",
        department: user.department ?? "",
      });
    }
  }, [user]);

  if (!user) {
    return (
      <div className="stat-card text-center py-12 text-muted-foreground">
        Not signed in.
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        department: form.department,
      });
      toast({ title: "Profile saved" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stat-card space-y-4">
      <h3 className="font-display font-semibold">Profile</h3>
      <p className="text-xs text-muted-foreground -mt-2">Your contact info. Email is locked to your login identity.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="First name">
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Last name">
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Email">
          <input value={user.email} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Department">
          <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Role">
          <input value={user.roleId?.name ?? "—"} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground" />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Dealership ────────────────────────────────────────────────────────────

function DealershipSection() {
  const settingsQuery = useDealerSettings();
  const updateSettings = useUpdateDealerSettings();
  const [form, setForm] = useState({
    dealershipName: "", address: "", city: "", state: "", zipCode: "", country: "",
    phone: "", email: "", website: "", taxId: "", licenseNumber: "",
    currency: "USD", language: "en",
  });

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setForm({
        dealershipName: s.dealershipName ?? "",
        address: s.address ?? "",
        city: s.city ?? "",
        state: s.state ?? "",
        zipCode: s.zipCode ?? "",
        country: s.country ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        website: s.website ?? "",
        taxId: s.taxId ?? "",
        licenseNumber: s.licenseNumber ?? "",
        currency: s.currency ?? "USD",
        language: s.language ?? "en",
      });
    }
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading) {
    return (
      <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  if (settingsQuery.error) {
    return (
      <div className="stat-card text-center py-12 text-red-600 flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Could not load settings"}
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      toast({ title: "Dealership settings saved" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="stat-card space-y-4">
      <h3 className="font-display font-semibold">Dealership Information</h3>
      <p className="text-xs text-muted-foreground -mt-2">Used on the public website and on invoices/contracts.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Dealership name">
          <input value={form.dealershipName} onChange={(e) => setForm({ ...form, dealershipName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Website">
          <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Contact email">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Contact phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="State">
          <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Zip code">
          <input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="License number">
          <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Tax ID">
          <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Currency">
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="USD">USD — US Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="INR">INR — Indian Rupee</option>
          </select>
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Shared field helper ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}
