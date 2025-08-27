import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth, hasPermission } from "@/hooks/useAuth";

export default function TopBar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const getPageInfo = (path: string) => {
    switch (path) {
      case "/":
      case "/dashboard":
        return {
          breadcrumbs: ["Dashboard", "Visão Geral"],
          title: "Dashboard Executivo",
          showNewButton: hasPermission(user, "create_inspection"),
          newButtonText: "Nova Inspeção",
          newButtonAction: () => window.location.href = "/inspections?new=true"
        };
      case "/inspections":
        return {
          breadcrumbs: ["Inspeções", "Lista"],
          title: "Inspeções de Segurança",
          showNewButton: hasPermission(user, "create_inspection"),
          newButtonText: "Nova Inspeção",
          newButtonAction: () => {}
        };
      case "/action-plans":
        return {
          breadcrumbs: ["Planos de Ação", "Lista"],
          title: "Planos de Ação 5W2H",
          showNewButton: hasPermission(user, "manage_action_plans"),
          newButtonText: "Novo Plano",
          newButtonAction: () => {}
        };
      case "/reports":
        return {
          breadcrumbs: ["Relatórios", "Dashboard"],
          title: "Relatórios e Analytics",
          showNewButton: hasPermission(user, "export_data"),
          newButtonText: "Exportar",
          newButtonAction: () => {}
        };
      case "/organizations":
        return {
          breadcrumbs: ["Administração", "Organizações"],
          title: "Gestão de Organizações",
          showNewButton: hasPermission(user, "create_organization"),
          newButtonText: "Nova Organização",
          newButtonAction: () => {}
        };
      case "/users":
        return {
          breadcrumbs: ["Administração", "Usuários"],
          title: "Gestão de Usuários",
          showNewButton: hasPermission(user, "invite_user"),
          newButtonText: "Convidar Usuário",
          newButtonAction: () => {}
        };
      default:
        return {
          breadcrumbs: ["Dashboard"],
          title: "COMPIA",
          showNewButton: false,
          newButtonText: "",
          newButtonAction: () => {}
        };
    }
  };

  const pageInfo = getPageInfo(location);

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="topbar">
      <div className="flex items-center justify-between">
        <div data-testid="page-info">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-1" data-testid="breadcrumbs">
            {pageInfo.breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center space-x-2">
                {index > 0 && <ChevronRight className="w-3 h-3" />}
                <span 
                  className={index === pageInfo.breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}
                  data-testid={`breadcrumb-${index}`}
                >
                  {crumb}
                </span>
              </div>
            ))}
          </nav>
          <h2 className="text-2xl font-heading font-bold text-foreground" data-testid="page-title">
            {pageInfo.title}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4" data-testid="topbar-actions">
          {pageInfo.showNewButton && (
            <Button 
              onClick={pageInfo.newButtonAction}
              className="bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground flex items-center space-x-2"
              data-testid="new-action-button"
            >
              <Plus className="w-4 h-4" />
              <span>{pageInfo.newButtonText}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
