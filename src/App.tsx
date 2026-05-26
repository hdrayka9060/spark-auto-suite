import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import VehicleDetail from "./pages/VehicleDetail";
import CRMSellers from "./pages/CRMSellers";
import SellerDetail from "./pages/SellerDetail";
import CRMBuyers from "./pages/CRMBuyers";
import BuyerDetail from "./pages/BuyerDetail";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Accounting from "./pages/Accounting";
import BHPH from "./pages/BHPH";
import Marketing from "./pages/Marketing";
import CampaignDetail from "./pages/CampaignDetail";
import DealerWebsite from "./pages/DealerWebsite";
import DealerMarketplace from "./pages/DealerMarketplace";
import CalendarPage from "./pages/CalendarPage";
import Communication from "./pages/Communication";
import Support from "./pages/Support";
import StaffManagement from "./pages/StaffManagement";
import RolesPermissions from "./pages/RolesPermissions";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
