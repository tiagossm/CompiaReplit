import { 
  type Organization, type InsertOrganization,
  type User, type InsertUser,
  type Invitation, type InsertInvitation,
  type Inspection, type InsertInspection,
  type ActionPlan, type InsertActionPlan,
  type File, type InsertFile,
  type ActivityLog, type InsertActivityLog,
  type ChecklistTemplate, type InsertChecklistTemplate
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  getOrganizationsByParent(parentId: string | null): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Invitations
  getInvitation(id: string): Promise<Invitation | undefined>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByOrganization(organizationId: string): Promise<Invitation[]>;
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation>;
  
  // Inspections
  getInspection(id: string): Promise<Inspection | undefined>;
  getInspectionsByOrganization(organizationId: string): Promise<Inspection[]>;
  getInspectionsByInspector(inspectorId: string): Promise<Inspection[]>;
  createInspection(inspection: InsertInspection): Promise<Inspection>;
  updateInspection(id: string, updates: Partial<Inspection>): Promise<Inspection>;
  
  // Action Plans
  getActionPlan(id: string): Promise<ActionPlan | undefined>;
  getActionPlansByInspection(inspectionId: string): Promise<ActionPlan[]>;
  getActionPlansByOrganization(organizationId: string): Promise<ActionPlan[]>;
  createActionPlan(actionPlan: InsertActionPlan): Promise<ActionPlan>;
  updateActionPlan(id: string, updates: Partial<ActionPlan>): Promise<ActionPlan>;
  
  // Files
  getFile(id: string): Promise<File | undefined>;
  getFilesByInspection(inspectionId: string): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  
  // Checklist Templates
  getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined>;
  getChecklistTemplatesByOrganization(organizationId: string): Promise<ChecklistTemplate[]>;
  getChecklistTemplatesByCategory(organizationId: string, category: string): Promise<ChecklistTemplate[]>;
  createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate>;
  updateChecklistTemplate(id: string, updates: Partial<ChecklistTemplate>): Promise<ChecklistTemplate>;
  deleteChecklistTemplate(id: string): Promise<void>;
  
  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByOrganization(organizationId: string, limit?: number): Promise<ActivityLog[]>;
}

