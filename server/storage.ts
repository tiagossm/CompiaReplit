import { 
  type Organization, type InsertOrganization,
  type User, type InsertUser,
  type Invitation, type InsertInvitation,
  type Inspection, type InsertInspection,
  type ActionPlan, type InsertActionPlan,
  type File, type InsertFile,
  type ActivityLog, type InsertActivityLog,
  type ChecklistTemplate, type InsertChecklistTemplate,
  type ChecklistFolder, type InsertChecklistFolder,
  type Company, type InsertCompany,
  type CompanyLocation, type InsertCompanyLocation
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { 
  organizations, users, invitations, inspections, actionPlans, 
  files, checklistTemplates, checklistFolders, activityLogs, companies, companyLocations 
} from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

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
  deleteInspection(id: string): Promise<void>;
  
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
  
  // Checklist Folders
  getChecklistFolder(id: string): Promise<ChecklistFolder | undefined>;
  getChecklistFoldersByOrganization(organizationId: string): Promise<ChecklistFolder[]>;
  createChecklistFolder(folder: InsertChecklistFolder): Promise<ChecklistFolder>;
  updateChecklistFolder(id: string, updates: Partial<ChecklistFolder>): Promise<ChecklistFolder>;
  deleteChecklistFolder(id: string): Promise<void>;
  
  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByOrganization(organizationId: string, limit?: number): Promise<ActivityLog[]>;
  
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompaniesByOrganization(organizationId: string): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Company Locations
  getCompanyLocation(id: string): Promise<CompanyLocation | undefined>;
  getCompanyLocationsByCompany(companyId: string): Promise<CompanyLocation[]>;
  createCompanyLocation(location: InsertCompanyLocation): Promise<CompanyLocation>;
  updateCompanyLocation(id: string, updates: Partial<CompanyLocation>): Promise<CompanyLocation>;
  deleteCompanyLocation(id: string): Promise<void>;
}

export class MemStorage {
  // Use loose any maps to avoid rigid structural typing in the in-memory shim
  private organizations = new Map<string, any>();
  private users = new Map<string, any>();
  private invitations = new Map<string, any>();
  private inspections = new Map<string, any>();
  private actionPlans = new Map<string, any>();
  private files = new Map<string, any>();
  private checklistFolders = new Map<string, any>();
  private checklistTemplates = new Map<string, any>();
  private activityLogs: any[] = [];
  private companies = new Map<string, any>();
  private companyLocations = new Map<string, any>();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create master organization
    const masterId = randomUUID();
  const masterOrg = {
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
  } as any;
    this.organizations.set(masterId, masterOrg);

