import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, FileText, BarChart3, PieChart, Calendar, Building, 
  TrendingUp, AlertTriangle, CheckCircle, Users, Clock, Target
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";
import type { DashboardStats, ComplianceReport, InspectionReport } from "@/lib/types";

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

export default function Reports() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("all");
  const [reportType, setReportType] = useState<string>("dashboard");

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
  });

  const { data: organizations } = useQuery({
    queryKey: ['/api/organizations'],
  });

  const { data: inspections } = useQuery({
    queryKey: ['/api/inspections', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
  });

  const { data: actionPlans } = useQuery({
    queryKey: ['/api/action-plans', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
  });

  const { data: complianceReport, isLoading: reportLoading } = useQuery<ComplianceReport>({
    queryKey: ['/api/reports/compliance', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
    enabled: reportType === "compliance"
  });

  const canExportData = hasPermission(user, 'export_data');
  const canViewReports = hasPermission(user, 'view_reports');

  // Mock data for charts - in production this would come from the API
  const inspectionTrendsData = [
    { month: "Jan", inspections: 65, conformes: 58, naoConformes: 7 },
    { month: "Fev", inspections: 78, conformes: 71, naoConformes: 7 },
    { month: "Mar", inspections: 90, conformes: 82, naoConformes: 8 },
    { month: "Abr", inspections: 85, conformes: 77, naoConformes: 8 },
    { month: "Mai", inspections: 95, conformes: 87, naoConformes: 8 },
    { month: "Jun", inspections: 102, conformes: 94, naoConformes: 8 }
  ];

  const complianceByNRData = [
    { name: 'NR-06 (EPIs)', compliant: 85, nonCompliant: 15 },
    { name: 'NR-10 (Elétrica)', compliant: 78, nonCompliant: 22 },
    { name: 'NR-12 (Máquinas)', compliant: 92, nonCompliant: 8 },
    { name: 'NR-23 (Incêndio)', compliant: 88, nonCompliant: 12 },
    { name: 'NR-26 (Sinalização)', compliant: 95, nonCompliant: 5 }
  ];

  const pieChartData = stats ? [
    { name: 'Conformes', value: stats.inspections - stats.nonCompliances, color: '#10B981' },
    { name: 'Não Conformes', value: stats.nonCompliances, color: '#EF4444' }
  ] : [];

  const actionPlansStatusData = stats ? [
    { name: 'Concluídas', value: stats.completedActions, color: '#10B981' },
    { name: 'Em Andamento', value: Math.round(stats.completedActions * 0.3), color: '#F59E0B' },
    { name: 'Atrasadas', value: stats.overdueActions, color: '#EF4444' },
    { name: 'Pendentes', value: Math.round(stats.completedActions * 0.2), color: '#6B7280' }
  ] : [];

  const exportReport = async (type: 'pdf' | 'excel' | 'csv') => {
    // In a real implementation, this would call the API to generate and download the report
    console.log(`Exporting ${type} report for period ${selectedPeriod} days`);
    
    // Mock download
    const filename = `relatorio_${type}_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : type}`;
    
    // Create a mock blob and download
    const mockData = `Relatório COMPIA - ${new Date().toLocaleDateString('pt-BR')}\n\nDados do relatório...`;
    const blob = new Blob([mockData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!canViewReports) {
    return (
      <div className="p-6 text-center" data-testid="reports-unauthorized">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para visualizar relatórios.</p>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="p-6" data-testid="reports-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="reports-page">
      {/* Header with Filters and Export */}
      <Card data-testid="reports-header">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex items-center space-x-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[160px]" data-testid="select-period">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 3 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>

              {user.role === 'system_admin' && (
                <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                  <SelectTrigger className="w-[200px]" data-testid="select-organization">
                    <Building className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Organizações</SelectItem>
                    {organizations?.map((org: any) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {canExportData && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => exportReport('pdf')}
                  data-testid="export-pdf"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportReport('excel')}
                  data-testid="export-excel"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportReport('csv')}
                  data-testid="export-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="metrics-summary">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-compia-blue/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-compia-blue" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inspeções</p>
                  <p className="text-2xl font-bold" data-testid="total-inspections">
                    {stats.inspections.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-compia-green">+12% vs período anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-compia-green/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-compia-green" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conformidade</p>
                  <p className="text-2xl font-bold" data-testid="compliance-rate">
                    {stats.complianceRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-compia-green">Meta: 95%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-compia-purple/10 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-compia-purple" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ações Concluídas</p>
                  <p className="text-2xl font-bold" data-testid="completed-actions">
                    {stats.completedActions.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-compia-green">
                    {stats.actionCompletionRate.toFixed(1)}% de conclusão
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ações Atrasadas</p>
                  <p className="text-2xl font-bold text-destructive" data-testid="overdue-actions">
                    {stats.overdueActions.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-destructive">Requer atenção</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-6" data-testid="reports-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <CheckCircle className="w-4 h-4 mr-2" />
            Conformidade
          </TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">
            <Target className="w-4 h-4 mr-2" />
            Planos de Ação
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Tendências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6" data-testid="dashboard-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inspection Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Tendência de Inspeções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="inspection-trends-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={inspectionTrendsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="inspections" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        name="Total"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conformes" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        name="Conformes"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="naoConformes" 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        name="Não Conformes"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Conformidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="compliance-pie-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6" data-testid="compliance-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance by NR */}
            <Card>
              <CardHeader>
                <CardTitle>Conformidade por Norma Regulamentadora</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="compliance-by-nr-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complianceByNRData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="compliant" fill="#10B981" name="Conforme" />
                      <Bar dataKey="nonCompliant" fill="#EF4444" name="Não Conforme" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo de Conformidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" data-testid="compliance-summary">
                  {complianceByNRData.map((item, index) => {
                    const total = item.compliant + item.nonCompliant;
                    const percentage = ((item.compliant / total) * 100).toFixed(1);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{total} inspeções</p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            className={parseFloat(percentage) >= 90 ? "bg-compia-green/10 text-compia-green" : 
                                     parseFloat(percentage) >= 80 ? "bg-yellow-100 text-yellow-800" : 
                                     "bg-destructive/10 text-destructive"}
                          >
                            {percentage}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6" data-testid="actions-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Plans Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status dos Planos de Ação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="action-plans-status-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={actionPlansStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {actionPlansStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Action Plans Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Performance dos Planos de Ação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" data-testid="action-plans-performance">
                  <div className="flex items-center justify-between p-3 bg-compia-green/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-compia-green" />
                      <div>
                        <p className="font-medium text-foreground">Taxa de Conclusão</p>
                        <p className="text-sm text-muted-foreground">Planos finalizados no prazo</p>
                      </div>
                    </div>
                    <Badge className="bg-compia-green/10 text-compia-green">
                      {stats?.actionCompletionRate.toFixed(1)}%
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-6 h-6 text-yellow-600" />
                      <div>
                        <p className="font-medium text-foreground">Tempo Médio</p>
                        <p className="text-sm text-muted-foreground">Para conclusão das ações</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      12 dias
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                      <div>
                        <p className="font-medium text-foreground">Ações Atrasadas</p>
                        <p className="text-sm text-muted-foreground">Requerem atenção imediata</p>
                      </div>
                    </div>
                    <Badge className="bg-destructive/10 text-destructive">
                      {stats?.overdueActions || 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6" data-testid="trends-content">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Tendências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6" data-testid="trends-analysis">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-compia-blue/10 p-4 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <TrendingUp className="w-6 h-6 text-compia-blue" />
                      <h4 className="font-semibold text-foreground">Tendência Positiva</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aumento de 15% na taxa de conformidade nos últimos 3 meses, 
                      indicando melhoria nos processos de segurança.
                    </p>
                  </div>

                  <div className="bg-yellow-100 p-4 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      <h4 className="font-semibold text-foreground">Atenção Requerida</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aumento de 8% em não conformidades relacionadas à NR-10 
                      (instalações elétricas) no último mês.
                    </p>
                  </div>

                  <div className="bg-compia-green/10 p-4 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <CheckCircle className="w-6 h-6 text-compia-green" />
                      <h4 className="font-semibold text-foreground">Meta Alcançada</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      95% das ações de segurança foram concluídas dentro do prazo 
                      estabelecido este mês.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center space-x-2">
                    <PieChart className="w-5 h-5 text-compia-purple" />
                    <span>Recomendações Baseadas em IA</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-compia-blue rounded-full mt-2"></div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Prioridade Alta:</strong> Implementar programa de treinamento 
                        focado em segurança elétrica para reduzir não conformidades da NR-10.
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-compia-green rounded-full mt-2"></div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Oportunidade:</strong> Aproveitar o momento de alta conformidade 
                        para expandir auditorias preventivas em outros setores.
                      </p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-compia-purple rounded-full mt-2"></div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Eficiência:</strong> Automatizar inspeções de rotina em áreas 
                        com histórico de 100% de conformidade nos últimos 6 meses.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
