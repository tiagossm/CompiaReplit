import { randomUUID } from "crypto";
import {
  type InsertOrganization,
  type InsertUser,
  type InsertInvitation,
  type InsertInspection,
  type InsertActionPlan,
  type InsertFile,
  type InsertChecklistTemplate,
  type InsertChecklistFolder,
  type InsertActivityLog,
  type InsertCompany,
  type InsertCompanyLocation
} from "@shared/schema";

type UnknownRecord = Record<string, unknown>;

const INVITATION_EXPIRATION_DAYS = 7;

function parseDate(input: unknown, fallback: Date | null = null): Date | null {
  if (input instanceof Date) {
    return input;
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function parseNumber(input: unknown, fallback: number | null = null): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function parseBoolean(input: unknown, fallback: boolean): boolean {
  if (typeof input === "boolean") {
    return input;
  }

  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function ensureArray<T>(input: unknown, fallback: T[]): T[] {
  if (Array.isArray(input)) {
    return input as T[];
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    } catch {
      // Ignore parsing errors and fall back to default
    }
  }

  return fallback;
}

function ensureObject<T extends UnknownRecord>(input: unknown, fallback: T): T {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as T;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // Ignore parsing errors and fall back to default
    }
  }

  return fallback;
}

function normalizeNullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizeId(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return randomUUID();
}

function now(): Date {
  return new Date();
}

