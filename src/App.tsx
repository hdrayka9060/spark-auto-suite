import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ConfirmProvider } from "@/components/ConfirmDialog";
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
/**
 * Persistent protected layout (React Router *layout route*). <AppLayout> mounts
 * ONCE and survives navigation — only the <Outlet/> content swaps — so the
 * sidebar/header no longer rebuild on every nav. The inner <Suspense> shows a
 * spinner only in the content area while a lazy page's chunk loads, instead of
 * the full-screen fallback replacing the whole app (which caused the
 * first-navigation flicker). Per-page permission gating moves onto each child
 * route via <PermissionRoute>.
 */
const ProtectedLayout = () => (
  <ProtectedRoute>
    <AppLayout>
      <Suspense fallback={<ContentFallback />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  </ProtectedRoute>
);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// Content-area-only spinner (keeps the sidebar/header visible during chunk loads).
const ContentFallback = () => (
  <div className="flex items-center justify-center py-24">
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
        <SocketProvider>
        <ConfirmProvider>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<PermissionRoute><Dashboard /></PermissionRoute>} />
            <Route path="/inventory" element={<PermissionRoute><Inventory /></PermissionRoute>} />
            <Route path="/inventory/:id" element={<PermissionRoute><VehicleDetail /></PermissionRoute>} />
            <Route path="/crm-sellers" element={<PermissionRoute><CRMSellers /></PermissionRoute>} />
            <Route path="/crm-sellers/:id" element={<PermissionRoute><SellerDetail /></PermissionRoute>} />
            <Route path="/crm-buyers" element={<PermissionRoute><CRMBuyers /></PermissionRoute>} />
            <Route path="/crm-buyers/:id" element={<PermissionRoute><BuyerDetail /></PermissionRoute>} />
            <Route path="/leads" element={<PermissionRoute><Leads /></PermissionRoute>} />
            <Route path="/leads/:id" element={<PermissionRoute><LeadDetail /></PermissionRoute>} />
            <Route path="/accounting" element={<PermissionRoute><Accounting /></PermissionRoute>} />
            <Route path="/bhph" element={<PermissionRoute><BHPH /></PermissionRoute>} />
            <Route path="/marketing" element={<PermissionRoute><Marketing /></PermissionRoute>} />
            <Route path="/marketing/:id" element={<PermissionRoute><CampaignDetail /></PermissionRoute>} />
            <Route path="/dealer-website" element={<PermissionRoute><DealerWebsite /></PermissionRoute>} />
            <Route path="/marketplace" element={<PermissionRoute><DealerMarketplace /></PermissionRoute>} />
            <Route path="/calendar" element={<PermissionRoute><CalendarPage /></PermissionRoute>} />
            <Route path="/communication" element={<PermissionRoute><Communication /></PermissionRoute>} />
            <Route path="/support" element={<PermissionRoute><Support /></PermissionRoute>} />
            <Route path="/staff" element={<PermissionRoute><StaffManagement /></PermissionRoute>} />
            <Route path="/roles" element={<PermissionRoute><RolesPermissions /></PermissionRoute>} />
            <Route path="/settings" element={<PermissionRoute><Settings /></PermissionRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
        </ConfirmProvider>
        </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
