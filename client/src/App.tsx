import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/Layout/Sidebar";
import TopBar from "@/components/Layout/TopBar";
import AIChatbot from "@/components/AIChatbot";
import ActionPlans from "@/pages/ActionPlans";
import Companies from "@/pages/Companies";
import CompanyForm from "@/pages/CompanyForm";
import Dashboard from "@/pages/Dashboard";
import InspectionDetail from "@/pages/InspectionDetail";
import Inspections from "@/pages/Inspections";
import ChecklistDetail from "@/pages/ChecklistDetail";
import ChecklistEdit from "@/pages/ChecklistEdit";
import ChecklistTemplates from "@/pages/ChecklistTemplates";
import NewChecklistTemplate from "@/pages/NewChecklistTemplate";
import NewInspection from "@/pages/NewInspection";
import Organizations from "@/pages/Organizations";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import CSVImport from "@/pages/CSVImport";
import AIChecklistGenerator from "@/pages/AIChecklistGenerator";
import AcceptInvite from "@/pages/AcceptInvite";
import NotFound from "@/pages/not-found";
import { queryClient } from "./lib/queryClient";
import { useAuth } from "./hooks/useAuth";

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

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/organizations" component={Organizations} />
        <Route path="/inspections" component={Inspections} />
        <Route path="/inspections/new" component={NewInspection} />
        <Route path="/inspections/:id" component={InspectionDetail} />
        <Route path="/checklists" component={ChecklistTemplates} />
        <Route path="/checklist-templates" component={ChecklistTemplates} />
        <Route path="/checklists/new" component={NewChecklistTemplate} />
        <Route path="/checklists/import" component={CSVImport} />
        <Route path="/checklists/ai-generator" component={AIChecklistGenerator} />
        <Route path="/checklists/:id/edit" component={ChecklistEdit} />
        <Route path="/checklists/:id" component={ChecklistDetail} />
        <Route path="/action-plans" component={ActionPlans} />
        <Route path="/reports" component={Reports} />
        <Route path="/users" component={Users} />
        <Route path="/companies" component={Companies} />
        <Route path="/companies/new" component={CompanyForm} />
        <Route path="/companies/:id/edit" component={CompanyForm} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route component={AuthenticatedRoutes} />
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