export function prepareOrganization(org: Partial<InsertOrganization> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(org.id),
    name: org.name ?? "",
    type: org.type ?? "enterprise",
    parentId: normalizeNullableString(org.parentId),
    plan: org.plan ?? "basic",
    maxUsers: parseNumber(org.maxUsers, 10) ?? 10,
    maxSubsidiaries: parseNumber(org.maxSubsidiaries, 3) ?? 3,
    isActive: parseBoolean(org.isActive, true),
    address: normalizeNullableString(org.address),
    phone: normalizeNullableString(org.phone),
    email: normalizeNullableString(org.email),
    cnpj: normalizeNullableString(org.cnpj),
    createdAt: parseDate(org.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(org.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareUser(user: Partial<InsertUser> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(user.id),
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role ?? "inspector",
    organizationId: normalizeNullableString(user.organizationId),
    isActive: parseBoolean(user.isActive, true),
    lastLoginAt: parseDate(user.lastLoginAt, null),
    createdAt: parseDate(user.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(user.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareInvitation(invitation: Partial<InsertInvitation> & UnknownRecord): UnknownRecord {
  const timestamp = now();
  const expiresAt = parseDate(invitation.expiresAt) ?? (() => {
    const expiry = new Date(timestamp);
    expiry.setDate(expiry.getDate() + INVITATION_EXPIRATION_DAYS);
    return expiry;
  })();

  return {
    id: normalizeId(invitation.id),
    email: invitation.email ?? "",
    role: invitation.role ?? "client",
    organizationId: invitation.organizationId ?? "",
    invitedBy: invitation.invitedBy ?? "",
    token: normalizeNullableString(invitation.token) ?? randomUUID(),
    isAccepted: parseBoolean(invitation.isAccepted, false),
    expiresAt,
    createdAt: parseDate(invitation.createdAt, timestamp) ?? timestamp
  };
}

export function prepareInspection(inspection: Partial<InsertInspection> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(inspection.id),
    title: inspection.title ?? "",
    description: normalizeNullableString(inspection.description),
    location: inspection.location ?? "",
    status: inspection.status ?? "draft",
    organizationId: inspection.organizationId ?? "",
    inspectorId: inspection.inspectorId ?? "admin-id",
    checklist: ensureArray(inspection.checklist, []),
    findings: ensureArray(inspection.findings, []),
    recommendations: normalizeNullableString(inspection.recommendations),
    aiAnalysis: normalizeNullableString(inspection.aiAnalysis),
    qrCode: normalizeNullableString(inspection.qrCode),
    scheduledAt: parseDate(inspection.scheduledAt, timestamp) ?? timestamp,
    startedAt: parseDate(inspection.startedAt),
    completedAt: parseDate(inspection.completedAt),
    createdAt: parseDate(inspection.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(inspection.updatedAt, timestamp) ?? timestamp,
    checklistTemplateId: normalizeNullableString(inspection.checklistTemplateId),
    priority: inspection.priority ?? "medium",
    companyName: normalizeNullableString(inspection.companyName),
    zipCode: normalizeNullableString(inspection.zipCode),
    fullAddress: normalizeNullableString(inspection.fullAddress),
    latitude: parseNumber(inspection.latitude),
    longitude: parseNumber(inspection.longitude),
    technicianName: normalizeNullableString(inspection.technicianName),
    technicianEmail: normalizeNullableString(inspection.technicianEmail),
    companyResponsibleName: normalizeNullableString(inspection.companyResponsibleName),
    aiAssistantId: inspection.aiAssistantId ?? "GENERAL",
    actionPlanType: inspection.actionPlanType ?? "5W2H"
  };
}

export function prepareActionPlan(actionPlan: Partial<InsertActionPlan> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(actionPlan.id),
    inspectionId: actionPlan.inspectionId ?? "",
    title: actionPlan.title ?? "",
    description: normalizeNullableString(actionPlan.description),
    what: actionPlan.what ?? "",
    why: actionPlan.why ?? "",
    where: actionPlan.where ?? "",
    when: parseDate(actionPlan.when, timestamp) ?? timestamp,
    who: actionPlan.who ?? "",
    how: actionPlan.how ?? "",
    howMuch: normalizeNullableString(actionPlan.howMuch),
    status: actionPlan.status ?? "pending",
    priority: actionPlan.priority ?? "medium",
    organizationId: actionPlan.organizationId ?? "",
    assignedTo: normalizeNullableString(actionPlan.assignedTo),
    dueDate: parseDate(actionPlan.dueDate),
    completedAt: parseDate(actionPlan.completedAt, null),
    createdAt: parseDate(actionPlan.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(actionPlan.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareFile(file: Partial<InsertFile> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(file.id),
    name: file.name ?? "",
    type: file.type ?? "",
    size: parseNumber(file.size, 0) ?? 0,
    url: file.url ?? "",
    inspectionId: normalizeNullableString(file.inspectionId),
    actionPlanId: normalizeNullableString(file.actionPlanId),
    organizationId: file.organizationId ?? "",
    uploadedBy: file.uploadedBy ?? "",
    createdAt: parseDate(file.createdAt, timestamp) ?? timestamp
  };
}

export function prepareChecklistTemplate(template: Partial<InsertChecklistTemplate> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(template.id),
    name: template.name ?? "",
    description: normalizeNullableString(template.description),
    category: template.category ?? "",
    folderId: normalizeNullableString(template.folderId),
    organizationId: template.organizationId ?? "",
    items: ensureArray(template.items, []),
    tags: ensureArray(template.tags, []),
    version: parseNumber(template.version, 1) ?? 1,
    parentTemplateId: normalizeNullableString(template.parentTemplateId),
    isActive: parseBoolean(template.isActive, true),
    isDefault: parseBoolean(template.isDefault, false),
    isPublic: parseBoolean(template.isPublic, false),
    parentCategoryId: normalizeNullableString(template.parentCategoryId),
    categoryPath: normalizeNullableString(template.categoryPath),
    isCategoryFolder: parseBoolean(template.isCategoryFolder, false),
    folderColor: template.folderColor ?? "#3B82F6",
    folderIcon: template.folderIcon ?? "folder",
    displayOrder: parseNumber(template.displayOrder, 0) ?? 0,
    fieldCount: parseNumber(template.fieldCount, 0) ?? 0,
    usageCount: parseNumber(template.usageCount, 0) ?? 0,
    lastUsedAt: parseDate(template.lastUsedAt),
    createdBy: template.createdBy ?? "",
    createdAt: parseDate(template.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(template.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareChecklistFolder(folder: Partial<InsertChecklistFolder> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(folder.id),
    name: folder.name ?? "",
    description: normalizeNullableString(folder.description),
    parentId: normalizeNullableString(folder.parentId),
    organizationId: folder.organizationId ?? "",
    icon: folder.icon ?? "folder",
    color: folder.color ?? "#3B82F6",
    order: parseNumber(folder.order, 0) ?? 0,
    createdBy: folder.createdBy ?? "",
    createdAt: parseDate(folder.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(folder.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareActivityLog(log: Partial<InsertActivityLog> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(log.id),
    userId: log.userId ?? "",
    organizationId: log.organizationId ?? "",
    action: log.action ?? "",
    entityType: normalizeNullableString(log.entityType),
    entityId: normalizeNullableString(log.entityId),
    details: ensureObject(log.details, {} as UnknownRecord),
    createdAt: parseDate(log.createdAt, timestamp) ?? timestamp
  };
}

export function prepareCompany(company: Partial<InsertCompany> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(company.id),
    name: company.name ?? "",
    cnpj: normalizeNullableString(company.cnpj),
    email: normalizeNullableString(company.email),
    phone: normalizeNullableString(company.phone),
    website: normalizeNullableString(company.website),
    address: normalizeNullableString(company.address),
    city: normalizeNullableString(company.city),
    state: normalizeNullableString(company.state),
    zipCode: normalizeNullableString(company.zipCode),
    responsibleName: normalizeNullableString(company.responsibleName),
    responsibleRole: normalizeNullableString(company.responsibleRole),
    responsibleEmail: normalizeNullableString(company.responsibleEmail),
    responsiblePhone: normalizeNullableString(company.responsiblePhone),
    technicalResponsibleName: normalizeNullableString(company.technicalResponsibleName),
    technicalResponsibleRole: normalizeNullableString(company.technicalResponsibleRole),
    technicalResponsibleEmail: normalizeNullableString(company.technicalResponsibleEmail),
    technicalResponsiblePhone: normalizeNullableString(company.technicalResponsiblePhone),
    technicalResponsibleCertification: normalizeNullableString(company.technicalResponsibleCertification),
    organizationId: company.organizationId ?? "",
    isActive: parseBoolean(company.isActive, true),
    notes: normalizeNullableString(company.notes),
    createdBy: company.createdBy ?? "",
    createdAt: parseDate(company.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(company.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareCompanyLocation(location: Partial<InsertCompanyLocation> & UnknownRecord): UnknownRecord {
  const timestamp = now();

  return {
    id: normalizeId(location.id),
    companyId: location.companyId ?? "",
    name: location.name ?? "",
    type: normalizeNullableString(location.type),
    address: normalizeNullableString(location.address),
    city: normalizeNullableString(location.city),
    state: normalizeNullableString(location.state),
    zipCode: normalizeNullableString(location.zipCode),
    latitude: parseNumber(location.latitude),
    longitude: parseNumber(location.longitude),
    responsibleName: normalizeNullableString(location.responsibleName),
    responsiblePhone: normalizeNullableString(location.responsiblePhone),
    responsibleEmail: normalizeNullableString(location.responsibleEmail),
    isActive: parseBoolean(location.isActive, true),
    notes: normalizeNullableString(location.notes),
    createdBy: location.createdBy ?? "",
    createdAt: parseDate(location.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(location.updatedAt, timestamp) ?? timestamp
  };
}
