import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOrganizationSchema, insertUserSchema, insertInvitationSchema,
  insertInspectionSchema, insertActionPlanSchema, acceptInviteSchema,
  createInspectionSchema, updateInspectionSchema
} from "@shared/schema";
import { authenticateUser, hasPermission, canAccessOrganization, filterByOrganizationAccess } from "./services/auth";
import { analyzeInspectionFindings, generateActionPlanRecommendations, generateComplianceInsights } from "./services/openai";
import { generateQRCode, generateInspectionReport, generateComplianceReport, calculateComplianceMetrics, generateInviteToken, isTokenValid } from "./services/documents";
import { OpenAIAssistantsService } from "./services/openai-assistants";
import OpenAI from "openai";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize OpenAI services
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let assistantsService: OpenAIAssistantsService | null = null;
  let openai: OpenAI | null = null;
  
  if (openaiApiKey) {
    assistantsService = new OpenAIAssistantsService(openaiApiKey);
    openai = new OpenAI({ apiKey: openaiApiKey });
    // Initialize assistants on startup
    assistantsService.initializeAssistants().catch(console.error);
  }
  
  // Middleware for authentication (simplified - in production use proper auth)
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const userEmail = req.headers['x-user-email'] || 'admin@iasst.com'; // Simplified auth
      const user = await authenticateUser(userEmail as string);
      
      if (!user) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Authentication failed" });
    }
  };

  // Auth endpoint for frontend
  app.get('/api/user/me', async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] || 'admin@iasst.com';
      const user = await authenticateUser(userEmail as string);
      
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Organizations routes
  app.get('/api/organizations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      let organizations = await storage.getOrganizations();
      
      // Filter by access permissions
      if (user?.role !== 'system_admin') {
        organizations = organizations.filter(org => 
          org.id === user?.organizationId || org.parentId === user?.organizationId
        );
      }
      
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/organizations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!user || !hasPermission(user, 'create_organization')) {
        return res.status(403).json({ message: "Sem permissão para criar organizações" });
      }
      
      const orgData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(orgData);
      
      // Log activity
      if (user) {
        await storage.createActivityLog({
          userId: user.id,
          organizationId: organization.id,
          action: 'create_organization',
          entityType: 'organization',
          entityId: organization.id,
          details: { name: organization.name, type: organization.type }
        });
      }
      
      res.status(201).json(organization);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get('/api/organizations/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      if (!user || !canAccessOrganization(user, id)) {
        return res.status(403).json({ message: "Sem permissão para acessar esta organização" });
      }
      
      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({ message: "Organização não encontrada" });
      }
      
      res.json(organization);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // CNPJ lookup endpoint
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    try {
      const cnpj = req.params.cnpj.replace(/\D/g, ''); // Remove formatting
      
      if (cnpj.length !== 14) {
        return res.status(400).json({ message: "CNPJ deve ter 14 dígitos" });
      }

      const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
      const data = await response.json();
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching CNPJ data:", error);
      res.status(500).json({ message: "Erro ao consultar CNPJ" });
    }
  });

  // Companies routes
  app.get('/api/companies', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      const targetOrgId = organizationId as string || user?.organizationId || 'master-org-id';
      
      if (!user || !canAccessOrganization(user, targetOrgId)) {
        return res.status(403).json({ message: "Sem permissão para acessar empresas desta organização" });
      }
      
      const companies = await storage.getCompaniesByOrganization(targetOrgId);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para acessar esta empresa" });
      }
      
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/companies', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!user || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para cadastrar empresas" });
      }
      
      const companyData = {
        ...req.body,
        organizationId: req.body.organizationId || user.organizationId,
        createdBy: user.id
      };
      
      const company = await storage.createCompany(companyData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'create_company',
        entityType: 'company',
        entityId: company.id,
        details: { name: company.name, cnpj: company.cnpj }
      });
      
      res.status(201).json(company);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.put('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId) || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para editar esta empresa" });
      }
      
      const updated = await storage.updateCompany(id, req.body);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'update_company',
        entityType: 'company',
        entityId: id,
        details: { changes: req.body }
      });
      
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/companies/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId) || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para excluir esta empresa" });
      }
      
      await storage.deleteCompany(id);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'delete_company',
        entityType: 'company',
        entityId: id,
        details: { name: company.name }
      });
      
      res.json({ message: "Empresa excluída com sucesso" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Company Locations routes
  app.get('/api/companies/:companyId/locations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { companyId } = req.params;
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para acessar locais desta empresa" });
      }
      
      const locations = await storage.getCompanyLocationsByCompany(companyId);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/companies/:companyId/locations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { companyId } = req.params;
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId) || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para cadastrar locais" });
      }
      
      const locationData = {
        ...req.body,
        companyId,
        createdBy: user.id
      };
      
      const location = await storage.createCompanyLocation(locationData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'create_location',
        entityType: 'location',
        entityId: location.id,
        details: { name: location.name, type: location.type }
      });
      
      res.status(201).json(location);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.put('/api/companies/locations/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const location = await storage.getCompanyLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Local não encontrado" });
      }
      
      const company = await storage.getCompany(location.companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId) || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para editar este local" });
      }
      
      const updated = await storage.updateCompanyLocation(id, req.body);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'update_location',
        entityType: 'location',
        entityId: id,
        details: { changes: req.body }
      });
      
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/companies/locations/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const location = await storage.getCompanyLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Local não encontrado" });
      }
      
      const company = await storage.getCompany(location.companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, company.organizationId) || !hasPermission(user, 'manage_inspections')) {
        return res.status(403).json({ message: "Sem permissão para excluir este local" });
      }
      
      await storage.deleteCompanyLocation(id);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: company.organizationId,
        action: 'delete_location',
        entityType: 'location',
        entityId: id,
        details: { name: location.name }
      });
      
      res.json({ message: "Local excluído com sucesso" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Users routes
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      let users;
      if (organizationId) {
        if (!canAccessOrganization(user, organizationId as string)) {
          return res.status(403).json({ message: "Sem permissão para acessar usuários desta organização" });
        }
        users = await storage.getUsersByOrganization(organizationId as string);
      } else {
        if (user.role === 'system_admin') {
          users = await storage.getUsersByOrganization(user.organizationId!);
        } else {
          users = await storage.getUsersByOrganization(user.organizationId!);
        }
      }
      
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Invitations routes
  app.post('/api/invitations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!user || !hasPermission(user, 'invite_user')) {
        return res.status(403).json({ message: "Sem permissão para convidar usuários" });
      }
      
      const inviteData = insertInvitationSchema.parse({
        ...req.body,
        invitedBy: user.id
      });
      
      const invitation = await storage.createInvitation(inviteData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: invitation.organizationId,
        action: 'invite_user',
        entityType: 'invitation',
        entityId: invitation.id,
        details: { email: invitation.email, role: invitation.role }
      });
      
      res.status(201).json(invitation);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.post('/api/invitations/accept', async (req, res) => {
    try {
      const { token, userInfo } = acceptInviteSchema.parse(req.body);
      
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Convite não encontrado" });
      }
      
      if (invitation.isAccepted) {
        return res.status(400).json({ message: "Convite já foi aceito" });
      }
      
      if (!isTokenValid(invitation.expiresAt)) {
        return res.status(400).json({ message: "Convite expirado" });
      }
      
      // Create user
      const user = await storage.createUser({
        email: userInfo.email,
        name: userInfo.name,
        role: invitation.role,
        organizationId: invitation.organizationId,
        isActive: true
      });
      
      // Mark invitation as accepted
      await storage.updateInvitation(invitation.id, { isAccepted: true });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
        action: 'accept_invitation',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email, role: user.role }
      });
      
      res.json({ user, message: "Convite aceito com sucesso" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Inspections routes

  // Create inspection (COMPIA implementation) - Must be before GET route
  app.post('/api/inspections', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      // Extract all data from request body
      const {
        title,
        location, 
        description,
        checklistTemplateId,
        scheduledAt,
        organizationId,
        priority,
        companyName,
        zipCode,
        fullAddress,
        latitude,
        longitude,
        technicianName,
        technicianEmail,
        companyResponsibleName,
        aiAssistantId,
        actionPlanType
      } = req.body;
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Validate required fields manually
      if (!title || !location) {
        return res.status(400).json({ message: "Campos obrigatórios: title, location" });
      }
      
      // Get the checklist template if provided and not "none"
      let template = null;
      if (checklistTemplateId && checklistTemplateId !== 'none') {
        template = await storage.getChecklistTemplate(checklistTemplateId);
        if (!template) {
          return res.status(404).json({ message: "Template de checklist não encontrado" });
        }
      }
      
      // Process scheduledAt to ensure it's a Date
      let processedScheduledAt = scheduledAt;
      if (scheduledAt && typeof scheduledAt === 'string') {
        processedScheduledAt = new Date(scheduledAt);
      } else if (!scheduledAt) {
        processedScheduledAt = new Date();
      }
      
      // Create inspection data with all new fields
      const inspectionData = {
        title: String(title),
        location: String(location),
        description: description ? String(description) : null,
        checklistTemplateId: (checklistTemplateId && checklistTemplateId !== 'none') ? String(checklistTemplateId) : null,
        scheduledAt: processedScheduledAt,
        status: 'draft' as const,
        organizationId: organizationId || user?.organizationId || 'master-org-id',
        inspectorId: user?.id || 'admin-id',
        
        // New fields
        priority: priority || 'medium',
        companyName: companyName || null,
        zipCode: zipCode || null,
        fullAddress: fullAddress || null,
        latitude: latitude || null,
        longitude: longitude || null,
        technicianName: technicianName || user?.name || null,
        technicianEmail: technicianEmail || user?.email || null,
        companyResponsibleName: companyResponsibleName || null,
        aiAssistantId: aiAssistantId || 'GENERAL',
        actionPlanType: actionPlanType || '5W2H',
        
        // Initialize checklist from template if available
        checklist: template ? template.items : []
      };
      
      console.log('Route - User data:', { id: user?.id, organizationId: user?.organizationId });
      console.log('Route - Inspection data before storage:', inspectionData);
      
      const inspection = await storage.createInspection(inspectionData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user?.id || 'admin-id',
        organizationId: organizationId || user?.organizationId || 'master-org-id',
        action: 'Inspeção criada',
        entityType: 'inspection',
        entityId: inspection.id,
        details: { 
          title, 
          location,
          companyName,
          priority,
          aiAssistantId,
          hasTemplate: !!template
        }
      });
      
      res.status(201).json(inspection);
    } catch (error) {
      console.error('Route error:', error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/inspections/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      // Check permissions
      if (!canAccessOrganization(user, inspection.organizationId) && 
          user.id !== inspection.inspectorId && 
          user.role !== 'system_admin') {
        return res.status(403).json({ message: "Sem permissão para acessar esta inspeção" });
      }
      
      res.json(inspection);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/inspections', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      let inspections;
      if (organizationId && canAccessOrganization(user, organizationId as string)) {
        inspections = await storage.getInspectionsByOrganization(organizationId as string);
      } else if (user.role === 'inspector') {
        inspections = await storage.getInspectionsByInspector(user.id);
      } else {
        inspections = await storage.getInspectionsByOrganization(user.organizationId!);
      }
      
      // Filter by permissions
      inspections = await filterByOrganizationAccess(user, inspections);
      
      res.json(inspections);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });


  app.patch('/api/inspections/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || (!hasPermission(user, 'edit_inspection') && inspection.inspectorId !== user.id)) {
        return res.status(403).json({ message: "Sem permissão para editar esta inspeção" });
      }
      
      const updates = req.body;
      
      // Add timestamp fields based on status change
      if (updates.status) {
        const now = new Date();
        if (updates.status === 'in_progress' && !inspection.startedAt) {
          updates.startedAt = now;
        } else if (updates.status === 'completed' && !inspection.completedAt) {
          updates.completedAt = now;
        }
      }
      
      // If findings are provided, analyze with AI
      if (updates.findings && updates.findings.length > 0) {
        try {
          const analysis = await analyzeInspectionFindings({
            title: inspection.title,
            location: inspection.location,
            description: inspection.description || undefined,
            checklist: inspection.checklist as any[],
            findings: updates.findings
          });
          
          updates.recommendations = analysis.summary;
          (updates as any).aiAnalysis = JSON.stringify(analysis);
        } catch (aiError) {
          console.error("AI analysis failed:", aiError);
          // Continue without AI analysis if it fails
        }
      }
      
      const updatedInspection = await storage.updateInspection(id, updates);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: inspection.organizationId,
        action: 'update_inspection',
        entityType: 'inspection',
        entityId: id,
        details: { status: updates.status, findingsCount: updates.findings?.length }
      });
      
      res.json(updatedInspection);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.post('/api/inspections/:id/clone', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const originalInspection = await storage.getInspection(id);
      if (!originalInspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, originalInspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para clonar esta inspeção" });
      }
      
      // Create cloned inspection with basic data only
      const clonedData = {
        title: `${originalInspection.title} (Cópia)`,
        description: originalInspection.description,
        location: originalInspection.location,
        checklistTemplateId: originalInspection.checklistTemplateId,
        organizationId: originalInspection.organizationId,
        inspectorId: user.id,
      };
      
      const clonedInspection = await storage.createInspection(clonedData);
      
      // Log activity
      if (user) {
        await storage.createActivityLog({
          userId: user.id,
          organizationId: originalInspection.organizationId,
          action: 'clone_inspection',
          entityType: 'inspection',
          entityId: clonedInspection.id,
          details: { originalId: id, title: clonedInspection.title }
        });
      }
      
      res.status(201).json(clonedInspection);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/inspections/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || !hasPermission(user, 'delete_inspection') || !canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para excluir esta inspeção" });
      }
      
      await storage.deleteInspection(id);
      
      // Log activity
      if (user) {
        await storage.createActivityLog({
          userId: user.id,
          organizationId: inspection.organizationId,
          action: 'delete_inspection',
          entityType: 'inspection',
          entityId: id,
          details: { title: inspection.title }
        });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Action Plans routes
  app.get('/api/action-plans', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { inspectionId, organizationId } = req.query;
      
      let actionPlans;
      if (inspectionId) {
        actionPlans = await storage.getActionPlansByInspection(inspectionId as string);
      } else if (organizationId && canAccessOrganization(user, organizationId as string)) {
        actionPlans = await storage.getActionPlansByOrganization(organizationId as string);
      } else {
        actionPlans = await storage.getActionPlansByOrganization(user.organizationId!);
      }
      
      // Filter by permissions
      actionPlans = await filterByOrganizationAccess(user, actionPlans);
      
      res.json(actionPlans);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/action-plans', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!hasPermission(user, 'manage_action_plans')) {
        return res.status(403).json({ message: "Sem permissão para criar planos de ação" });
      }
      
      const planData = insertActionPlanSchema.parse({
        ...req.body,
        organizationId: user.organizationId
      });
      
      const actionPlan = await storage.createActionPlan(planData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
        action: 'create_action_plan',
        entityType: 'action_plan',
        entityId: actionPlan.id,
        details: { title: actionPlan.title, priority: actionPlan.priority }
      });
      
      res.status(201).json(actionPlan);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.post('/api/action-plans/generate', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { finding } = req.body;
      
      if (!hasPermission(user, 'manage_action_plans')) {
        return res.status(403).json({ message: "Sem permissão para gerar planos de ação" });
      }
      
      const recommendations = await generateActionPlanRecommendations(finding);
      
      res.json(recommendations);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Dashboard and Analytics routes
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      const targetOrgId = organizationId as string || user?.organizationId || 'master-org-id';
      
      if (!user || !canAccessOrganization(user, targetOrgId)) {
        return res.status(403).json({ message: "Sem permissão para acessar dados desta organização" });
      }
      
      const inspections = await storage.getInspectionsByOrganization(targetOrgId);
      const actionPlans = await storage.getActionPlansByOrganization(targetOrgId);
      const users = await storage.getUsersByOrganization(targetOrgId);
      const organizations = await storage.getOrganizationsByParent(targetOrgId);
      
      const metrics = calculateComplianceMetrics(inspections, actionPlans);
      
      const stats = {
        inspections: inspections.length,
        nonCompliances: metrics.nonCompliances,
        completedActions: metrics.completedActions,
        activeOrganizations: organizations.length + 1, // Include current org
        complianceRate: metrics.complianceRate,
        actionCompletionRate: metrics.actionCompletionRate,
        overdueActions: metrics.overdueActions,
        activeUsers: users.filter(u => u.isActive).length
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/dashboard/insights', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      const targetOrgId = organizationId as string || user?.organizationId || 'master-org-id';
      
      if (!user || !canAccessOrganization(user, targetOrgId)) {
        return res.status(403).json({ message: "Sem permissão para acessar insights desta organização" });
      }
      
      const inspections = await storage.getInspectionsByOrganization(targetOrgId);
      const actionPlans = await storage.getActionPlansByOrganization(targetOrgId);
      
      const metrics = calculateComplianceMetrics(inspections, actionPlans);
      
      const insights = await generateComplianceInsights({
        inspections: inspections.length,
        nonCompliances: metrics.nonCompliances,
        completedActions: metrics.completedActions,
        period: "Últimos 30 dias"
      });
      
      res.json(insights);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Checklist Templates - Extended functionality
  const normalizeTemplateItems = (body: any): any[] => {
    const source: any[] =
      Array.isArray(body?.fields) && body.fields.length > 0
        ? body.fields
        : Array.isArray(body?.items)
          ? body.items
          : [];

    if (source.length === 0) {
      return [];
    }

    const timestamp = Date.now();

    return source.map((rawItem: any, index: number) => {
      const idCandidate = rawItem.id ?? rawItem.item_id ?? rawItem.field_id;
      const id = idCandidate ? String(idCandidate) : `item-${timestamp}-${index}`;
      const rawType = rawItem.type ?? rawItem.field_type ?? rawItem.question_type;
      let type = typeof rawType === "string" ? rawType.trim().toLowerCase() : "text";
      if (!type) {
        type = "text";
      }
      if (type === "boolean") {
        type = "checkbox";
      }

      const label =
        rawItem.item ??
        rawItem.label ??
        rawItem.field_name ??
        rawItem.name ??
        rawItem.title ??
        `Item ${index + 1}`;

      const rawOptions = rawItem.options ?? rawItem.choices ?? rawItem.values;
      let options: string[] | undefined;
      if (Array.isArray(rawOptions)) {
        options = rawOptions.map((option: any) => String(option).trim()).filter(Boolean);
      } else if (typeof rawOptions === "string") {
        options = rawOptions
          .split(/[\n,|;]/)
          .map((option: string) => option.trim())
          .filter(Boolean);
      }

      const requiredValue = rawItem.isRequired ?? rawItem.required ?? rawItem.is_required ?? false;
      const isRequired =
        typeof requiredValue === "string"
          ? ["true", "1", "yes", "sim"].includes(requiredValue.trim().toLowerCase())
          : Boolean(requiredValue);

      const weightValue =
        typeof rawItem.weight === "number"
          ? rawItem.weight
          : typeof rawItem.weight === "string" && rawItem.weight.trim()
            ? Number(rawItem.weight)
            : undefined;

      return {
        id,
        type,
        item: label,
        label,
        description: rawItem.description ?? rawItem.helpText ?? rawItem.standardDescription ?? undefined,
        standard: rawItem.standard ?? undefined,
        category: rawItem.category ?? rawItem.field_category ?? undefined,
        isRequired,
        required: isRequired,
        options,
        min: rawItem.min ?? rawItem.minValue ?? undefined,
        max: rawItem.max ?? rawItem.maxValue ?? undefined,
        placeholder: rawItem.placeholder ?? undefined,
        order: typeof rawItem.order === "number" ? rawItem.order : index,
        referenceImage: rawItem.referenceImage ?? undefined,
        helpText: rawItem.helpText ?? undefined,
        weight: weightValue ?? 1
      };
    });
  };

  const normalizeTags = (tags: any): string[] => {
    if (!tags) {
      return [];
    }

    if (Array.isArray(tags)) {
      return tags.map(tag => String(tag).trim()).filter(Boolean);
    }

    if (typeof tags === "string") {
      return tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    return [];
  };

  const resolveBoolean = (value: any, fallback = false): boolean => {
    if (value === undefined || value === null) {
      return fallback;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return fallback;
      }
      return ["true", "1", "yes", "sim", "on"].includes(normalized);
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    return fallback;
  };

  app.post('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;

      if (!user || !hasPermission(user, 'create_inspection')) {
        return res.status(403).json({ message: "Sem permissão para criar templates" });
      }

      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name) {
        return res.status(400).json({ message: "Nome do template é obrigatório" });
      }

      let organizationId = user.organizationId || 'master-org-id';
      if (req.body.organizationId && req.body.organizationId !== organizationId) {
        if (!canAccessOrganization(user, req.body.organizationId)) {
          return res.status(403).json({ message: "Sem permissão para criar templates nesta organização" });
        }
        organizationId = req.body.organizationId;
      }

      const items = normalizeTemplateItems(req.body);
      if (items.length === 0) {
        return res.status(400).json({ message: "Template deve conter pelo menos um item" });
      }

      const folderId = req.body.folderId ?? req.body.parentFolderId ?? req.body.parent_folder_id ?? null;
      const category = typeof req.body.category === 'string' && req.body.category.trim()
        ? req.body.category
        : 'geral';

      const templateData: any = {
        name,
        description: req.body.description ?? null,
        category,
        organizationId,
        items,
        tags: normalizeTags(req.body.tags),
        isActive: resolveBoolean(req.body.isActive, true),
        isDefault: resolveBoolean(req.body.isDefault, false),
        isPublic: resolveBoolean(req.body.isPublic ?? req.body.is_public, false),
        createdBy: user.id,
        fieldCount: items.length
      };

      templateData.folderId = folderId ?? null;
      if (req.body.parentCategoryId !== undefined) {
        templateData.parentCategoryId = req.body.parentCategoryId;
      }
      if (req.body.categoryPath !== undefined) {
        templateData.categoryPath = req.body.categoryPath;
      }
      if (req.body.displayOrder !== undefined) {
        templateData.displayOrder = req.body.displayOrder;
      }

      const template = await storage.createChecklistTemplate(templateData);

      await storage.createActivityLog({
        userId: user.id,
        organizationId,
        action: 'create_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: template.name, category: template.category }
      });

      res.status(201).json({
        ...template,
        parent_folder_id: template.folderId ?? null,
        is_public: (template as any).is_public ?? template.isPublic ?? templateData.isPublic,
        fields_count: template.fieldCount ?? items.length
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/checklist-templates/:id/duplicate', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const originalTemplate = await storage.getChecklistTemplate(id);
      if (!originalTemplate) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      const duplicatedTemplate = await storage.createChecklistTemplate({
        ...originalTemplate,
        id: undefined,
        name: `${originalTemplate.name} (Cópia)`,
        createdBy: user.id,
        createdAt: undefined,
        updatedAt: undefined
      });
      
      res.status(201).json(duplicatedTemplate);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/checklist-templates/folder', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      // Create folder as a special type of template with category='__folder__'
      const folderData = {
        name: req.body.name,
        description: JSON.stringify({
          is_category_folder: true,
          folder_icon: req.body.icon || 'folder',
          folder_color: req.body.color || 'blue',
          parent_folder_id: req.body.parent_folder_id || null,
          user_description: req.body.description || ''
        }),
        category: '__folder__', // Special category for folders
        items: [], // Folders don't have items
        organizationId: user.organizationId,
        isActive: true,
        isDefault: false,
        createdBy: user.id
      };
      
      const folder = await storage.createChecklistTemplate(folderData);
      
      // Transform response to include folder metadata
      const folderMetadata = JSON.parse(folder.description || '{}');
      res.status(201).json({
        ...folder,
        is_category_folder: true,
        folder_icon: folderMetadata.folder_icon,
        folder_color: folderMetadata.folder_color,
        parent_folder_id: folderMetadata.parent_folder_id,
        description: folderMetadata.user_description
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;

      const template = await storage.getChecklistTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      if (!user || !canAccessOrganization(user, template.organizationId) || !hasPermission(user, 'manage_organization')) {
        return res.status(403).json({ message: "Sem permissão para excluir este template" });
      }

      await storage.deleteChecklistTemplate(id);

      await storage.createActivityLog({
        userId: user.id,
        organizationId: template.organizationId,
        action: 'delete_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: template.name }
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // GET route for import page (returns empty template for the UI)
  app.get('/api/checklist-templates/import', requireAuth, async (req, res) => {
    // Return an empty template structure for the import page
    res.json({
      id: 'import',
      name: 'Importar Checklist CSV',
      description: 'Importe um checklist a partir de um arquivo CSV',
      category: 'import',
      items: []
    });
  });

  // GET route for AI generator page
  app.get('/api/checklist-templates/ai-generator', requireAuth, async (req, res) => {
    // Return an empty template structure for the AI generator page
    res.json({
      id: 'ai-generator',
      name: 'Gerar Checklist com IA',
      description: 'Gere um checklist usando inteligência artificial',
      category: 'ai',
      items: []
    });
  });

  // Import checklist from CSV
  app.post('/api/checklist-templates/import', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      if (!user?.organizationId) {
        return res.status(403).json({ message: 'Usuário sem organização' });
      }

      const { csv_content, name, description, parent_folder_id } = req.body;
      const lines = (csv_content || '').split('\n').filter((line: string) => line.trim());

      if (lines.length === 0) {
        return res.status(400).json({ message: 'Arquivo CSV vazio ou inválido' });
      }

      const fields = lines.map((line: string, index: number) => ({
        label: line.trim(),
        type: 'checkbox',
        required: false,
        order: index
      }));

      const items = normalizeTemplateItems({ fields });

      const templateData: any = {
        name: name || 'Checklist Importado',
        description: description || 'Importado via CSV',
        category: req.body.category || 'geral',
        organizationId: user.organizationId,
        items,
        tags: [],
        isActive: true,
        isDefault: false,
        isPublic: false,
        createdBy: user.id,
        fieldCount: items.length,
        folderId: parent_folder_id ?? null
      };

      const created = await storage.createChecklistTemplate(templateData);

      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId,
        action: 'import_checklist_template',
        entityType: 'checklist_template',
        entityId: created.id,
        details: { name: created.name, source: 'csv-simple' }
      });

      res.status(201).json({
        ...created,
        parent_folder_id: created.folderId ?? null,
        is_public: (created as any).is_public ?? created.isPublic ?? false,
        fields_count: created.fieldCount ?? items.length
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Generate checklist with AI
  app.post('/api/checklist-templates/ai-generator', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      if (!user?.organizationId) {
        return res.status(403).json({ message: 'Usuário sem organização' });
      }
      
      const { prompt, category, name, parent_folder_id } = req.body;
      
      // Generate checklist items based on prompt
      // For now, return a template response
      const template = {
        name: name || 'Checklist Gerado por IA',
        description: `Gerado com IA: ${prompt}`,
        category: parent_folder_id || category || 'geral',
        items: [
          { id: '1', text: 'Item gerado 1', type: 'checkbox' as const, required: true },
          { id: '2', text: 'Item gerado 2', type: 'checkbox' as const, required: false },
          { id: '3', text: 'Item gerado 3', type: 'checkbox' as const, required: false }
        ],
        organizationId: user.organizationId,
        isActive: true,
        isDefault: false,
        createdBy: user.id,
        parentFolderId: parent_folder_id
      };
      
      const created = await storage.createChecklistTemplate(template);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Checklist Templates routes
  app.get('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { category } = req.query;
      
      let templates;
      if (category && typeof category === 'string') {
        templates = await storage.getChecklistTemplatesByCategory(user?.organizationId || 'master-org-id', category);
      } else {
        templates = await storage.getChecklistTemplatesByOrganization(user?.organizationId || 'master-org-id');
      }
      
      // Transform templates to include folder metadata
      const transformedTemplates = templates.map(template => {
        const base = {
          ...template,
          parent_folder_id: template.folderId ?? null,
          fields_count: template.fieldCount ?? (Array.isArray((template as any).items) ? (template as any).items.length : 0),
          created_at: template.createdAt,
          updated_at: template.updatedAt,
          is_public: (template as any).is_public ?? template.isPublic ?? false
        };

        if (template.category === '__folder__' && template.description) {
          try {
            const metadata = JSON.parse(template.description);
            return {
              ...base,
              is_category_folder: true,
              folder_icon: metadata.folder_icon || 'folder',
              folder_color: metadata.folder_color || 'blue',
              parent_folder_id: metadata.parent_folder_id || null,
              description: metadata.user_description || '',
              fields_count: 0,
              is_public: false
            };
          } catch (e) {
            console.error('Error parsing folder metadata:', e);
          }
        }

        return {
          ...base,
          is_category_folder: false
        };
      });
      
      res.json(transformedTemplates);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const template = await storage.getChecklistTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (!canAccessOrganization(user, template.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para acessar este template" });
      }
      
      res.json({
        ...template,
        parent_folder_id: template.folderId ?? null,
        is_public: (template as any).is_public ?? template.isPublic ?? false,
        fields_count: template.fieldCount ?? (Array.isArray((template as any).items) ? (template as any).items.length : 0)
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;

      const template = await storage.getChecklistTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }

      if (!user || !canAccessOrganization(user, template.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para editar este template" });
      }

      const hasFieldUpdates = Array.isArray(req.body.fields) && req.body.fields.length > 0;
      const hasItemUpdates = Array.isArray(req.body.items) && req.body.items.length > 0;

      const updates: any = {};

      if (typeof req.body.name === 'string') {
        updates.name = req.body.name.trim();
      }
      if ('description' in req.body) {
        updates.description = req.body.description ?? null;
      }
      if (typeof req.body.category === 'string') {
        updates.category = req.body.category;
      }
      if ('folderId' in req.body || 'parentFolderId' in req.body || 'parent_folder_id' in req.body) {
        updates.folderId = req.body.folderId ?? req.body.parentFolderId ?? req.body.parent_folder_id ?? null;
      }
      if ('tags' in req.body) {
        updates.tags = normalizeTags(req.body.tags);
      }
      if ('isPublic' in req.body || 'is_public' in req.body) {
        updates.isPublic = resolveBoolean(req.body.isPublic ?? req.body.is_public, template.isPublic ?? false);
      }
      if ('isActive' in req.body) {
        updates.isActive = resolveBoolean(req.body.isActive, template.isActive ?? true);
      }
      if ('isDefault' in req.body) {
        updates.isDefault = resolveBoolean(req.body.isDefault, template.isDefault ?? false);
      }
      if ('displayOrder' in req.body) {
        updates.displayOrder = req.body.displayOrder;
      }
      if ('parentCategoryId' in req.body) {
        updates.parentCategoryId = req.body.parentCategoryId;
      }
      if ('categoryPath' in req.body) {
        updates.categoryPath = req.body.categoryPath;
      }

      if (hasFieldUpdates || hasItemUpdates) {
        const items = normalizeTemplateItems(req.body);
        if (items.length === 0) {
          return res.status(400).json({ message: "Template deve conter pelo menos um item" });
        }
        updates.items = items;
        updates.fieldCount = items.length;
      }

      if (Object.keys(updates).length === 0) {
        return res.json({
          ...template,
          parent_folder_id: template.folderId ?? null,
          is_public: (template as any).is_public ?? template.isPublic ?? false,
          fields_count: template.fieldCount ?? (Array.isArray((template as any).items) ? (template as any).items.length : 0)
        });
      }

      const updatedTemplate = await storage.updateChecklistTemplate(id, updates);

      await storage.createActivityLog({
        userId: user.id,
        organizationId: template.organizationId,
        action: 'update_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: updatedTemplate.name }
      });

      res.json({
        ...updatedTemplate,
        parent_folder_id: updatedTemplate.folderId ?? null,
        is_public: (updatedTemplate as any).is_public ?? updatedTemplate.isPublic ?? false,
        fields_count: updatedTemplate.fieldCount ?? (Array.isArray((updatedTemplate as any).items) ? (updatedTemplate as any).items.length : 0)
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });


  // Reports routes
  app.get('/api/reports/inspection/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para acessar este relatório" });
      }
      
      const actionPlans = await storage.getActionPlansByInspection(id);
      const report = generateInspectionReport(inspection, actionPlans);
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get('/api/reports/compliance', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
      const targetOrgId = organizationId as string || user.organizationId!;
      
      if (!canAccessOrganization(user, targetOrgId)) {
        return res.status(403).json({ message: "Sem permissão para acessar este relatório" });
      }
      
      const organization = await storage.getOrganization(targetOrgId);
      const inspections = await storage.getInspectionsByOrganization(targetOrgId);
      const actionPlans = await storage.getActionPlansByOrganization(targetOrgId);
      
      const metrics = calculateComplianceMetrics(inspections, actionPlans);
      
      const report = generateComplianceReport(organization, {
        inspections,
        actionPlans,
        stats: {
          ...metrics,
          periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          periodEnd: new Date(),
          complianceTrend: "stable" // This would be calculated from historical data
        }
      });
      
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Activity logs
  app.get('/api/activity-logs', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId, limit } = req.query;
      
      const targetOrgId = organizationId as string || user.organizationId!;
      
      if (!canAccessOrganization(user, targetOrgId)) {
        return res.status(403).json({ message: "Sem permissão para acessar logs desta organização" });
      }
      
      const logs = await storage.getActivityLogsByOrganization(
        targetOrgId, 
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // AI Chatbot route
  app.post('/api/ai/chatbot', requireAuth, async (req, res) => {
    try {
      const { simpleAI } = await import('./services/simple-ai');
      const { message } = req.body;
      const response = await simpleAI.chatResponse(message);
      
      res.json({ response });
    } catch (error) {
      console.error('Chatbot error:', error);
      res.status(500).json({ message: "Erro ao processar mensagem" });
    }
  });

  // AI-powered checklist generation
  app.post('/api/checklist-templates/generate-ai', requireAuth, async (req, res) => {
    try {
      if (!openai) {
        return res.status(503).json({ message: "Serviço de IA não disponível" });
      }
      
      const { user } = req;
      const { 
        industry, location_type, template_name, category,
        num_questions, specific_requirements, assistant
      } = req.body;
      
      // Generate checklist using selected assistant
      let prompt = `Crie um checklist de inspeção de segurança do trabalho com ${num_questions} perguntas para:
      - Indústria: ${industry}
      - Tipo de Local: ${location_type}
      - Requisitos específicos: ${specific_requirements || 'Nenhum'}
      
      O checklist deve ser detalhado e seguir as melhores práticas de SST.
      Retorne como JSON com formato: { items: [{ type: string, label: string, description: string, required: boolean, options?: string[] }] }`;
      
      // Use assistant if specified and available
      let aiResponse;
      if (assistant && assistant !== 'GENERAL' && assistantsService) {
        const result = await assistantsService.analyzeWithAssistant(assistant, prompt);
        aiResponse = result.analysis;
      } else {
        // Use regular OpenAI completion
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        aiResponse = completion.choices[0].message.content;
      }
      
      const checklistData = JSON.parse(aiResponse || '{}');
      
      // Save to database
      const template = await storage.createChecklistTemplate({
        name: template_name,
        category,
        organizationId: user.organizationId!,
        items: checklistData.items || checklistData,
        tags: [industry, location_type],
        createdBy: user.id
      });
      
      res.json(template);
    } catch (error) {
      console.error('AI generation error:', error);
      res.status(500).json({ message: "Erro ao gerar checklist com IA" });
    }
  });

  // Generate CSV from AI prompt
  app.post('/api/checklist-templates/generate-from-prompt', requireAuth, async (req, res) => {
    try {
      if (!openai) {
        return res.status(503).json({ message: "Serviço de IA não disponível" });
      }
      
      const { prompt } = req.body;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `${prompt}
          
          Gere um CSV para este checklist com as seguintes colunas:
          campo,tipo,obrigatorio,opcoes,descricao
          
          Tipos disponíveis: text, textarea, select, multiselect, checkbox, radio, boolean, date, time, datetime, number, rating, file, signature, location
          
          Para campos com opções (select, radio, multiselect), separe as opções com pipe (|).
          
          IMPORTANTE: Retorne APENAS o conteúdo CSV puro, sem markdown, sem explicações e sem formatação adicional.`
        }]
      });
      
      const csv = completion.choices[0]?.message?.content || '';
      
      // Clean up any markdown formatting
      let cleanCsv = csv;
      if (cleanCsv.includes('```')) {
        cleanCsv = cleanCsv.replace(/```csv\n?/g, '').replace(/```/g, '');
      }
      
      res.json({ csv: cleanCsv.trim() });
    } catch (error) {
      console.error('CSV generation error:', error);
      res.status(500).json({ message: "Erro ao gerar CSV" });
    }
  });

  // Import CSV checklist
  app.post('/api/checklist-templates/import-csv', requireAuth, async (req, res) => {
    try {
      const { user } = req;

      if (!user || !hasPermission(user, 'create_inspection')) {
        return res.status(403).json({ message: "Sem permissão para importar templates" });
      }

      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name) {
        return res.status(400).json({ message: "Nome do template é obrigatório" });
      }

      const category = typeof req.body.category === 'string' && req.body.category.trim()
        ? req.body.category
        : 'geral';

      const fieldsInput = Array.isArray(req.body.fields) ? { fields: req.body.fields } : {};
      const items = normalizeTemplateItems(fieldsInput);

      if (items.length === 0) {
        return res.status(400).json({ message: "Nenhum campo válido encontrado para importação" });
      }

      let organizationId = user.organizationId || 'master-org-id';
      if (req.body.organizationId && req.body.organizationId !== organizationId) {
        if (!canAccessOrganization(user, req.body.organizationId)) {
          return res.status(403).json({ message: "Sem permissão para criar templates nesta organização" });
        }
        organizationId = req.body.organizationId;
      }

      const folderId = req.body.folderId ?? req.body.parentFolderId ?? req.body.parent_folder_id ?? null;

      const templateData: any = {
        name,
        description: req.body.description ?? (req.body.csvData ? 'Importado via CSV' : null),
        category,
        organizationId,
        items,
        tags: normalizeTags(req.body.tags),
        isPublic: resolveBoolean(req.body.isPublic ?? req.body.is_public, false),
        createdBy: user.id,
        fieldCount: items.length
      };

      templateData.folderId = folderId ?? null;

      const template = await storage.createChecklistTemplate(templateData);

      await storage.createActivityLog({
        userId: user.id,
        organizationId,
        action: 'import_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: template.name, source: 'csv' }
      });

      res.status(201).json({
        ...template,
        parent_folder_id: template.folderId ?? null,
        is_public: (template as any).is_public ?? template.isPublic ?? templateData.isPublic,
        fields_count: template.fieldCount ?? items.length
      });
    } catch (error) {
      console.error('CSV import error:', error);
      res.status(500).json({ message: "Erro ao importar CSV" });
    }
  });

  // Create folder for checklist templates
  app.post('/api/checklist-folders', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { name, description, parentId, icon, color } = req.body;
      
      const folder = await storage.createChecklistFolder({
        name,
        description,
        parentId: parentId || null,
        organizationId: user?.organizationId || 'master-org-id',
        icon: icon || 'folder',
        color: color || '#3B82F6',
        createdBy: user?.id || 'admin-id'
      });
      
      res.json(folder);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get checklist folders
  app.get('/api/checklist-folders', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const folders = await storage.getChecklistFoldersByOrganization(user?.organizationId || 'master-org-id');
      res.json(folders);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Start inspection
  app.post('/api/inspections/:id/start', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      
      const updated = await storage.updateInspection(id, {
        status: 'in_progress',
        startedAt: new Date()
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: user?.id || 'admin-id',
        organizationId: user?.organizationId || 'master-org-id',
        action: 'Inspeção iniciada',
        entityType: 'inspection',
        entityId: id,
        details: { status: 'in_progress' }
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Complete inspection
  app.post('/api/inspections/:id/complete', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      const { responses } = req.body;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      
      // Calculate findings
      const conformities = Object.values(responses || {}).filter((r: any) => r.status === 'conform').length;
      const nonConformities = Object.values(responses || {}).filter((r: any) => r.status === 'non-conform').length;
      const total = Object.keys(responses || {}).length;
      const score = total > 0 ? Math.round((conformities / total) * 100) : 0;
      
      const updated = await storage.updateInspection(id, {
        status: 'completed',
        completedAt: new Date(),
        findings: {
          conformities,
          nonConformities,
          score,
          details: responses
        }
      });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Analyze inspection with AI
  app.post('/api/inspections/:id/analyze', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const inspection = await storage.getInspection(id);
      if (!inspection) {
        return res.status(404).json({ message: "Inspeção não encontrada" });
      }
      
      if (!user || !canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      
      if (assistantsService) {
        const analysis = await assistantsService.analyzeInspection(inspection);
        
        const updated = await storage.updateInspection(id, {
          aiAnalysis: analysis.analysis
        });
        
        res.json(updated);
      } else {
        res.status(503).json({ message: "Serviço de análise IA não disponível" });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ message: "Erro ao analisar inspeção" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
