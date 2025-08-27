import type { 
  Organization, User, Invitation, Inspection, ActionPlan, ActivityLog 
} from "@shared/schema";

export type { Organization, User, Invitation, Inspection, ActionPlan, ActivityLog };

export interface DashboardStats {
  inspections: number;
  nonCompliances: number;
  completedActions: number;
  activeOrganizations: number;
  complianceRate: number;
  actionCompletionRate: number;
  overdueActions: number;
  activeUsers: number;
}

export interface AIInsight {
  type: "pattern" | "trend" | "recommendation";
  title: string;
  description: string;
  confidence: number;
}

export interface InspectionReport {
  id: string;
  title: string;
  location: string;
  status: string;
  inspector: string;
  scheduledAt?: Date;
  completedAt?: Date;
  findings: any[];
  recommendations?: string;
  aiAnalysis?: string;
  actionPlans: any[];
  metadata: {
    generatedAt: Date;
    version: string;
  };
}

export interface ComplianceReport {
  organization: {
    id: string;
    name: string;
    type: string;
  };
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalInspections: number;
    completedInspections: number;
    totalNonCompliances: number;
    completedActions: number;
    pendingActions: number;
    overdueActions: number;
  };
  compliance: {
    rate: number;
    trend: string;
  };
  inspections: any[];
  actionPlans: any[];
  metadata: {
    generatedAt: Date;
    version: string;
    type: string;
  };
}

export interface ChecklistItem {
  id: string;
  item: string;
  standard?: string;
  isCompliant?: boolean;
  notes?: string;
}

export interface Finding {
  item: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  standard?: string;
  evidence?: string[];
}

export interface UserWithOrganization extends User {
  organization?: Organization;
}

export interface InvitationWithDetails extends Invitation {
  invitedByUser?: User;
  organization?: Organization;
}
