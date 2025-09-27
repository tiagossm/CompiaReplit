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

const INVITATION_EXPIRATION_DAYS = 7;

type PreparedRecord = Record<string, unknown>;

const sanitizeRecord = <T extends Record<string, unknown>>(record: T): T => {
  const result: Record<string, unknown> = { ...record };
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result as T;
};

const toOptionalDate = (value: unknown): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toDateOrNow = (value: unknown): Date => {
  const parsed = toOptionalDate(value);
  return parsed ?? new Date();
};

const toOptionalNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") return Number.isNaN(value) ? undefined : value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const ensureArray = <T>(value: unknown, fallback: T): T => {
  if (Array.isArray(value)) {
    return value as T;
  }
  return fallback;
};

const ensureObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const addDays = (base: Date, days: number): Date => {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
};

export function prepareOrganization(organization: InsertOrganization): PreparedRecord {
  const org = organization as Record<string, any>;
  const now = new Date();
  const maxUsers = toOptionalNumber(org.maxUsers);
  const maxSubsidiaries = toOptionalNumber(org.maxSubsidiaries);

  const prepared: PreparedRecord = {
    id: org.id ?? randomUUID(),
    name: org.name,
    type: org.type,
    parentId: org.parentId ?? null,
    plan: org.plan ?? "basic",
    maxUsers: typeof maxUsers === "number" ? maxUsers : 10,
    maxSubsidiaries: typeof maxSubsidiaries === "number" ? maxSubsidiaries : 3,
    isActive: typeof org.isActive === "boolean" ? org.isActive : true,
    address: org.address ?? null,
    phone: org.phone ?? null,
    email: org.email ?? null,
    cnpj: org.cnpj ?? null,
    createdAt: toOptionalDate(org.createdAt) ?? now,
    updatedAt: toOptionalDate(org.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareUser(user: InsertUser): PreparedRecord {
  const userData = user as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: userData.id ?? randomUUID(),
    email: userData.email,
    name: userData.name,
    role: userData.role,
    organizationId: userData.organizationId ?? null,
    isActive: typeof userData.isActive === "boolean" ? userData.isActive : true,
    lastLoginAt: toOptionalDate(userData.lastLoginAt) ?? null,
    createdAt: toOptionalDate(userData.createdAt) ?? now,
    updatedAt: toOptionalDate(userData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareInvitation(invitation: InsertInvitation): PreparedRecord {
  const invitationData = invitation as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: invitationData.id ?? randomUUID(),
    email: invitationData.email,
    role: invitationData.role,
    organizationId: invitationData.organizationId,
    invitedBy: invitationData.invitedBy,
    token: invitationData.token ?? randomUUID(),
    isAccepted: typeof invitationData.isAccepted === "boolean" ? invitationData.isAccepted : false,
    expiresAt: toOptionalDate(invitationData.expiresAt) ?? addDays(now, INVITATION_EXPIRATION_DAYS),
    createdAt: toOptionalDate(invitationData.createdAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareInspection(inspection: InsertInspection): PreparedRecord {
  const inspectionData = inspection as Record<string, any>;
  const now = new Date();
  const latitude = toOptionalNumber(inspectionData.latitude);
  const longitude = toOptionalNumber(inspectionData.longitude);
  const status = inspectionData.status ?? "draft";
  const inspectorId = inspectionData.inspectorId ?? "admin-id";
  const description = inspectionData.description ?? null;
  const recommendations = inspectionData.recommendations ?? null;
  const priority = inspectionData.priority ?? "medium";

  const prepared: PreparedRecord = {
    id: inspectionData.id ?? randomUUID(),
    title: inspectionData.title,
    description,
    location: inspectionData.location,
    status,
    organizationId: inspectionData.organizationId,
    inspectorId,
    checklistTemplateId: inspectionData.checklistTemplateId ?? null,
    checklist: ensureArray(inspectionData.checklist, [] as unknown[]),
    findings: ensureArray(inspectionData.findings, [] as unknown[]),
    recommendations,
    aiAnalysis: inspectionData.aiAnalysis ?? null,
    qrCode: inspectionData.qrCode ?? null,
    scheduledAt: toOptionalDate(inspectionData.scheduledAt) ?? null,
    startedAt: toOptionalDate(inspectionData.startedAt) ?? null,
    completedAt: toOptionalDate(inspectionData.completedAt) ?? null,
    createdAt: toOptionalDate(inspectionData.createdAt) ?? now,
    updatedAt: toOptionalDate(inspectionData.updatedAt) ?? now,
    priority,
    companyName: inspectionData.companyName ?? null,
    zipCode: inspectionData.zipCode ?? null,
    fullAddress: inspectionData.fullAddress ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    technicianName: inspectionData.technicianName ?? null,
    technicianEmail: inspectionData.technicianEmail ?? null,
    companyResponsibleName: inspectionData.companyResponsibleName ?? null,
    aiAssistantId: inspectionData.aiAssistantId ?? "GENERAL",
    actionPlanType: inspectionData.actionPlanType ?? "5W2H"
  };

  return sanitizeRecord(prepared);
}

export function prepareActionPlan(actionPlan: InsertActionPlan): PreparedRecord {
  const actionPlanData = actionPlan as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: actionPlanData.id ?? randomUUID(),
    inspectionId: actionPlanData.inspectionId,
    title: actionPlanData.title,
    description: actionPlanData.description ?? null,
    what: actionPlanData.what,
    why: actionPlanData.why,
    where: actionPlanData.where,
    when: toDateOrNow(actionPlanData.when),
    who: actionPlanData.who,
    how: actionPlanData.how,
    howMuch: actionPlanData.howMuch ?? null,
    status: actionPlanData.status ?? "pending",
    priority: actionPlanData.priority ?? "medium",
    organizationId: actionPlanData.organizationId,
    assignedTo: actionPlanData.assignedTo ?? null,
    dueDate: toOptionalDate(actionPlanData.dueDate) ?? null,
    completedAt: toOptionalDate(actionPlanData.completedAt) ?? null,
    createdAt: toOptionalDate(actionPlanData.createdAt) ?? now,
    updatedAt: toOptionalDate(actionPlanData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareFile(file: InsertFile): PreparedRecord {
  const fileData = file as Record<string, any>;
  const now = new Date();
  const size = typeof fileData.size === "number" ? fileData.size : Number(fileData.size);

  const prepared: PreparedRecord = {
    id: fileData.id ?? randomUUID(),
    name: fileData.name,
    type: fileData.type,
    size: Number.isNaN(size) ? 0 : size,
    url: fileData.url,
    inspectionId: fileData.inspectionId ?? null,
    actionPlanId: fileData.actionPlanId ?? null,
    organizationId: fileData.organizationId,
    uploadedBy: fileData.uploadedBy,
    createdAt: toOptionalDate(fileData.createdAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareChecklistTemplate(template: InsertChecklistTemplate): PreparedRecord {
  const templateData = template as Record<string, any>;
  const now = new Date();
  const items = ensureArray(templateData.items, [] as unknown[]);
  const rawTags = templateData.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map(tag => String(tag))
    : rawTags != null
      ? [String(rawTags)]
      : [];

  const prepared: PreparedRecord = {
    id: templateData.id ?? randomUUID(),
    name: templateData.name,
    description: templateData.description ?? null,
    category: templateData.category,
    folderId: templateData.folderId ?? null,
    organizationId: templateData.organizationId,
    items,
    tags: tags.length > 0 ? tags : [],
    version: (templateData.version as number | undefined) ?? 1,
    parentTemplateId: templateData.parentTemplateId ?? null,
    isActive: typeof templateData.isActive === "boolean" ? templateData.isActive : true,
    isDefault: typeof templateData.isDefault === "boolean" ? templateData.isDefault : false,
    isPublic: typeof templateData.isPublic === "boolean" ? templateData.isPublic : false,
    parentCategoryId: templateData.parentCategoryId ?? null,
    categoryPath: templateData.categoryPath ?? null,
    isCategoryFolder: typeof templateData.isCategoryFolder === "boolean" ? templateData.isCategoryFolder : false,
    folderColor: templateData.folderColor ?? "#3B82F6",
    folderIcon: templateData.folderIcon ?? "folder",
    displayOrder: (templateData.displayOrder as number | undefined) ?? 0,
    fieldCount: (templateData.fieldCount as number | undefined) ?? (Array.isArray(items) ? items.length : 0),
    usageCount: (templateData.usageCount as number | undefined) ?? 0,
    lastUsedAt: toOptionalDate(templateData.lastUsedAt) ?? null,
    createdBy: templateData.createdBy,
    createdAt: toOptionalDate(templateData.createdAt) ?? now,
    updatedAt: toOptionalDate(templateData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareChecklistFolder(folder: InsertChecklistFolder): PreparedRecord {
  const folderData = folder as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: folderData.id ?? randomUUID(),
    name: folderData.name,
    description: folderData.description ?? null,
    parentId: folderData.parentId ?? null,
    organizationId: folderData.organizationId,
    icon: folderData.icon ?? "folder",
    color: folderData.color ?? "#3B82F6",
    order: (folderData.order as number | undefined) ?? 0,
    createdBy: folderData.createdBy,
    createdAt: toOptionalDate(folderData.createdAt) ?? now,
    updatedAt: toOptionalDate(folderData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareActivityLog(log: InsertActivityLog): PreparedRecord {
  const logData = log as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: logData.id ?? randomUUID(),
    userId: logData.userId,
    organizationId: logData.organizationId,
    action: logData.action,
    entityType: logData.entityType ?? null,
    entityId: logData.entityId ?? null,
    details: ensureObject(logData.details),
    createdAt: toOptionalDate(logData.createdAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareCompany(company: InsertCompany): PreparedRecord {
  const companyData = company as Record<string, any>;
  const now = new Date();

  const prepared: PreparedRecord = {
    id: companyData.id ?? randomUUID(),
    name: companyData.name,
    cnpj: companyData.cnpj ?? null,
    email: companyData.email ?? null,
    phone: companyData.phone ?? null,
    website: companyData.website ?? null,
    address: companyData.address ?? null,
    city: companyData.city ?? null,
    state: companyData.state ?? null,
    zipCode: companyData.zipCode ?? null,
    responsibleName: companyData.responsibleName ?? null,
    responsibleRole: companyData.responsibleRole ?? null,
    responsibleEmail: companyData.responsibleEmail ?? null,
    responsiblePhone: companyData.responsiblePhone ?? null,
    technicalResponsibleName: companyData.technicalResponsibleName ?? null,
    technicalResponsibleRole: companyData.technicalResponsibleRole ?? null,
    technicalResponsibleEmail: companyData.technicalResponsibleEmail ?? null,
    technicalResponsiblePhone: companyData.technicalResponsiblePhone ?? null,
    technicalResponsibleCertification: companyData.technicalResponsibleCertification ?? null,
    organizationId: companyData.organizationId,
    isActive: typeof companyData.isActive === "boolean" ? companyData.isActive : true,
    notes: companyData.notes ?? null,
    createdBy: companyData.createdBy,
    createdAt: toOptionalDate(companyData.createdAt) ?? now,
    updatedAt: toOptionalDate(companyData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}

export function prepareCompanyLocation(location: InsertCompanyLocation): PreparedRecord {
  const locationData = location as Record<string, any>;
  const now = new Date();
  const latitude = toOptionalNumber(locationData.latitude);
  const longitude = toOptionalNumber(locationData.longitude);

  const prepared: PreparedRecord = {
    id: locationData.id ?? randomUUID(),
    companyId: locationData.companyId,
    name: locationData.name,
    type: locationData.type ?? null,
    address: locationData.address ?? null,
    city: locationData.city ?? null,
    state: locationData.state ?? null,
    zipCode: locationData.zipCode ?? null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    responsibleName: locationData.responsibleName ?? null,
    responsiblePhone: locationData.responsiblePhone ?? null,
    responsibleEmail: locationData.responsibleEmail ?? null,
    isActive: typeof locationData.isActive === "boolean" ? locationData.isActive : true,
    notes: locationData.notes ?? null,
    createdBy: locationData.createdBy,
    createdAt: toOptionalDate(locationData.createdAt) ?? now,
    updatedAt: toOptionalDate(locationData.updatedAt) ?? now
  };

  return sanitizeRecord(prepared);
}
