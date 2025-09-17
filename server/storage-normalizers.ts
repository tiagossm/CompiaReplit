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
  type InsertCompanyLocation,
} from "@shared/schema";

type AnyRecord = Record<string, unknown>;

type DateField = string;

const ORGANIZATION_DATE_FIELDS: DateField[] = ["createdAt", "updatedAt"];
const USER_DATE_FIELDS: DateField[] = ["createdAt", "updatedAt", "lastLoginAt"];
const INVITATION_DATE_FIELDS: DateField[] = ["createdAt", "expiresAt"];
const INSPECTION_DATE_FIELDS: DateField[] = [
  "scheduledAt",
  "startedAt",
  "completedAt",
  "createdAt",
  "updatedAt",
];
const ACTION_PLAN_DATE_FIELDS: DateField[] = [
  "when",
  "dueDate",
  "completedAt",
  "createdAt",
  "updatedAt",
];
const FILE_DATE_FIELDS: DateField[] = ["createdAt"];
const CHECKLIST_TEMPLATE_DATE_FIELDS: DateField[] = [
  "createdAt",
  "updatedAt",
  "lastUsedAt",
];
const CHECKLIST_FOLDER_DATE_FIELDS: DateField[] = ["createdAt", "updatedAt"];
const ACTIVITY_LOG_DATE_FIELDS: DateField[] = ["createdAt"];
const COMPANY_DATE_FIELDS: DateField[] = ["createdAt", "updatedAt"];
const COMPANY_LOCATION_DATE_FIELDS: DateField[] = ["createdAt", "updatedAt"];

function coerceDate(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const coerced = new Date(value);
    if (!Number.isNaN(coerced.valueOf())) {
      return coerced;
    }
  }
  return value;
}

function cloneAndCoerceDates<T extends AnyRecord>(record: T, dateFields: DateField[]): T {
  const cloned: AnyRecord = { ...record };

  for (const field of dateFields) {
    if (field in cloned) {
      cloned[field] = coerceDate(cloned[field]);
    }
  }

  for (const key of Object.keys(cloned)) {
    if (cloned[key] === undefined) {
      delete cloned[key];
    }
  }

  return cloned as T;
}

export function prepareOrganization(org: InsertOrganization): InsertOrganization {
  return cloneAndCoerceDates(org, ORGANIZATION_DATE_FIELDS);
}

export function prepareUser(user: InsertUser): InsertUser {
  return cloneAndCoerceDates(user, USER_DATE_FIELDS);
}

export function prepareInvitation(invitation: InsertInvitation): InsertInvitation {
  return cloneAndCoerceDates(invitation, INVITATION_DATE_FIELDS);
}

export function prepareInspection(inspection: InsertInspection): InsertInspection {
  return cloneAndCoerceDates(inspection, INSPECTION_DATE_FIELDS);
}

export function prepareActionPlan(actionPlan: InsertActionPlan): InsertActionPlan {
  return cloneAndCoerceDates(actionPlan, ACTION_PLAN_DATE_FIELDS);
}

export function prepareFile(file: InsertFile): InsertFile {
  return cloneAndCoerceDates(file, FILE_DATE_FIELDS);
}

export function prepareChecklistTemplate(template: InsertChecklistTemplate): InsertChecklistTemplate {
  return cloneAndCoerceDates(template, CHECKLIST_TEMPLATE_DATE_FIELDS);
}

export function prepareChecklistFolder(folder: InsertChecklistFolder): InsertChecklistFolder {
  return cloneAndCoerceDates(folder, CHECKLIST_FOLDER_DATE_FIELDS);
}

export function prepareActivityLog(log: InsertActivityLog): InsertActivityLog {
  return cloneAndCoerceDates(log, ACTIVITY_LOG_DATE_FIELDS);
}

export function prepareCompany(company: InsertCompany): InsertCompany {
  return cloneAndCoerceDates(company, COMPANY_DATE_FIELDS);
}

export function prepareCompanyLocation(location: InsertCompanyLocation): InsertCompanyLocation {
  return cloneAndCoerceDates(location, COMPANY_LOCATION_DATE_FIELDS);
}
