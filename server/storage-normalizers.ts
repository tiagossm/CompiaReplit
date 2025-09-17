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

export const prepareOrganization = (organization: InsertOrganization): InsertOrganization => ({
  ...organization
});

export const prepareUser = (user: InsertUser): InsertUser => ({
  ...user
});

export const prepareInvitation = (invitation: InsertInvitation): InsertInvitation => ({
  ...invitation
});

export const prepareInspection = (inspection: InsertInspection): InsertInspection => ({
  ...inspection
});

export const prepareActionPlan = (actionPlan: InsertActionPlan): InsertActionPlan => ({
  ...actionPlan
});

export const prepareFile = (file: InsertFile): InsertFile => ({
  ...file
});

export const prepareChecklistTemplate = (
  template: InsertChecklistTemplate
): InsertChecklistTemplate => ({
  ...template
});

export const prepareChecklistFolder = (
  folder: InsertChecklistFolder
): InsertChecklistFolder => ({
  ...folder
});

export const prepareActivityLog = (log: InsertActivityLog): InsertActivityLog => ({
  ...log
});

export const prepareCompany = (company: InsertCompany): InsertCompany => ({
  ...company
});

export const prepareCompanyLocation = (
  location: InsertCompanyLocation
): InsertCompanyLocation => ({
  ...location
});
