import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import CRMSellers from "./pages/CRMSellers";
import CRMBuyers from "./pages/CRMBuyers";
import Accounting from "./pages/Accounting";
import BHPH from "./pages/BHPH";
import Marketing from "./pages/Marketing";
import DealerWebsite from "./pages/DealerWebsite";
import CalendarPage from "./pages/CalendarPage";
import Communication from "./pages/Communication";
import Support from "./pages/Support";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout><></></AppLayout>}>
            {/* Wrapped routes won't work this way, use layout pattern */}
          </Route>
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/inventory" element={<AppLayout><Inventory /></AppLayout>} />
          <Route path="/crm-sellers" element={<AppLayout><CRMSellers /></AppLayout>} />
          <Route path="/crm-buyers" element={<AppLayout><CRMBuyers /></AppLayout>} />
          <Route path="/accounting" element={<AppLayout><Accounting /></AppLayout>} />
          <Route path="/bhph" element={<AppLayout><BHPH /></AppLayout>} />
          <Route path="/marketing" element={<AppLayout><Marketing /></AppLayout>} />
          <Route path="/dealer-website" element={<AppLayout><DealerWebsite /></AppLayout>} />
          <Route path="/calendar" element={<AppLayout><CalendarPage /></AppLayout>} />
          <Route path="/communication" element={<AppLayout><Communication /></AppLayout>} />
          <Route path="/support" element={<AppLayout><Support /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
