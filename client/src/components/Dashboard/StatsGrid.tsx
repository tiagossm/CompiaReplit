import { ClipboardCheck, AlertTriangle, CheckCircle, Building } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

const statsConfig = [
  {
    icon: ClipboardCheck,
    key: "inspections" as keyof DashboardStats,
    label: "Inspeções Realizadas",
    color: "from-compia-blue to-compia-blue/80",
    changeKey: "inspectionsChange"
  },
  {
    icon: AlertTriangle,
    key: "nonCompliances" as keyof DashboardStats,
    label: "Não Conformidades",
    color: "from-compia-purple to-compia-purple/80",
    changeKey: "nonCompliancesChange"
  },
  {
    icon: CheckCircle,
    key: "completedActions" as keyof DashboardStats,
    label: "Ações Concluídas",
    color: "from-compia-green to-compia-green/80",
    changeKey: "actionsChange"
  },
  {
    icon: Building,
    key: "activeOrganizations" as keyof DashboardStats,
    label: "Organizações Ativas",
    color: "from-yellow-500 to-yellow-600",
    changeKey: "organizationsChange"
  }
];

export default function StatsGrid() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-grid-loading">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="stat-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-lg mb-4"></div>
                <div className="h-8 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8" data-testid="stats-grid-error">
        <p className="text-muted-foreground">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-grid">
      {statsConfig.map((config, index) => {
        const Icon = config.icon;
        const value = stats[config.key];
        const change = index === 0 ? "+12%" : 
                     index === 1 ? "+5" : 
                     index === 2 ? "94.2%" : "+3";
        const changeColor = index === 1 ? "text-destructive bg-destructive/10" : "text-compia-green bg-compia-green/10";

        return (
          <Card key={config.key} className="stat-card" data-testid={`stat-card-${config.key}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${config.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="text-white text-lg" data-testid={`stat-icon-${config.key}`} />
                </div>
                <span 
                  className={`text-xs font-medium px-2 py-1 rounded-full ${changeColor}`}
                  data-testid={`stat-change-${config.key}`}
                >
                  {change}
                </span>
              </div>
              <h3 
                className="text-2xl font-heading font-bold text-foreground mb-1"
                data-testid={`stat-value-${config.key}`}
              >
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              </h3>
              <p 
                className="text-sm text-muted-foreground"
                data-testid={`stat-label-${config.key}`}
              >
                {config.label}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