export class MemStorage implements IStorage {
  private organizations = new Map<string, Organization>();
  private users = new Map<string, User>();
  private invitations = new Map<string, Invitation>();
  private inspections = new Map<string, Inspection>();
  private actionPlans = new Map<string, ActionPlan>();
  private files = new Map<string, File>();
  private checklistTemplates = new Map<string, ChecklistTemplate>();
  private activityLogs: ActivityLog[] = [];

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create master organization
    const masterId = randomUUID();
    const masterOrg: Organization = {
      id: masterId,
      name: "IA SST Master",
      type: "master",
      parentId: null,
      plan: "enterprise",
      maxUsers: 1000,
      maxSubsidiaries: 100,
      isActive: true,
      address: null,
      phone: null,
      email: null,
      cnpj: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.organizations.set(masterId, masterOrg);

    // Create master admin user
    const adminId = randomUUID();
    const masterAdmin: User = {
      id: adminId,
      email: "admin@iasst.com",
      name: "System Administrator",
      role: "system_admin",
      organizationId: masterId,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(adminId, masterAdmin);

    // Create sample enterprise organization
    const enterpriseId = randomUUID();
    const enterprise: Organization = {
      id: enterpriseId,
      name: "Empresa Exemplo Ltda",
      type: "enterprise",
      parentId: masterId,
      plan: "pro",
      maxUsers: 50,
      maxSubsidiaries: 10,
      isActive: true,
      address: "Rua das Empresas, 123 - São Paulo, SP",
      phone: "(11) 9999-9999",
      email: "contato@empresaexemplo.com",
      cnpj: "12.345.678/0001-99",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.organizations.set(enterpriseId, enterprise);

    // Create org admin for enterprise
    const orgAdminId = randomUUID();
    const orgAdmin: User = {
      id: orgAdminId,
      email: "admin@empresaexemplo.com",
      name: "João Silva",
      role: "org_admin",
      organizationId: enterpriseId,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(orgAdminId, orgAdmin);

    // Create default checklist templates
    this.createDefaultChecklistTemplates(enterpriseId, orgAdminId);
  }

  private createDefaultChecklistTemplates(organizationId: string, createdBy: string) {
    const defaultTemplates = [
      {
        id: randomUUID(),
        name: "Checklist Geral de Segurança",
        description: "Template básico para inspeções gerais de segurança do trabalho",
        category: "geral",
        organizationId,
        createdBy,
        isDefault: true,
        isActive: true,
        items: [
          { id: "1", item: "Equipamentos de Proteção Individual (EPIs)", standard: "NR-06", category: "epi", isRequired: true },
          { id: "2", item: "Sinalização de Segurança", standard: "NR-26", category: "sinalizacao", isRequired: true },
          { id: "3", item: "Instalações Elétricas", standard: "NR-10", category: "eletrica", isRequired: false },
          { id: "4", item: "Máquinas e Equipamentos", standard: "NR-12", category: "maquinas", isRequired: false },
          { id: "5", item: "Prevenção de Incêndios", standard: "NR-23", category: "incendio", isRequired: true }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: randomUUID(),
        name: "Checklist NR-06 - EPIs",
        description: "Template específico para verificação de equipamentos de proteção individual",
        category: "nr-06",
        organizationId,
        createdBy,
        isDefault: true,
        isActive: true,
        items: [
          { id: "1", item: "Capacete de segurança", standard: "NR-06", category: "epi-cabeca", isRequired: true },
          { id: "2", item: "Óculos de proteção", standard: "NR-06", category: "epi-olhos", isRequired: true },
          { id: "3", item: "Luvas de segurança", standard: "NR-06", category: "epi-maos", isRequired: true },
          { id: "4", item: "Calçados de segurança", standard: "NR-06", category: "epi-pes", isRequired: true },
          { id: "5", item: "Protetor auricular", standard: "NR-06", category: "epi-audicao", isRequired: false }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: randomUUID(),
        name: "Checklist NR-10 - Segurança Elétrica",
        description: "Template para inspeções de segurança em instalações elétricas",
        category: "nr-10",
        organizationId,
        createdBy,
        isDefault: true,
        isActive: true,
        items: [
          { id: "1", item: "Desenergização completa", standard: "NR-10", category: "procedimentos", isRequired: true },
          { id: "2", item: "Travamento e etiquetagem", standard: "NR-10", category: "procedimentos", isRequired: true },
          { id: "3", item: "Teste de ausência de tensão", standard: "NR-10", category: "verificacao", isRequired: true },
          { id: "4", item: "Aterramento temporário", standard: "NR-10", category: "protecao", isRequired: true },
          { id: "5", item: "Isolamento da área", standard: "NR-10", category: "area", isRequired: true }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultTemplates.forEach(template => {
      this.checklistTemplates.set(template.id, template as ChecklistTemplate);
    });
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async getOrganizationsByParent(parentId: string | null): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(org => org.parentId === parentId);
  }

  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const organization: Organization = {
      ...orgData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.organizations.set(id, organization);
    return organization;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const existing = this.organizations.get(id);
    if (!existing) throw new Error("Organization not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.organizations.set(id, updated);
    return updated;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.organizationId === organizationId);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...userData,
      id,
      isActive: userData.isActive ?? true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error("User not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // Invitations
  async getInvitation(id: string): Promise<Invitation | undefined> {
    return this.invitations.get(id);
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return Array.from(this.invitations.values()).find(inv => inv.token === token);
  }

  async getInvitationsByOrganization(organizationId: string): Promise<Invitation[]> {
    return Array.from(this.invitations.values()).filter(inv => inv.organizationId === organizationId);
  }

  async createInvitation(invData: InsertInvitation): Promise<Invitation> {
    const id = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const invitation: Invitation = {
      ...invData,
      id,
      token,
      isAccepted: false,
      expiresAt,
      createdAt: new Date()
    };
    this.invitations.set(id, invitation);
    return invitation;
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    const existing = this.invitations.get(id);
    if (!existing) throw new Error("Invitation not found");
    
    const updated = { ...existing, ...updates };
    this.invitations.set(id, updated);
    return updated;
  }

  // Inspections
  async getInspection(id: string): Promise<Inspection | undefined> {
    return this.inspections.get(id);
  }

  async getInspectionsByOrganization(organizationId: string): Promise<Inspection[]> {
    return Array.from(this.inspections.values()).filter(inspection => inspection.organizationId === organizationId);
  }

  async getInspectionsByInspector(inspectorId: string): Promise<Inspection[]> {
    return Array.from(this.inspections.values()).filter(inspection => inspection.inspectorId === inspectorId);
  }

  async createInspection(inspectionData: InsertInspection): Promise<Inspection> {
    const id = randomUUID();
    const inspection: Inspection = {
      ...inspectionData,
      id,
      description: inspectionData.description ?? null,
      qrCode: null,
      aiAnalysis: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.inspections.set(id, inspection);
    return inspection;
  }

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<Inspection> {
    const existing = this.inspections.get(id);
    if (!existing) throw new Error("Inspection not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.inspections.set(id, updated);
    return updated;
  }

  // Action Plans
  async getActionPlan(id: string): Promise<ActionPlan | undefined> {
    return this.actionPlans.get(id);
  }

  async getActionPlansByInspection(inspectionId: string): Promise<ActionPlan[]> {
    return Array.from(this.actionPlans.values()).filter(plan => plan.inspectionId === inspectionId);
  }

  async getActionPlansByOrganization(organizationId: string): Promise<ActionPlan[]> {
    return Array.from(this.actionPlans.values()).filter(plan => plan.organizationId === organizationId);
  }

  async createActionPlan(planData: InsertActionPlan): Promise<ActionPlan> {
    const id = randomUUID();
    const actionPlan: ActionPlan = {
      ...planData,
      id,
      description: planData.description ?? null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.actionPlans.set(id, actionPlan);
    return actionPlan;
  }

  async updateActionPlan(id: string, updates: Partial<ActionPlan>): Promise<ActionPlan> {
    const existing = this.actionPlans.get(id);
    if (!existing) throw new Error("Action plan not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.actionPlans.set(id, updated);
    return updated;
  }

  // Files
  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByInspection(inspectionId: string): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.inspectionId === inspectionId);
  }

  async createFile(fileData: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = {
      ...fileData,
      id,
      inspectionId: fileData.inspectionId ?? null,
      actionPlanId: fileData.actionPlanId ?? null,
      createdAt: new Date()
    };
    this.files.set(id, file);
    return file;
  }

  // Activity Logs
  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...logData,
      id,
      details: logData.details ?? {},
      entityType: logData.entityType ?? null,
      entityId: logData.entityId ?? null,
      createdAt: new Date()
    };
    this.activityLogs.push(log);
    return log;
  }

  // Checklist Templates
  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined> {
    return this.checklistTemplates.get(id);
  }

  async getChecklistTemplatesByOrganization(organizationId: string): Promise<ChecklistTemplate[]> {
    return Array.from(this.checklistTemplates.values())
      .filter(template => template.organizationId === organizationId && template.isActive);
  }

  async getChecklistTemplatesByCategory(organizationId: string, category: string): Promise<ChecklistTemplate[]> {
    return Array.from(this.checklistTemplates.values())
      .filter(template => 
        template.organizationId === organizationId && 
        template.category === category && 
        template.isActive
      );
  }

  async createChecklistTemplate(templateData: InsertChecklistTemplate): Promise<ChecklistTemplate> {
    const id = randomUUID();
    const template: ChecklistTemplate = {
      ...templateData,
      id,
      isActive: templateData.isActive ?? true,
      isDefault: templateData.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.checklistTemplates.set(id, template);
    return template;
  }

  async updateChecklistTemplate(id: string, updates: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
    const existing = this.checklistTemplates.get(id);
    if (!existing) throw new Error("Checklist template not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.checklistTemplates.set(id, updated);
    return updated;
  }

  async deleteChecklistTemplate(id: string): Promise<void> {
    const existing = this.checklistTemplates.get(id);
    if (!existing) throw new Error("Checklist template not found");
    
    // Soft delete by setting isActive to false
    const updated = { ...existing, isActive: false, updatedAt: new Date() };
    this.checklistTemplates.set(id, updated);
  }

  async getActivityLogsByOrganization(organizationId: string, limit = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .filter(log => log.organizationId === organizationId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