    // Create master admin user
    const adminId = randomUUID();
  const masterAdmin = {
      id: adminId,
      email: "admin@iasst.com",
      name: "System Administrator",
      role: "system_admin",
      organizationId: masterId,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
    this.users.set(adminId, masterAdmin);

    // Create sample enterprise organization
    const enterpriseId = randomUUID();
  const enterprise = {
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
  } as any;
    this.organizations.set(enterpriseId, enterprise);

    // Create org admin for enterprise
    const orgAdminId = randomUUID();
  const orgAdmin = {
      id: orgAdminId,
      email: "admin@empresaexemplo.com",
      name: "João Silva",
      role: "org_admin",
      organizationId: enterpriseId,
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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
      this.checklistTemplates.set(template.id, template as any);
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
  const organization = {
      ...orgData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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
  const user = {
      ...userData,
      id,
      isActive: userData.isActive ?? true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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

  const invitation = {
      ...invData,
      id,
      token,
      isAccepted: false,
      expiresAt,
      createdAt: new Date()
  } as any;
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
  const inspection = {
      ...inspectionData,
      id,
      description: inspectionData.description ?? null,
      qrCode: null,
      aiAnalysis: null,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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

  async deleteInspection(id: string): Promise<void> {
    const existing = this.inspections.get(id);
    if (!existing) throw new Error("Inspection not found");
    
    const updated = { ...existing, isActive: false, updatedAt: new Date() };
    this.inspections.set(id, updated);
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
  const actionPlan = {
      ...planData,
      id,
      description: planData.description ?? null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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
  const file = {
      ...fileData,
      id,
      inspectionId: fileData.inspectionId ?? null,
      actionPlanId: fileData.actionPlanId ?? null,
      createdAt: new Date()
  } as any;
    this.files.set(id, file);
    return file;
  }

  // Activity Logs
  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
  const log = {
      ...logData,
      id,
      details: logData.details ?? {},
      entityType: logData.entityType ?? null,
      entityId: logData.entityId ?? null,
      createdAt: new Date()
  } as any;
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
  const template = {
      ...templateData,
      id,
      isActive: templateData.isActive ?? true,
      isDefault: templateData.isDefault ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
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
  
  // Companies
  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompaniesByOrganization(organizationId: string): Promise<Company[]> {
    return Array.from(this.companies.values())
      .filter(company => company.organizationId === organizationId && company.isActive);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const id = randomUUID();
  const newCompany = {
      ...company,
      id,
      isActive: company.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
    this.companies.set(id, newCompany);
    return newCompany;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const existing = this.companies.get(id);
    if (!existing) throw new Error("Company not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.companies.set(id, updated);
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    const existing = this.companies.get(id);
    if (!existing) throw new Error("Company not found");
    
    const updated = { ...existing, isActive: false, updatedAt: new Date() };
    this.companies.set(id, updated);
  }

  // Company Locations
  async getCompanyLocation(id: string): Promise<CompanyLocation | undefined> {
    return this.companyLocations.get(id);
  }

  async getCompanyLocationsByCompany(companyId: string): Promise<CompanyLocation[]> {
    return Array.from(this.companyLocations.values())
      .filter(location => location.companyId === companyId && location.isActive);
  }

  async createCompanyLocation(location: InsertCompanyLocation): Promise<CompanyLocation> {
    const id = randomUUID();
  const newLocation = {
      ...location,
      id,
      isActive: location.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
  } as any;
    this.companyLocations.set(id, newLocation);
    return newLocation;
  }

  async updateCompanyLocation(id: string, updates: Partial<CompanyLocation>): Promise<CompanyLocation> {
    const existing = this.companyLocations.get(id);
    if (!existing) throw new Error("Company location not found");
    
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.companyLocations.set(id, updated);
    return updated;
  }

  async deleteCompanyLocation(id: string): Promise<void> {
    const existing = this.companyLocations.get(id);
    if (!existing) throw new Error("Company location not found");
    
    const updated = { ...existing, isActive: false, updatedAt: new Date() };
    this.companyLocations.set(id, updated);
  }
}

// DatabaseStorage implementation

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  async initializeDefaultData() {
    try {
      // Create default master organization if not exists
      const existingOrgs = await db.select().from(organizations).limit(1);
      if (existingOrgs.length === 0) {
      const masterOrg = await db.insert(organizations).values({
          id: 'master-org-id',
          name: 'COMPIA Master',
          type: 'master',
          parentId: null,
          plan: 'enterprise',
          maxUsers: 1000,
          maxSubsidiaries: 100,
          isActive: true,
          email: 'admin@compia.app',
          cnpj: '00.000.000/0001-00'
      } as any).returning();

        // Create default admin user
  await db.insert(users).values({
          id: 'admin-id',
          email: 'admin@iasst.com',
          name: 'System Administrator',
          role: 'system_admin',
          organizationId: masterOrg[0].id,
          isActive: true
  } as any).returning();

        // Create sample checklist templates
  await db.insert(checklistTemplates).values([
          {
            id: 'template-nr10',
            name: 'Inspeção NR-10 - Segurança em Instalações Elétricas',
            description: 'Template para inspeção de segurança em instalações e serviços em eletricidade',
            category: 'NR-10',
            organizationId: masterOrg[0].id,
            items: [
              { type: 'checkbox', label: 'Desenergização', required: true },
              { type: 'checkbox', label: 'Travamento e etiquetagem', required: true },
              { type: 'checkbox', label: 'Teste de ausência de tensão', required: true },
              { type: 'text', label: 'Observações gerais', required: false }
            ],
            tags: ['eletricidade', 'segurança', 'nr10'],
            isActive: true,
            isDefault: true,
            createdBy: 'admin-id'
          },
          {
            id: 'template-nr35',
            name: 'Trabalho em Altura - NR-35',
            description: 'Checklist para trabalhos em altura conforme NR-35',
            category: 'NR-35',
            organizationId: masterOrg[0].id,
            items: [
              { type: 'checkbox', label: 'EPIs adequados para altura', required: true },
              { type: 'checkbox', label: 'Análise preliminar de risco', required: true },
              { type: 'checkbox', label: 'Sistema de proteção contra quedas', required: true },
              { type: 'text', label: 'Altura do trabalho (metros)', required: true }
            ],
            tags: ['altura', 'epi', 'nr35'],
            isActive: true,
            isDefault: true,
            createdBy: 'admin-id'
          }
  ] as any).returning();
        
        console.log('Default data initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }
  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganizationsByParent(parentId: string | null): Promise<Organization[]> {
    if (parentId === null) {
      return await db.select().from(organizations).where(isNull(organizations.parentId));
    }
    return await db.select().from(organizations).where(eq(organizations.parentId, parentId));
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const [updated] = await db.update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Invitations
  async getInvitation(id: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token));
    return invitation;
  }

  async getInvitationsByOrganization(organizationId: string): Promise<Invitation[]> {
    return await db.select().from(invitations).where(eq(invitations.organizationId, organizationId));
  }

  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const [created] = await db.insert(invitations).values(invitation).returning();
    return created;
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    const [updated] = await db.update(invitations)
      .set(updates)
      .where(eq(invitations.id, id))
      .returning();
    return updated;
  }

  // Inspections
  async getInspection(id: string): Promise<Inspection | undefined> {
    const [inspection] = await db.select().from(inspections).where(eq(inspections.id, id));
    return inspection;
  }

  async getInspectionsByOrganization(organizationId: string): Promise<Inspection[]> {
    return await db.select().from(inspections).where(eq(inspections.organizationId, organizationId));
  }

  async getInspectionsByInspector(inspectorId: string): Promise<Inspection[]> {
    return await db.select().from(inspections).where(eq(inspections.inspectorId, inspectorId));
  }

  async createInspection(inspection: InsertInspection): Promise<Inspection> {
    try {
      // Convert string dates to Date objects if needed
      const processedInspection = {
        ...inspection,
        scheduledAt: typeof inspection.scheduledAt === 'string' ? new Date(inspection.scheduledAt) : inspection.scheduledAt,
        startedAt: inspection.startedAt && typeof inspection.startedAt === 'string' ? new Date(inspection.startedAt) : inspection.startedAt,
        completedAt: inspection.completedAt && typeof inspection.completedAt === 'string' ? new Date(inspection.completedAt) : inspection.completedAt,
        inspectorId: inspection.inspectorId || 'admin-id' // Ensure inspectorId is never null
      };
      
      console.log('Creating inspection with data:', processedInspection);
      
      const [created] = await db.insert(inspections).values(processedInspection).returning();
      return created;
    } catch (error) {
      console.error('Error creating inspection:', error);
      throw error;
    }
  }

  async updateInspection(id: string, updates: Partial<Inspection>): Promise<Inspection> {
    const [updated] = await db.update(inspections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inspections.id, id))
      .returning();
    return updated;
  }

  async deleteInspection(id: string): Promise<void> {
    await db.update(inspections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(inspections.id, id));
  }

  // Action Plans
  async getActionPlan(id: string): Promise<ActionPlan | undefined> {
    const [actionPlan] = await db.select().from(actionPlans).where(eq(actionPlans.id, id));
    return actionPlan;
  }

  async getActionPlansByInspection(inspectionId: string): Promise<ActionPlan[]> {
    return await db.select().from(actionPlans).where(eq(actionPlans.inspectionId, inspectionId));
  }

  async getActionPlansByOrganization(organizationId: string): Promise<ActionPlan[]> {
    return await db.select().from(actionPlans).where(eq(actionPlans.organizationId, organizationId));
  }

  async createActionPlan(actionPlan: InsertActionPlan): Promise<ActionPlan> {
    const [created] = await db.insert(actionPlans).values(actionPlan).returning();
    return created;
  }

  async updateActionPlan(id: string, updates: Partial<ActionPlan>): Promise<ActionPlan> {
    const [updated] = await db.update(actionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(actionPlans.id, id))
      .returning();
    return updated;
  }

  // Files
  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async getFilesByInspection(inspectionId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.inspectionId, inspectionId));
  }

  async createFile(file: InsertFile): Promise<File> {
    const [created] = await db.insert(files).values(file).returning();
    return created;
  }

  // Checklist Templates
  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined> {
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    return template;
  }

  async getChecklistTemplatesByOrganization(organizationId: string): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates)
      .where(and(eq(checklistTemplates.organizationId, organizationId), eq(checklistTemplates.isActive, true)));
  }

  async getChecklistTemplatesByCategory(organizationId: string, category: string): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates)
      .where(and(
        eq(checklistTemplates.organizationId, organizationId), 
        eq(checklistTemplates.category, category),
        eq(checklistTemplates.isActive, true)
      ));
  }

  async createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate> {
    const [created] = await db.insert(checklistTemplates).values(template).returning();
    return created;
  }

  async updateChecklistTemplate(id: string, updates: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
    const [updated] = await db.update(checklistTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplate(id: string): Promise<void> {
    await db.update(checklistTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id));
  }

  // Checklist Folders
  async getChecklistFolder(id: string): Promise<ChecklistFolder | undefined> {
    const [folder] = await db.select().from(checklistFolders).where(eq(checklistFolders.id, id));
    return folder;
  }

  async getChecklistFoldersByOrganization(organizationId: string): Promise<ChecklistFolder[]> {
    return await db.select().from(checklistFolders).where(eq(checklistFolders.organizationId, organizationId));
  }

  async createChecklistFolder(folder: InsertChecklistFolder): Promise<ChecklistFolder> {
    const [created] = await db.insert(checklistFolders).values(folder).returning();
    return created;
  }

  async updateChecklistFolder(id: string, updates: Partial<ChecklistFolder>): Promise<ChecklistFolder> {
    const [updated] = await db.update(checklistFolders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(checklistFolders.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistFolder(id: string): Promise<void> {
    await db.delete(checklistFolders).where(eq(checklistFolders.id, id));
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogsByOrganization(organizationId: string, limit = 50): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .where(eq(activityLogs.organizationId, organizationId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }
  
  // Companies
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompaniesByOrganization(organizationId: string): Promise<Company[]> {
    return await db.select().from(companies)
      .where(and(eq(companies.organizationId, organizationId), eq(companies.isActive, true)));
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    const [updated] = await db.update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.update(companies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(companies.id, id));
  }

  // Company Locations
  async getCompanyLocation(id: string): Promise<CompanyLocation | undefined> {
    const [location] = await db.select().from(companyLocations).where(eq(companyLocations.id, id));
    return location;
  }

  async getCompanyLocationsByCompany(companyId: string): Promise<CompanyLocation[]> {
    return await db.select().from(companyLocations)
      .where(and(eq(companyLocations.companyId, companyId), eq(companyLocations.isActive, true)));
  }

  async createCompanyLocation(location: InsertCompanyLocation): Promise<CompanyLocation> {
    const [created] = await db.insert(companyLocations).values(location).returning();
    return created;
  }

  async updateCompanyLocation(id: string, updates: Partial<CompanyLocation>): Promise<CompanyLocation> {
    const [updated] = await db.update(companyLocations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyLocations.id, id))
      .returning();
    return updated;
  }

  async deleteCompanyLocation(id: string): Promise<void> {
    await db.update(companyLocations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(companyLocations.id, id));
  }
}

export const storage = new DatabaseStorage();
