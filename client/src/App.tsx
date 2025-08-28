import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Organizations from "@/pages/Organizations";
import Inspections from "@/pages/Inspections";
import ActionPlans from "@/pages/ActionPlans";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import ChecklistTemplates from "@/pages/ChecklistTemplates";
import NewChecklistTemplate from "@/pages/NewChecklistTemplate";
import ChecklistDetail from "@/pages/ChecklistDetail";
import ChecklistEdit from "@/pages/ChecklistEdit";
import NewInspection from "@/pages/NewInspection";
import InspectionDetail from "@/pages/InspectionDetail";
import AcceptInvite from "@/pages/AcceptInvite";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/Layout/Sidebar";
import TopBar from "@/components/Layout/TopBar";
import AIChatbot from "@/components/AIChatbot";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-4">COMPIA</h1>
          <p className="text-muted-foreground mb-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
      <AIChatbot />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/dashboard" component={() => <AppLayout><Dashboard /></AppLayout>} />
      <Route path="/organizations" component={() => <AppLayout><Organizations /></AppLayout>} />
      <Route path="/inspections" component={() => <AppLayout><Inspections /></AppLayout>} />
      <Route path="/inspections/new" component={() => <AppLayout><NewInspection /></AppLayout>} />
      <Route path="/inspections/:id" component={() => <AppLayout><InspectionDetail /></AppLayout>} />
      <Route path="/checklists" component={() => <AppLayout><ChecklistTemplates /></AppLayout>} />
      <Route path="/checklist-templates" component={() => <AppLayout><ChecklistTemplates /></AppLayout>} />
      <Route path="/checklists/new" component={() => <AppLayout><NewChecklistTemplate /></AppLayout>} />
      <Route path="/checklists/:id" component={() => <AppLayout><ChecklistDetail /></AppLayout>} />
      <Route path="/checklists/:id/edit" component={() => <AppLayout><ChecklistEdit /></AppLayout>} />
      <Route path="/action-plans" component={() => <AppLayout><ActionPlans /></AppLayout>} />
      <Route path="/reports" component={() => <AppLayout><Reports /></AppLayout>} />
      <Route path="/users" component={() => <AppLayout><Users /></AppLayout>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
