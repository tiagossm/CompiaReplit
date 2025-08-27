import { storage } from "../storage";
import type { Inspection, ActionPlan, Organization, User } from "@shared/schema";

export interface AnalyticsMetrics {
  inspections: {
    total: number;
    completed: number;
    pending: number;
    averageCompletionTime: number;
    trendsLastMonth: number;
  };
  compliance: {
    rate: number;
    violations: number;
    resolved: number;
    trending: "up" | "down" | "stable";
    byCategory: Record<string, number>;
  };
  actionPlans: {
    total: number;
    completed: number;
    overdue: number;
    averageResolutionTime: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  riskMatrix: {
    high: string[];
    medium: string[];
    low: string[];
  };
  productivity: {
    inspectionsPerInspector: Record<string, number>;
    averageInspectionTime: number;
    peakHours: string[];
  };
}

export async function calculateAnalytics(organizationId: string, period: { start: Date; end: Date }): Promise<AnalyticsMetrics> {
  const inspections = await storage.getInspectionsByOrganization(organizationId);
  const actionPlans = await storage.getActionPlansByOrganization(organizationId);
  const users = await storage.getUsersByOrganization(organizationId);
  
  // Filter by period
  const periodInspections = inspections.filter(i => 
    i.createdAt && i.createdAt >= period.start && i.createdAt <= period.end
  );
  
  const periodActionPlans = actionPlans.filter(a => 
    a.createdAt && a.createdAt >= period.start && a.createdAt <= period.end
  );
  
  // Calculate completion times
  const completionTimes = periodInspections
    .filter(i => i.completedAt && i.startedAt)
    .map(i => (i.completedAt!.getTime() - i.startedAt!.getTime()) / (1000 * 60 * 60)); // in hours
  
  const avgCompletionTime = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    : 0;
  
  // Calculate compliance rate
  const totalChecks = periodInspections.reduce((sum, i) => {
    const checklist = i.checklist as any[] || [];
    return sum + checklist.length;
  }, 0);
  
  const compliantChecks = periodInspections.reduce((sum, i) => {
    const checklist = i.checklist as any[] || [];
    return sum + checklist.filter((item: any) => item.isCompliant === true).length;
  }, 0);
  
  const complianceRate = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 100;
  
  // Calculate violations by category
  const violationsByCategory: Record<string, number> = {};
  periodInspections.forEach(inspection => {
    const findings = inspection.findings as any[] || [];
    findings.forEach((finding: any) => {
      const category = finding.standard || "Geral";
      violationsByCategory[category] = (violationsByCategory[category] || 0) + 1;
    });
  });
  
  // Calculate action plan metrics
  const overduePlans = periodActionPlans.filter(plan => 
    plan.dueDate && new Date(plan.dueDate) < new Date() && plan.status !== "completed"
  );
  
  const resolutionTimes = periodActionPlans
    .filter(p => p.completedAt && p.createdAt)
    .map(p => (p.completedAt!.getTime() - p.createdAt!.getTime()) / (1000 * 60 * 60 * 24)); // in days
  
  const avgResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : 0;
  
  // Calculate productivity metrics
  const inspectionsPerInspector: Record<string, number> = {};
  periodInspections.forEach(inspection => {
    inspectionsPerInspector[inspection.inspectorId] = 
      (inspectionsPerInspector[inspection.inspectorId] || 0) + 1;
  });
  
  // Identify risk areas
  const riskAreas = {
    high: [] as string[],
    medium: [] as string[],
    low: [] as string[]
  };
  
  Object.entries(violationsByCategory).forEach(([category, count]) => {
    if (count > 10) riskAreas.high.push(category);
    else if (count > 5) riskAreas.medium.push(category);
    else riskAreas.low.push(category);
  });
  
  // Calculate trends
  const lastMonthStart = new Date(period.start);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthInspections = inspections.filter(i => 
    i.createdAt && i.createdAt >= lastMonthStart && i.createdAt < period.start
  ).length;
  
  const trend = periodInspections.length - lastMonthInspections;
  
  return {
    inspections: {
      total: periodInspections.length,
      completed: periodInspections.filter(i => i.status === "completed").length,
      pending: periodInspections.filter(i => i.status === "draft" || i.status === "in_progress").length,
      averageCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      trendsLastMonth: trend
    },
    compliance: {
      rate: Math.round(complianceRate * 10) / 10,
      violations: Object.values(violationsByCategory).reduce((a, b) => a + b, 0),
      resolved: periodActionPlans.filter(p => p.status === "completed").length,
      trending: trend > 0 ? "up" : trend < 0 ? "down" : "stable",
      byCategory: violationsByCategory
    },
    actionPlans: {
      total: periodActionPlans.length,
      completed: periodActionPlans.filter(p => p.status === "completed").length,
      overdue: overduePlans.length,
      averageResolutionTime: Math.round(avgResolutionTime * 10) / 10,
      bySeverity: {
        critical: periodActionPlans.filter(p => p.priority === "critical").length,
        high: periodActionPlans.filter(p => p.priority === "high").length,
        medium: periodActionPlans.filter(p => p.priority === "medium").length,
        low: periodActionPlans.filter(p => p.priority === "low").length
      }
    },
    riskMatrix: riskAreas,
    productivity: {
      inspectionsPerInspector,
      averageInspectionTime: Math.round(avgCompletionTime * 10) / 10,
      peakHours: ["09:00-11:00", "14:00-16:00"] // Simplified for now
    }
  };
}

export async function generateExecutiveReport(organizationId: string): Promise<any> {
  const org = await storage.getOrganization(organizationId);
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  const analytics = await calculateAnalytics(organizationId, {
    start: startOfMonth,
    end: currentDate
  });
  
  return {
    organization: org,
    period: {
      start: startOfMonth,
      end: currentDate
    },
    executive_summary: {
      compliance_score: analytics.compliance.rate,
      risk_level: analytics.compliance.rate > 90 ? "low" : analytics.compliance.rate > 70 ? "medium" : "high",
      key_achievements: [
        `${analytics.inspections.completed} inspeções concluídas`,
        `${analytics.compliance.rate}% de conformidade`,
        `${analytics.actionPlans.completed} planos de ação resolvidos`
      ],
      areas_of_concern: Object.entries(analytics.compliance.byCategory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([category, count]) => ({
          area: category,
          violations: count
        }))
    },
    metrics: analytics,
    recommendations: generateRecommendations(analytics)
  };
}

function generateRecommendations(analytics: AnalyticsMetrics): string[] {
  const recommendations = [];
  
  if (analytics.compliance.rate < 80) {
    recommendations.push("Implementar treinamento adicional sobre conformidade de segurança");
  }
  
  if (analytics.actionPlans.overdue > 5) {
    recommendations.push("Revisar e priorizar planos de ação em atraso");
  }
  
  if (analytics.riskMatrix.high.length > 0) {
    recommendations.push(`Foco imediato nas áreas de alto risco: ${analytics.riskMatrix.high.join(", ")}`);
  }
  
  if (analytics.inspections.averageCompletionTime > 4) {
    recommendations.push("Otimizar processo de inspeção para reduzir tempo de conclusão");
  }
  
  return recommendations;
}

export function generateTrendAnalysis(data: any[], period: string): any {
  // Análise de tendências temporais
  const trends = {
    daily: [] as any[],
    weekly: [] as any[],
    monthly: [] as any[]
  };
  
  // Group data by period
  const grouped = data.reduce((acc, item) => {
    const date = new Date(item.createdAt);
    const key = period === 'daily' ? date.toISOString().split('T')[0] :
                period === 'weekly' ? `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}` :
                `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Calculate metrics for each period
  Object.entries(grouped).forEach(([key, items]) => {
    const periodData = {
      period: key,
      count: items.length,
      compliance: calculateComplianceForItems(items),
      avgResolutionTime: calculateAvgResolutionTime(items)
    };
    
    if (period === 'daily') trends.daily.push(periodData);
    else if (period === 'weekly') trends.weekly.push(periodData);
    else trends.monthly.push(periodData);
  });
  
  return trends;
}

function calculateComplianceForItems(items: any[]): number {
  const total = items.reduce((sum, item) => {
    const checklist = item.checklist || [];
    return sum + checklist.length;
  }, 0);
  
  const compliant = items.reduce((sum, item) => {
    const checklist = item.checklist || [];
    return sum + checklist.filter((c: any) => c.isCompliant).length;
  }, 0);
  
  return total > 0 ? (compliant / total) * 100 : 100;
}

function calculateAvgResolutionTime(items: any[]): number {
  const resolved = items.filter(item => item.completedAt);
  if (resolved.length === 0) return 0;
  
  const times = resolved.map(item => {
    const created = new Date(item.createdAt).getTime();
    const completed = new Date(item.completedAt).getTime();
    return (completed - created) / (1000 * 60 * 60 * 24); // days
  });
  
  return times.reduce((a, b) => a + b, 0) / times.length;
}