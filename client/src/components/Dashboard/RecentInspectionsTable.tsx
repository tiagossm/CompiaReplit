import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, Edit, Play, QrCode } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Inspection } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

export default function RecentInspectionsTable() {
  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['/api/inspections'],
  });

  if (isLoading) {
    return (
      <Card className="lg:col-span-2" data-testid="recent-inspections-loading">
        <CardHeader>
          <CardTitle>Inspeções Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentInspections = inspections?.slice(0, 5) || [];

  return (
    <Card className="lg:col-span-2" data-testid="recent-inspections-table">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading font-semibold text-foreground">
            Inspeções Recentes
          </CardTitle>
          <Button variant="link" className="text-sm font-medium text-primary hover:text-primary/80" data-testid="view-all-inspections">
            Ver todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentInspections.length === 0 ? (
          <div className="text-center py-8" data-testid="no-inspections">
            <p className="text-muted-foreground">Nenhuma inspeção encontrada</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full" data-testid="inspections-table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3">
                    Local
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3">
                    Inspetor
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3">
                    Data
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentInspections.map((inspection) => (
                  <tr 
                    key={inspection.id} 
                    className="hover:bg-muted/50 transition-colors"
                    data-testid={`inspection-row-${inspection.id}`}
                  >
                    <td className="py-4">
                      <div>
                        <div className="font-medium text-foreground" data-testid={`inspection-title-${inspection.id}`}>
                          {inspection.title}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`inspection-location-${inspection.id}`}>
                          {inspection.location}
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {inspection.inspectorId.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-foreground">
                          Inspetor
                        </span>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge 
                        className={STATUS_COLORS[inspection.status as keyof typeof STATUS_COLORS]}
                        data-testid={`inspection-status-${inspection.id}`}
                      >
                        {STATUS_LABELS[inspection.status as keyof typeof STATUS_LABELS]}
                      </Badge>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground" data-testid={`inspection-date-${inspection.id}`}>
                      {inspection.completedAt 
                        ? new Date(inspection.completedAt).toLocaleDateString('pt-BR')
                        : inspection.createdAt 
                          ? new Date(inspection.createdAt).toLocaleDateString('pt-BR')
                          : 'Data não informada'
                      }
                    </td>
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-primary hover:text-primary/80"
                          data-testid={`view-inspection-${inspection.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {inspection.status === 'completed' ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-foreground"
                            data-testid={`download-inspection-${inspection.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        ) : inspection.status === 'draft' ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary hover:text-primary/80"
                            data-testid={`start-inspection-${inspection.id}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-foreground"
                            data-testid={`edit-inspection-${inspection.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {inspection.qrCode && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-foreground"
                            data-testid={`qr-inspection-${inspection.id}`}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
