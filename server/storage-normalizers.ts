import { randomUUID } from "crypto";
import type {
  InsertOrganization,
  InsertUser,
  InsertInvitation,
  InsertInspection,
  InsertActionPlan,
  InsertFile,
  InsertChecklistTemplate,
  InsertChecklistFolder,
  InsertActivityLog,
  InsertCompany,
  InsertCompanyLocation
} from "@shared/schema";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const str = String(value).trim();
  return str.length === 0 ? null : str;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function toNumberOrDefault(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(item => (item === undefined || item === null ? "" : String(item).trim()))
      .filter(item => item.length > 0);
  }
  if (typeof value === "string") {
    if (!value.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => (item === undefined || item === null ? "" : String(item).trim()))
          .filter(item => item.length > 0);
      }
    } catch {
      // Ignore and fallback to comma splitting
    }
    return value
      .split(",")
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  return [];
}

export function prepareOrganization(org: InsertOrganization) {
  const now = new Date();
  return {
    ...org,
    parentId: toNullableString((org as any).parentId),
    plan: (org as any).plan ?? "basic",
    maxUsers: toNumberOrDefault((org as any).maxUsers, 10),
    maxSubsidiaries: toNumberOrDefault((org as any).maxSubsidiaries, 3),
    isActive: toBoolean((org as any).isActive, true),
    address: toNullableString((org as any).address),
    phone: toNullableString((org as any).phone),
    email: toNullableString((org as any).email),
    cnpj: toNullableString((org as any).cnpj),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareUser(user: InsertUser) {
  const now = new Date();
  return {
    ...user,
    organizationId: toNullableString((user as any).organizationId),
    isActive: toBoolean((user as any).isActive, true),
    lastLoginAt: toDate((user as any).lastLoginAt),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareInvitation(invitation: InsertInvitation) {
  const now = new Date();
  const expiresAt = toDate((invitation as any).expiresAt) ?? new Date(now.getTime() + WEEK_IN_MS);
  return {
    ...invitation,
    token: (invitation as any).token ?? randomUUID(),
    isAccepted: toBoolean((invitation as any).isAccepted, false),
    expiresAt,
    createdAt: now
  } as any;
}

export function prepareInspection(inspection: InsertInspection) {
  const now = new Date();
  const checklist = parseJsonValue((inspection as any).checklist, [] as any);
  const findings = parseJsonValue((inspection as any).findings, [] as any);
  const priority = (inspection as any).priority ?? "medium";
  const aiAssistantId = toNullableString((inspection as any).aiAssistantId) ?? "GENERAL";
  const actionPlanType = (inspection as any).actionPlanType ?? "5W2H";

  return {
    ...inspection,
    description: toNullableString((inspection as any).description),
    checklist,
    findings,
    recommendations: toNullableString((inspection as any).recommendations),
    aiAnalysis: toNullableString((inspection as any).aiAnalysis),
    qrCode: toNullableString((inspection as any).qrCode),
    scheduledAt: toDate((inspection as any).scheduledAt),
    startedAt: toDate((inspection as any).startedAt),
    completedAt: toDate((inspection as any).completedAt),
    status: (inspection as any).status ?? "draft",
    checklistTemplateId: toNullableString((inspection as any).checklistTemplateId),
    priority,
    companyName: toNullableString((inspection as any).companyName),
    zipCode: toNullableString((inspection as any).zipCode),
    fullAddress: toNullableString((inspection as any).fullAddress),
    latitude: toNumberOrNull((inspection as any).latitude),
    longitude: toNumberOrNull((inspection as any).longitude),
    technicianName: toNullableString((inspection as any).technicianName),
    technicianEmail: toNullableString((inspection as any).technicianEmail),
    companyResponsibleName: toNullableString((inspection as any).companyResponsibleName),
    aiAssistantId,
    actionPlanType,
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareActionPlan(actionPlan: InsertActionPlan) {
  const now = new Date();
  return {
    ...actionPlan,
    description: toNullableString((actionPlan as any).description),
    when: toDate((actionPlan as any).when) ?? now,
    howMuch: toNullableString((actionPlan as any).howMuch),
    status: (actionPlan as any).status ?? "pending",
    priority: (actionPlan as any).priority ?? "medium",
    organizationId: (actionPlan as any).organizationId,
    assignedTo: toNullableString((actionPlan as any).assignedTo),
    dueDate: toDate((actionPlan as any).dueDate),
    completedAt: toDate((actionPlan as any).completedAt),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareFile(file: InsertFile) {
  const now = new Date();
  return {
    ...file,
    size: toNumberOrDefault((file as any).size, 0),
    inspectionId: toNullableString((file as any).inspectionId),
    actionPlanId: toNullableString((file as any).actionPlanId),
    createdAt: now
  } as any;
}

export function prepareChecklistTemplate(template: InsertChecklistTemplate) {
  const now = new Date();
  const items = parseJsonValue((template as any).items, [] as any);
  const tags = toStringArray((template as any).tags);
  const fieldCount = toNumberOrDefault((template as any).fieldCount, Array.isArray(items) ? items.length : 0);

  return {
    ...template,
    description: toNullableString((template as any).description),
    folderId: toNullableString((template as any).folderId),
    items,
    tags,
    version: toNumberOrDefault((template as any).version, 1),
    parentTemplateId: toNullableString((template as any).parentTemplateId),
    isActive: toBoolean((template as any).isActive, true),
    isDefault: toBoolean((template as any).isDefault, false),
    isPublic: toBoolean((template as any).isPublic, false),
    parentCategoryId: toNullableString((template as any).parentCategoryId),
    categoryPath: toNullableString((template as any).categoryPath),
    isCategoryFolder: toBoolean((template as any).isCategoryFolder, false),
    folderColor: toNullableString((template as any).folderColor) ?? "#3B82F6",
    folderIcon: toNullableString((template as any).folderIcon) ?? "folder",
    displayOrder: toNumberOrDefault((template as any).displayOrder, 0),
    fieldCount,
    usageCount: toNumberOrDefault((template as any).usageCount, 0),
    lastUsedAt: toDate((template as any).lastUsedAt),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareChecklistFolder(folder: InsertChecklistFolder) {
  const now = new Date();
  return {
    ...folder,
    description: toNullableString((folder as any).description),
    parentId: toNullableString((folder as any).parentId),
    icon: toNullableString((folder as any).icon) ?? "folder",
    color: toNullableString((folder as any).color) ?? "#3B82F6",
    order: toNumberOrDefault((folder as any).order, 0),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareActivityLog(log: InsertActivityLog) {
  const now = new Date();
  return {
    ...log,
    entityType: toNullableString((log as any).entityType),
    entityId: toNullableString((log as any).entityId),
    details: parseJsonValue((log as any).details, {} as any),
    createdAt: now
  } as any;
}

export function prepareCompany(company: InsertCompany) {
  const now = new Date();
  const state = toNullableString((company as any).state);
  return {
    ...company,
    cnpj: toNullableString((company as any).cnpj),
    email: toNullableString((company as any).email),
    phone: toNullableString((company as any).phone),
    website: toNullableString((company as any).website),
    address: toNullableString((company as any).address),
    city: toNullableString((company as any).city),
    state: state ? state.toUpperCase() : null,
    zipCode: toNullableString((company as any).zipCode),
    responsibleName: toNullableString((company as any).responsibleName),
    responsibleRole: toNullableString((company as any).responsibleRole),
    responsibleEmail: toNullableString((company as any).responsibleEmail),
    responsiblePhone: toNullableString((company as any).responsiblePhone),
    technicalResponsibleName: toNullableString((company as any).technicalResponsibleName),
    technicalResponsibleRole: toNullableString((company as any).technicalResponsibleRole),
    technicalResponsibleEmail: toNullableString((company as any).technicalResponsibleEmail),
    technicalResponsiblePhone: toNullableString((company as any).technicalResponsiblePhone),
    technicalResponsibleCertification: toNullableString((company as any).technicalResponsibleCertification),
    notes: toNullableString((company as any).notes),
    isActive: toBoolean((company as any).isActive, true),
    createdAt: now,
    updatedAt: now
  } as any;
}

export function prepareCompanyLocation(location: InsertCompanyLocation) {
  const now = new Date();
  const state = toNullableString((location as any).state);
  return {
    ...location,
    type: toNullableString((location as any).type),
    address: toNullableString((location as any).address),
    city: toNullableString((location as any).city),
    state: state ? state.toUpperCase() : null,
    zipCode: toNullableString((location as any).zipCode),
    latitude: toNumberOrNull((location as any).latitude),
    longitude: toNumberOrNull((location as any).longitude),
    responsibleName: toNullableString((location as any).responsibleName),
    responsiblePhone: toNullableString((location as any).responsiblePhone),
    responsibleEmail: toNullableString((location as any).responsibleEmail),
    notes: toNullableString((location as any).notes),
    isActive: toBoolean((location as any).isActive, true),
    createdAt: now,
    updatedAt: now
  } as any;
}
