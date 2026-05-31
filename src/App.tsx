import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

/**
 * Route-level code splitting.
 *
 * Each page becomes its own chunk loaded on-demand. The previous eager imports
 * inflated the initial bundle to ~10 MB — a brutal first paint on slow
 * networks (the user reported a 35s load with DevTools 3G throttling). After
 * splitting, the login page downloads only the shared shell + Auth chunk
 * (~300-500 KB), and other routes load on navigation.
 *
 * Auth + AcceptInvite stay lazy too — Vite gives them their own small chunks
 * so the first-paint cost is negligible. Everything else is lazy. The user
 * sees a spinner while a chunk streams in (seconds, not minutes).
 *
 * The Suspense fallback is a centered spinner so a slow chunk download
 * doesn't show a blank page — same pattern the auth bootstrap uses.
 */
const Auth = lazy(() => import("./pages/Auth"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail"));
const CRMSellers = lazy(() => import("./pages/CRMSellers"));
const SellerDetail = lazy(() => import("./pages/SellerDetail"));
const CRMBuyers = lazy(() => import("./pages/CRMBuyers"));
const BuyerDetail = lazy(() => import("./pages/BuyerDetail"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Accounting = lazy(() => import("./pages/Accounting"));
const BHPH = lazy(() => import("./pages/BHPH"));
const Marketing = lazy(() => import("./pages/Marketing"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const DealerWebsite = lazy(() => import("./pages/DealerWebsite"));
const DealerMarketplace = lazy(() => import("./pages/DealerMarketplace"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Communication = lazy(() => import("./pages/Communication"));
const Support = lazy(() => import("./pages/Support"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const RolesPermissions = lazy(() => import("./pages/RolesPermissions"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/**
 * Wraps a page in three layers:
 *   1. ProtectedRoute — must be authenticated.
 *   2. AppLayout — chrome (sidebar + header).
 *   3. PermissionRoute — checks the role.permissions matrix for the page's
 *      module (resolved from URL via `moduleForPath()`).
 *
 * Permission is resolved AFTER the layout renders so the sidebar still shows
 * (with whatever items the user can see) when a no-access stub is displayed.
 */
const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>
      <PermissionRoute>{children}</PermissionRoute>
    </AppLayout>
  </ProtectedRoute>
);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
          <Route path="/inventory/:id" element={<Protected><VehicleDetail /></Protected>} />
          <Route path="/crm-sellers" element={<Protected><CRMSellers /></Protected>} />
          <Route path="/crm-sellers/:id" element={<Protected><SellerDetail /></Protected>} />
          <Route path="/crm-buyers" element={<Protected><CRMBuyers /></Protected>} />
          <Route path="/crm-buyers/:id" element={<Protected><BuyerDetail /></Protected>} />
          <Route path="/leads" element={<Protected><Leads /></Protected>} />
          <Route path="/leads/:id" element={<Protected><LeadDetail /></Protected>} />
          <Route path="/accounting" element={<Protected><Accounting /></Protected>} />
          <Route path="/bhph" element={<Protected><BHPH /></Protected>} />
          <Route path="/marketing" element={<Protected><Marketing /></Protected>} />
          <Route path="/marketing/:id" element={<Protected><CampaignDetail /></Protected>} />
          <Route path="/dealer-website" element={<Protected><DealerWebsite /></Protected>} />
          <Route path="/marketplace" element={<Protected><DealerMarketplace /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/communication" element={<Protected><Communication /></Protected>} />
          <Route path="/support" element={<Protected><Support /></Protected>} />
          <Route path="/staff" element={<Protected><StaffManagement /></Protected>} />
          <Route path="/roles" element={<Protected><RolesPermissions /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
