import { NotificationPreferences } from "@/components/NotificationPreferences";

/**
 * Standalone per-user notification settings, reachable by EVERY authenticated
 * staff member at /account/notifications. Unlike the admin-only Settings page,
 * this route isn't tied to a nav module (moduleForPath → null → ungated), so
 * anyone can manage their own notification preferences. Opened from the bell.
 */
export default function NotificationSettings() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Notification Settings</h1>
          <p className="text-muted-foreground text-sm">Manage how and when you&apos;re notified.</p>
        </div>
      </div>
      <div className="max-w-2xl">
        <NotificationPreferences />
      </div>
    </div>
  );
}
