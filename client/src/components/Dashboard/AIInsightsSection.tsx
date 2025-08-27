import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Lightbulb, TrendingUp, ArrowRight, Zap, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AIInsight } from "@/lib/types";

const iconMap = {
  pattern: Lightbulb,
  trend: TrendingUp,
  recommendation: Zap
};

const colorMap = {
  pattern: "bg-compia-green/10 text-compia-green",
  trend: "bg-compia-purple/10 text-compia-purple", 
  recommendation: "bg-compia-blue/10 text-compia-blue"
};

export default function AIInsightsSection() {
  const { data: insights, isLoading } = useQuery<AIInsight[]>({
    queryKey: ['/api/dashboard/insights'],
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-border" data-testid="ai-insights-loading">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-muted rounded-lg"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded"></div>
                <div className="h-3 w-48 bg-muted rounded"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-border" 
      data-testid="ai-insights-section"
    >
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-6" data-testid="ai-insights-header">
          <div className="w-10 h-10 bg-gradient-to-br from-compia-blue to-compia-purple rounded-lg flex items-center justify-center">
            <Brain className="text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground">Insights de IA</h3>
            <p className="text-sm text-muted-foreground">Análises e recomendações baseadas em dados</p>
          </div>
        </div>
        
        {!insights || insights.length === 0 ? (
          <div className="text-center py-8" data-testid="no-insights">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">Coletando dados para análise</p>
            <p className="text-sm text-muted-foreground">
              Os insights de IA estarão disponíveis após mais inspeções serem realizadas
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="insights-grid">
              {insights.slice(0, 4).map((insight, index) => {
                const Icon = iconMap[insight.type] || Lightbulb;
                const colorClass = colorMap[insight.type] || colorMap.pattern;
                
                return (
                  <div 
                    key={index}
                    className="bg-card/50 border border-border rounded-lg p-4 hover:bg-card/70 transition-colors"
                    data-testid={`ai-insight-${index}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-medium text-foreground mb-1"
                          data-testid={`insight-title-${index}`}
                        >
                          {insight.title}
                        </h4>
                        <p 
                          className="text-sm text-muted-foreground line-clamp-3"
                          data-testid={`insight-description-${index}`}
                        >
                          {insight.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-compia-green rounded-full"></div>
                            <span className="text-xs text-muted-foreground">
                              Confiança: {Math.round(insight.confidence * 100)}%
                            </span>
                          </div>
                          <Button 
                            variant="link" 
                            size="sm"
                            className="text-xs text-primary hover:text-primary/80 p-0 h-auto"
                            data-testid={`insight-details-${index}`}
                          >
                            Detalhes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-between" data-testid="insights-footer">
              <span className="text-xs text-muted-foreground">
                Última atualização: {new Date().toLocaleString('pt-BR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
              <Button 
                variant="link"
                className="text-sm font-medium text-primary hover:text-primary/80 flex items-center space-x-1 p-0"
                data-testid="view-full-report"
              >
                <span>Ver relatório completo</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
