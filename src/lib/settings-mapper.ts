/**
 * Dealer Settings mapper. The schema is mostly free-form key/value pairs;
 * very little translation needed. The mapper exists mainly to provide stable
 * TypeScript types for the Settings form.
 */

export interface BusinessHours {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
}

export interface NotificationPrefs {
  emailNotifications: boolean;
  smsNotifications: boolean;
  leadAlerts: boolean;
  paymentAlerts: boolean;
  supportAlerts: boolean;
}

export interface ServerDealerSettings {
  _id: string;
  dealershipName: string;
  logo: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  licenseNumber: string;
  businessHours: BusinessHours;
  notifications: NotificationPrefs;
  currency: string;
  language: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
}

export type DealerSettings = ServerDealerSettings;

// No real translation needed — return as-is.
export function toClientSettings(s: ServerDealerSettings): DealerSettings {
  return s;
}

export interface DealerSettingsUpdate {
  dealershipName?: string;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  licenseNumber?: string;
  businessHours?: Partial<BusinessHours>;
  currency?: string;
  language?: string;
  primaryColor?: string;
}

export const NOTIFICATION_LABELS: Record<keyof NotificationPrefs, { title: string; description: string }> = {
  emailNotifications: { title: "Email notifications", description: "General product updates by email" },
  smsNotifications: { title: "SMS notifications", description: "Urgent alerts by text message" },
  leadAlerts: { title: "Lead alerts", description: "Notify when a new lead is created" },
  paymentAlerts: { title: "Payment alerts", description: "Notify on BHPH payment activity" },
  supportAlerts: { title: "Support alerts", description: "Notify on new support tickets" },
};
