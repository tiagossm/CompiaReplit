import { Link, useLocation } from "wouter";
import { Shield, BarChart3, ClipboardCheck, ListTodo, FileText, Building, Users, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigationItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      permission: "view_dashboard"
    },
    {
      title: "Inspeções",
      href: "/inspections",
      icon: ClipboardCheck,
      permission: "create_inspection"
    },
    {
      title: "Planos de Ação",
      href: "/action-plans",
      icon: ListTodo,
      permission: "manage_action_plans"
    },
    {
      title: "Relatórios",
      href: "/reports",
      icon: FileText,
      permission: "view_reports"
    }
  ];

  const adminItems = [
    {
      title: "Organizações",
      href: "/organizations",
      icon: Building,
      permission: "manage_organization"
    },
    {
      title: "Usuários",
      href: "/users",
      icon: Users,
      permission: "invite_user"
    },
    {
      title: "Configurações",
      href: "/settings",
      icon: Settings,
      permission: "system_admin"
    }
  ];

  const visibleNavItems = navigationItems.filter(item => 
    hasPermission(user, item.permission)
  );

  const visibleAdminItems = adminItems.filter(item => 
    hasPermission(user, item.permission)
  );

  return (
    <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col" data-testid="sidebar">
      {/* Header */}
      <div className="p-6 border-b border-border" data-testid="sidebar-header">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-compia-blue to-compia-purple rounded-lg flex items-center justify-center">
            <Shield className="text-primary-foreground text-lg" data-testid="logo-icon" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-foreground" data-testid="app-title">COMPIA</h1>
            <p className="text-xs text-muted-foreground" data-testid="app-subtitle">Segurança Inteligente</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2" data-testid="sidebar-navigation">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + '/');
          
          return (
            <Link key={item.href} href={item.href}>
              <a 
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary border-r-3 border-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-item-${item.href.replace('/', '')}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </a>
            </Link>
          );
        })}

        {visibleAdminItems.length > 0 && (
          <div className="pt-4" data-testid="admin-section">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administração
              </h3>
            </div>
            {visibleAdminItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(item.href + '/');
              
              return (
                <Link key={item.href} href={item.href}>
                  <a 
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary border-r-3 border-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    data-testid={`admin-item-${item.href.replace('/', '')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border" data-testid="user-profile">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-compia-green to-compia-blue rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-foreground" data-testid="user-avatar">
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">
              {user.name}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="user-role">
              {user.role === 'system_admin' ? 'System Admin' : 
               user.role === 'org_admin' ? 'Org Admin' : 
               user.role === 'manager' ? 'Gerente' :
               user.role === 'inspector' ? 'Técnico' : 'Cliente'}
            </p>
          </div>
          <div className="relative">
            <Bell className="w-4 h-4 text-muted-foreground" data-testid="notifications-icon" />
            <Badge 
              className="absolute -top-1 -right-1 w-3 h-3 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground"
              data-testid="notification-badge"
            >
              3
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
