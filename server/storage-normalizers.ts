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

/* ----------------- UTILITÁRIOS ----------------- */
function parseDate(input: unknown, fallback: Date | null = null): Date | null {
  if (input instanceof Date) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function parseNumber(input: unknown, fallback: number | null = null): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function parseBoolean(input: unknown, fallback: boolean): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function ensureArray<T>(input: unknown, fallback: T[]): T[] {
  if (Array.isArray(input)) return input as T[];
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }
  return fallback;
}

function ensureObject<T extends UnknownRecord>(input: unknown, fallback: T): T {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as T;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
    } catch {}
  }
  return fallback;
}

function normalizeNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function normalizeId(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : randomUUID();
}

function now(): Date {
  return new Date();
}

/* ----------------- PREPARES ----------------- */

export function prepareOrganization(org: Partial<InsertOrganization> & UnknownRecord): InsertOrganization {
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

export function prepareUser(user: Partial<InsertUser> & UnknownRecord): InsertUser {
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

export function prepareInvitation(inv: Partial<InsertInvitation> & UnknownRecord): InsertInvitation {
  const timestamp = now();
  const expiresAt = parseDate(inv.expiresAt) ?? (() => {
    const expiry = new Date(timestamp);
    expiry.setDate(expiry.getDate() + INVITATION_EXPIRATION_DAYS);
    return expiry;
  })();
  return {
    id: normalizeId(inv.id),
    email: inv.email ?? "",
    role: inv.role ?? "client",
    organizationId: inv.organizationId ?? "",
    invitedBy: inv.invitedBy ?? "",
    token: normalizeNullableString(inv.token) ?? randomUUID(),
    isAccepted: parseBoolean(inv.isAccepted, false),
    expiresAt,
    createdAt: parseDate(inv.createdAt, timestamp) ?? timestamp
  };
}

export function prepareInspection(ins: Partial<InsertInspection> & UnknownRecord): InsertInspection {
  const timestamp = now();
  return {
    id: normalizeId(ins.id),
    title: ins.title ?? "",
    description: normalizeNullableString(ins.description),
    location: ins.location ?? "",
    status: ins.status ?? "draft",
    organizationId: ins.organizationId ?? "",
    inspectorId: ins.inspectorId ?? "admin-id",
    checklist: ensureArray(ins.checklist, []),
    findings: ensureArray(ins.findings, []),
    recommendations: normalizeNullableString(ins.recommendations),
    aiAnalysis: normalizeNullableString(ins.aiAnalysis),
    qrCode: normalizeNullableString(ins.qrCode),
    scheduledAt: parseDate(ins.scheduledAt, timestamp) ?? timestamp,
    startedAt: parseDate(ins.startedAt),
    completedAt: parseDate(ins.completedAt),
    createdAt: parseDate(ins.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(ins.updatedAt, timestamp) ?? timestamp,
    checklistTemplateId: normalizeNullableString(ins.checklistTemplateId),
    priority: ins.priority ?? "medium",
    companyName: normalizeNullableString(ins.companyName),
    zipCode: normalizeNullableString(ins.zipCode),
    fullAddress: normalizeNullableString(ins.fullAddress),
    latitude: parseNumber(ins.latitude),
    longitude: parseNumber(ins.longitude),
    technicianName: normalizeNullableString(ins.technicianName),
    technicianEmail: normalizeNullableString(ins.technicianEmail),
    companyResponsibleName: normalizeNullableString(ins.companyResponsibleName),
    aiAssistantId: ins.aiAssistantId ?? "GENERAL",
    actionPlanType: ins.actionPlanType ?? "5W2H"
  };
}

export function prepareActionPlan(ap: Partial<InsertActionPlan> & UnknownRecord): InsertActionPlan {
  const timestamp = now();
  return {
    id: normalizeId(ap.id),
    inspectionId: ap.inspectionId ?? "",
    title: ap.title ?? "",
    description: normalizeNullableString(ap.description),
    what: ap.what ?? "",
    why: ap.why ?? "",
    where: ap.where ?? "",
    when: parseDate(ap.when, timestamp) ?? timestamp,
    who: ap.who ?? "",
    how: ap.how ?? "",
    howMuch: normalizeNullableString(ap.howMuch),
    status: ap.status ?? "pending",
    priority: ap.priority ?? "medium",
    organizationId: ap.organizationId ?? "",
    assignedTo: normalizeNullableString(ap.assignedTo),
    dueDate: parseDate(ap.dueDate),
    completedAt: parseDate(ap.completedAt, null),
    createdAt: parseDate(ap.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(ap.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareFile(file: Partial<InsertFile> & UnknownRecord): InsertFile {
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

export function prepareChecklistTemplate(t: Partial<InsertChecklistTemplate> & UnknownRecord): InsertChecklistTemplate {
  const timestamp = now();
  return {
    id: normalizeId(t.id),
    name: t.name ?? "",
    description: normalizeNullableString(t.description),
    category: t.category ?? "",
    folderId: normalizeNullableString(t.folderId),
    organizationId: t.organizationId ?? "",
    items: ensureArray(t.items, []),
    tags: ensureArray(t.tags, []),
    version: parseNumber(t.version, 1) ?? 1,
    parentTemplateId: normalizeNullableString(t.parentTemplateId),
    isActive: parseBoolean(t.isActive, true),
    isDefault: parseBoolean(t.isDefault, false),
    isPublic: parseBoolean(t.isPublic, false),
    parentCategoryId: normalizeNullableString(t.parentCategoryId),
    categoryPath: normalizeNullableString(t.categoryPath),
    isCategoryFolder: parseBoolean(t.isCategoryFolder, false),
    folderColor: t.folderColor ?? "#3B82F6",
    folderIcon: t.folderIcon ?? "folder",
    displayOrder: parseNumber(t.displayOrder, 0) ?? 0,
    fieldCount: parseNumber(t.fieldCount, 0) ?? 0,
    usageCount: parseNumber(t.usageCount, 0) ?? 0,
    lastUsedAt: parseDate(t.lastUsedAt),
    createdBy: t.createdBy ?? "",
    createdAt: parseDate(t.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(t.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareChecklistFolder(f: Partial<InsertChecklistFolder> & UnknownRecord): InsertChecklistFolder {
  const timestamp = now();
  return {
    id: normalizeId(f.id),
    name: f.name ?? "",
    description: normalizeNullableString(f.description),
    parentId: normalizeNullableString(f.parentId),
    organizationId: f.organizationId ?? "",
    icon: f.icon ?? "folder",
    color: f.color ?? "#3B82F6",
    order: parseNumber(f.order, 0) ?? 0,
    createdBy: f.createdBy ?? "",
    createdAt: parseDate(f.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(f.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareActivityLog(log: Partial<InsertActivityLog> & UnknownRecord): InsertActivityLog {
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

export function prepareCompany(c: Partial<InsertCompany> & UnknownRecord): InsertCompany {
  const timestamp = now();
  return {
    id: normalizeId(c.id),
    name: c.name ?? "",
    cnpj: normalizeNullableString(c.cnpj),
    email: normalizeNullableString(c.email),
    phone: normalizeNullableString(c.phone),
    website: normalizeNullableString(c.website),
    address: normalizeNullableString(c.address),
    city: normalizeNullableString(c.city),
    state: normalizeNullableString(c.state),
    zipCode: normalizeNullableString(c.zipCode),
    responsibleName: normalizeNullableString(c.responsibleName),
    responsibleRole: normalizeNullableString(c.responsibleRole),
    responsibleEmail: normalizeNullableString(c.responsibleEmail),
    responsiblePhone: normalizeNullableString(c.responsiblePhone),
    technicalResponsibleName: normalizeNullableString(c.technicalResponsibleName),
    technicalResponsibleRole: normalizeNullableString(c.technicalResponsibleRole),
    technicalResponsibleEmail: normalizeNullableString(c.technicalResponsibleEmail),
    technicalResponsiblePhone: normalizeNullableString(c.technicalResponsiblePhone),
    technicalResponsibleCertification: normalizeNullableString(c.technicalResponsibleCertification),
    organizationId: c.organizationId ?? "",
    isActive: parseBoolean(c.isActive, true),
    notes: normalizeNullableString(c.notes),
    createdBy: c.createdBy ?? "",
    createdAt: parseDate(c.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(c.updatedAt, timestamp) ?? timestamp
  };
}

export function prepareCompanyLocation(loc: Partial<InsertCompanyLocation> & UnknownRecord): InsertCompanyLocation {
  const timestamp = now();
  return {
    id: normalizeId(loc.id),
    companyId: loc.companyId ?? "",
    name: loc.name ?? "",
    type: normalizeNullableString(loc.type),
    address: normalizeNullableString(loc.address),
    city: normalizeNullableString(loc.city),
    state: normalizeNullableString(loc.state),
    zipCode: normalizeNullableString(loc.zipCode),
    latitude: parseNumber(loc.latitude),
    longitude: parseNumber(loc.longitude),
    responsibleName: normalizeNullableString(loc.responsibleName),
    responsiblePhone: normalizeNullableString(loc.responsiblePhone),
    responsibleEmail: normalizeNullableString(loc.responsibleEmail),
    isActive: parseBoolean(loc.isActive, true),
    notes: normalizeNullableString(loc.notes),
    createdBy: loc.createdBy ?? "",
    createdAt: parseDate(loc.createdAt, timestamp) ?? timestamp,
    updatedAt: parseDate(loc.updatedAt, timestamp) ?? timestamp
  };
}
