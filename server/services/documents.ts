import QRCode from "qrcode";
import { randomUUID } from "crypto";

export interface DocumentMetadata {
  title: string;
  author: string;
  organization: string;
  createdAt: Date;
}

export async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#3B82F6',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    throw new Error("Falha na geração do QR Code: " + (error as Error).message);
  }
}

export function generateInspectionReport(inspection: any, actionPlans: any[]): any {
  return {
    id: inspection.id,
    title: inspection.title,
    location: inspection.location,
    status: inspection.status,
    inspector: inspection.inspectorId,
    scheduledAt: inspection.scheduledAt,
    completedAt: inspection.completedAt,
    findings: inspection.findings || [],
    recommendations: inspection.recommendations,
    aiAnalysis: inspection.aiAnalysis,
    actionPlans: actionPlans.map(plan => ({
      id: plan.id,
      title: plan.title,
      status: plan.status,
      priority: plan.priority,
      dueDate: plan.dueDate,
      assignedTo: plan.assignedTo,
      what: plan.what,
      why: plan.why,
      where: plan.where,
      when: plan.when,
      who: plan.who,
      how: plan.how,
      howMuch: plan.howMuch
    })),
    metadata: {
      generatedAt: new Date(),
      version: "1.0"
    }
  };
}

export function generateComplianceReport(organization: any, data: any): any {
  const { inspections, actionPlans, stats } = data;
  
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      type: organization.type
    },
    period: {
      start: stats.periodStart,
      end: stats.periodEnd
    },
    summary: {
      totalInspections: inspections.length,
      completedInspections: inspections.filter((i: any) => i.status === 'completed').length,
      totalNonCompliances: stats.nonCompliances,
      completedActions: actionPlans.filter((a: any) => a.status === 'completed').length,
      pendingActions: actionPlans.filter((a: any) => a.status === 'pending').length,
      overdueActions: actionPlans.filter((a: any) => 
        a.status !== 'completed' && new Date(a.dueDate) < new Date()
      ).length
    },
    compliance: {
      rate: stats.complianceRate,
      trend: stats.complianceTrend
    },
    inspections: inspections.map((i: any) => ({
      id: i.id,
      title: i.title,
      location: i.location,
      status: i.status,
      completedAt: i.completedAt,
      nonCompliances: i.findings?.length || 0
    })),
    actionPlans: actionPlans.map((a: any) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      dueDate: a.dueDate,
      isOverdue: new Date(a.dueDate) < new Date()
    })),
    metadata: {
      generatedAt: new Date(),
      version: "1.0",
      type: "compliance_report"
    }
  };
}

export function calculateComplianceMetrics(inspections: any[], actionPlans: any[]) {
  const totalItems = inspections.reduce((acc, inspection) => {
    return acc + (inspection.checklist?.length || 0);
  }, 0);

  const nonCompliantItems = inspections.reduce((acc, inspection) => {
    return acc + (inspection.findings?.length || 0);
  }, 0);

  const complianceRate = totalItems > 0 ? ((totalItems - nonCompliantItems) / totalItems) * 100 : 100;

  const completedActions = actionPlans.filter(plan => plan.status === 'completed').length;
  const totalActions = actionPlans.length;
  const actionCompletionRate = totalActions > 0 ? (completedActions / totalActions) * 100 : 0;

  const overdueActions = actionPlans.filter(plan => 
    plan.status !== 'completed' && new Date(plan.dueDate) < new Date()
  ).length;

  return {
    complianceRate: Math.round(complianceRate * 100) / 100,
    actionCompletionRate: Math.round(actionCompletionRate * 100) / 100,
    totalInspections: inspections.length,
    nonCompliances: nonCompliantItems,
    completedActions,
    overdueActions,
    totalActions
  };
}

export function generateInviteToken(): string {
  return randomUUID();
}

export function isTokenValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}
