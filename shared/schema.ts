import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "system_admin",
  "org_admin", 
  "manager",
  "inspector",
  "client"
]);

export const organizationTypeEnum = pgEnum("organization_type", [
  "master",
  "enterprise", 
  "subsidiary"
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "basic",
  "pro", 
  "enterprise"
]);

export const inspectionStatusEnum = pgEnum("inspection_status", [
  "draft",
  "in_progress",
  "completed",
  "approved",
  "rejected"
]);

export const actionStatusEnum = pgEnum("action_status", [
  "pending",
  "in_progress", 
  "completed",
  "overdue",
  "cancelled"
]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high", 
  "critical"
]);

// Tables
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: organizationTypeEnum("type").notNull(),
  parentId: varchar("parent_id").references((): typeof organizations.id => organizations.id),
  plan: subscriptionPlanEnum("plan").default("basic"),
  maxUsers: integer("max_users").default(10),
  maxSubsidiaries: integer("max_subsidiaries").default(3),
  isActive: boolean("is_active").default(true),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  cnpj: text("cnpj"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull(),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  isAccepted: boolean("is_accepted").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const inspections = pgTable("inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  status: inspectionStatusEnum("status").default("draft"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  inspectorId: varchar("inspector_id").notNull().references(() => users.id),
  checklist: jsonb("checklist"), // JSON structure for checklist items
  findings: jsonb("findings"), // Non-conformities found
  recommendations: text("recommendations"),
  aiAnalysis: text("ai_analysis"),
  qrCode: text("qr_code"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const actionPlans = pgTable("action_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inspectionId: varchar("inspection_id").notNull().references(() => inspections.id),
  title: text("title").notNull(),
  description: text("description"),
  what: text("what").notNull(), // O que
  why: text("why").notNull(), // Por que
  where: text("where").notNull(), // Onde
  when: timestamp("when").notNull(), // Quando
  who: text("who").notNull(), // Quem
  how: text("how").notNull(), // Como
  howMuch: text("how_much"), // Quanto
  status: actionStatusEnum("status").default("pending"),
  priority: priorityEnum("priority").default("medium"),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  inspectionId: varchar("inspection_id").references(() => inspections.id),
  actionPlanId: varchar("action_plan_id").references(() => actionPlans.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const checklistFolders = pgTable("checklist_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id").references((): typeof checklistFolders.id => checklistFolders.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  icon: text("icon").default("folder"),
  color: text("color").default("#3B82F6"),
  order: integer("order").default(0),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  folderId: varchar("folder_id").references(() => checklistFolders.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  items: jsonb("items").notNull(),
  tags: text("tags").array(),
  version: integer("version").default(1),
  parentTemplateId: varchar("parent_template_id").references((): typeof checklistTemplates.id => checklistTemplates.id),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  action: text("action").notNull(),
  entityType: text("entity_type"), // inspection, action_plan, user, etc
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`)
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  token: true,
  isAccepted: true,
  createdAt: true,
  expiresAt: true
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  qrCode: true,
  aiAnalysis: true
});

export const insertActionPlanSchema = createInsertSchema(actionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true
});

export const insertChecklistFolderSchema = createInsertSchema(checklistFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastUsedAt: true
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;

export type ActionPlan = typeof actionPlans.$inferSelect;
export type InsertActionPlan = z.infer<typeof insertActionPlanSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type ChecklistFolder = typeof checklistFolders.$inferSelect;
export type InsertChecklistFolder = z.infer<typeof insertChecklistFolderSchema>;

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Additional schemas for API validation
export const acceptInviteSchema = z.object({
  token: z.string(),
  userInfo: z.object({
    name: z.string(),
    email: z.string().email()
  })
});

export const createInspectionSchema = insertInspectionSchema.extend({
  checklist: z.array(z.object({
    id: z.string(),
    item: z.string(),
    standard: z.string().optional(),
    isCompliant: z.boolean().optional(),
    notes: z.string().optional()
  })).optional()
});

export const updateInspectionSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "approved", "rejected"]).optional(),
  findings: z.array(z.object({
    item: z.string(),
    description: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    standard: z.string().optional(),
    evidence: z.array(z.string()).optional()
  })).optional(),
  recommendations: z.string().optional()
});

export const createChecklistTemplateSchema = insertChecklistTemplateSchema.extend({
  items: z.array(z.object({
    id: z.string(),
    item: z.string(),
    standard: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    isRequired: z.boolean().default(false),
    referenceImage: z.string().optional(),
    helpText: z.string().optional(),
    weight: z.number().default(1)
  }))
});

export const aiAnalysisResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  findings: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    recommendation: z.string(),
    standard: z.string().optional(),
    estimatedCost: z.number().optional(),
    estimatedTime: z.string().optional()
  })),
  insights: z.array(z.object({
    type: z.enum(["pattern", "trend", "risk", "opportunity"]),
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  recommendations: z.array(z.object({
    priority: z.enum(["low", "medium", "high", "urgent"]),
    action: z.string(),
    deadline: z.string(),
    responsibleRole: z.string(),
    expectedOutcome: z.string()
  })),
  complianceStatus: z.object({
    overallCompliance: z.number().min(0).max(100),
    violations: z.array(z.string()),
    improvements: z.array(z.string())
  })
});
