import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ActionPlan } from "@/lib/types";
import { PRIORITY_COLORS, ACTION_STATUS_LABELS } from "@/lib/constants";

interface PriorityAction extends ActionPlan {
  isOverdue: boolean;
  daysUntilDue: number;
}

export default function PriorityActionsCard() {
  const { data: actionPlans, isLoading } = useQuery<ActionPlan[]>({
    queryKey: ['/api/action-plans'],
  });

  if (isLoading) {
    return (
      <Card data-testid="priority-actions-loading">
        <CardHeader>
          <CardTitle>Ações Prioritárias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const priorityActions: PriorityAction[] = (actionPlans || [])
    .filter(action => action.status !== 'completed' && action.status !== 'cancelled')
    .map(action => {
      const dueDate = action.dueDate ? new Date(action.dueDate) : null;
      const now = new Date();
      const isOverdue = dueDate ? dueDate < now : false;
      const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...action,
        isOverdue,
        daysUntilDue
      };
    })
    .sort((a, b) => {
      // Sort by: overdue first, then by priority, then by days until due
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      return a.daysUntilDue - b.daysUntilDue;
    })
    .slice(0, 5);

  const urgentActions = priorityActions.filter(action => 
    action.isOverdue || action.daysUntilDue <= 2 || action.priority === 'critical'
  ).length;

  return (
    <Card data-testid="priority-actions-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading font-semibold text-foreground">
            Ações Prioritárias
          </CardTitle>
          <Badge 
            className="bg-destructive/10 text-destructive"
            data-testid="urgent-actions-count"
          >
            {urgentActions} urgentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {priorityActions.length === 0 ? (
          <div className="text-center py-8" data-testid="no-priority-actions">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhuma ação prioritária</p>
          </div>
        ) : (
          <div className="space-y-4">
            {priorityActions.map((action) => {
              const priorityDot = action.priority === 'critical' || action.isOverdue 
                ? "bg-destructive" 
                : action.priority === 'high' || action.daysUntilDue <= 2
                ? "bg-yellow-500"
                : "bg-compia-green";

              const timeText = action.isOverdue
                ? `Atrasado ${Math.abs(action.daysUntilDue)} dia${Math.abs(action.daysUntilDue) !== 1 ? 's' : ''}`
                : action.daysUntilDue <= 2
                ? `Vence em ${action.daysUntilDue} dia${action.daysUntilDue !== 1 ? 's' : ''}`
                : `Vence em ${action.daysUntilDue} dias`;

              const timeColor = action.isOverdue 
                ? "text-destructive" 
                : action.daysUntilDue <= 2
                ? "text-yellow-600"
                : "text-muted-foreground";

              return (
                <div 
                  key={action.id}
                  className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`priority-action-${action.id}`}
                >
                  <div className={`w-2 h-2 ${priorityDot} rounded-full mt-2 flex-shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <p 
                      className="text-sm font-medium text-foreground line-clamp-2"
                      data-testid={`action-title-${action.id}`}
                    >
                      {action.title}
                    </p>
                    <p 
                      className="text-xs text-muted-foreground mt-1"
                      data-testid={`action-location-${action.id}`}
                    >
                      {action.where}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span 
                        className={`text-xs font-medium ${timeColor} flex items-center space-x-1`}
                        data-testid={`action-due-${action.id}`}
                      >
                        {action.isOverdue ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{timeText}</span>
                      </span>
                      <Button 
                        variant="link" 
                        size="sm"
                        className="text-xs text-primary hover:text-primary/80 p-0 h-auto font-medium"
                        data-testid={`view-action-${action.id}`}
                      >
                        Ver detalhes
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {priorityActions.length > 0 && (
          <Button 
            variant="link"
            className="w-full mt-4 text-center text-sm font-medium text-primary hover:text-primary/80 py-2"
            data-testid="view-all-actions"
          >
            Ver todas as ações ({actionPlans?.length || 0})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
