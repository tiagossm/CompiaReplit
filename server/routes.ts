import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOrganizationSchema, insertUserSchema, insertInvitationSchema,
  insertInspectionSchema, insertActionPlanSchema, acceptInviteSchema,
  createInspectionSchema, updateInspectionSchema, createChecklistTemplateSchema
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
    const userEmail = req.headers['x-user-email'] || 'admin@iasst.com'; // Simplified auth
    const user = await authenticateUser(userEmail as string);
    
    if (!user) {
      return res.status(401).json({ message: "Não autorizado" });
    }
    
    req.user = user;
    next();
  };

  // Organizations routes
  app.get('/api/organizations', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      let organizations = await storage.getOrganizations();
      
      // Filter by access permissions
      if (user.role !== 'system_admin') {
        organizations = organizations.filter(org => 
          org.id === user.organizationId || org.parentId === user.organizationId
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
      
      if (!hasPermission(user, 'create_organization')) {
        return res.status(403).json({ message: "Sem permissão para criar organizações" });
      }
      
      const orgData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(orgData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: organization.id,
        action: 'create_organization',
        entityType: 'organization',
        entityId: organization.id,
        details: { name: organization.name, type: organization.type }
      });
      
      res.status(201).json(organization);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.get('/api/organizations/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      if (!canAccessOrganization(user, id)) {
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

  // Users routes
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
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
      
      if (!hasPermission(user, 'invite_user')) {
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
  app.get('/api/inspections', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { organizationId } = req.query;
      
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

  app.post('/api/inspections', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!hasPermission(user, 'create_inspection')) {
        return res.status(403).json({ message: "Sem permissão para criar inspeções" });
      }
      
      const inspectionData = createInspectionSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
        inspectorId: user.id
      });
      
      const inspection = await storage.createInspection(inspectionData);
      
      // Generate QR code for inspection
      const qrData = `${process.env.BASE_URL || 'http://localhost:5000'}/inspections/${inspection.id}`;
      const qrCode = await generateQRCode(qrData);
      
      // Update inspection with QR code
      const updatedInspection = await storage.updateInspection(inspection.id, { qrCode });
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
        action: 'create_inspection',
        entityType: 'inspection',
        entityId: inspection.id,
        details: { title: inspection.title, location: inspection.location }
      });
      
      res.status(201).json(updatedInspection);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
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
      
      if (!hasPermission(user, 'edit_inspection') && inspection.inspectorId !== user.id) {
        return res.status(403).json({ message: "Sem permissão para editar esta inspeção" });
      }
      
      const updates = updateInspectionSchema.parse(req.body);
      
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
      
      const targetOrgId = organizationId as string || user.organizationId!;
      
      if (!canAccessOrganization(user, targetOrgId)) {
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
      
      const targetOrgId = organizationId as string || user.organizationId!;
      
      if (!canAccessOrganization(user, targetOrgId)) {
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

  // Checklist Templates routes
  app.get('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { category } = req.query;
      
      let templates;
      if (category && typeof category === 'string') {
        templates = await storage.getChecklistTemplatesByCategory(user.organizationId!, category);
      } else {
        templates = await storage.getChecklistTemplatesByOrganization(user.organizationId!);
      }
      
      res.json(templates);
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
      
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      
      if (!hasPermission(user, 'create_inspection')) {
        return res.status(403).json({ message: "Sem permissão para criar templates" });
      }
      
      const templateData = createChecklistTemplateSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
        createdBy: user.id
      });
      
      const template = await storage.createChecklistTemplate(templateData);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
        action: 'create_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: template.name, category: template.category }
      });
      
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.put('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const template = await storage.getChecklistTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (!canAccessOrganization(user, template.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para editar este template" });
      }
      
      const updates = createChecklistTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateChecklistTemplate(req.params.id, updates);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
        action: 'update_checklist_template',
        entityType: 'checklist_template',
        entityId: template.id,
        details: { name: template.name }
      });
      
      res.json(updatedTemplate);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  });

  app.delete('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const template = await storage.getChecklistTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (!canAccessOrganization(user, template.organizationId) || !hasPermission(user, 'manage_organization')) {
        return res.status(403).json({ message: "Sem permissão para excluir este template" });
      }
      
      await storage.deleteChecklistTemplate(req.params.id);
      
      // Log activity
      await storage.createActivityLog({
        userId: user.id,
        organizationId: user.organizationId!,
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
      const { name, category, csvData, fields } = req.body;
      
      // Convert fields to template format
      const items = fields.map((field: any) => ({
        type: field.type,
        label: field.name || field.label,
        description: field.description,
        required: field.required || false,
        options: field.options,
        order: field.order
      }));
      
      const template = await storage.createChecklistTemplate({
        name,
        category,
        organizationId: user.organizationId!,
        items,
        createdBy: user.id
      });
      
      res.json(template);
    } catch (error) {
      console.error('CSV import error:', error);
      res.status(500).json({ message: "Erro ao importar CSV" });
    }
  });

  // Manual checklist creation
  app.post('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { name, description, category, fields, tags } = req.body;
      
      const items = fields.map((field: any) => ({
        type: field.type,
        label: field.label,
        description: field.description,
        required: field.required || false,
        options: field.options,
        min: field.min,
        max: field.max,
        placeholder: field.placeholder,
        order: field.order
      }));
      
      const template = await storage.createChecklistTemplate({
        name,
        description,
        category,
        organizationId: user.organizationId!,
        items,
        tags,
        createdBy: user.id
      });
      
      res.json(template);
    } catch (error) {
      console.error('Template creation error:', error);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });

  // Get checklist templates
  app.get('/api/checklist-templates', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const templates = await storage.getChecklistTemplatesByOrganization(user.organizationId!);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get single checklist template
  app.get('/api/checklist-templates/:id', requireAuth, async (req, res) => {
    try {
      const { user } = req;
      const { id } = req.params;
      
      const template = await storage.getChecklistTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      
      if (!canAccessOrganization(user, template.organizationId)) {
        return res.status(403).json({ message: "Sem permissão para acessar este template" });
      }
      
      res.json(template);
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
      
      if (!canAccessOrganization(user, inspection.organizationId)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      
      const updated = await storage.updateInspection(id, {
        status: 'in_progress',
        startedAt: new Date()
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
      
      if (!canAccessOrganization(user, inspection.organizationId)) {
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
      
      if (!canAccessOrganization(user, inspection.organizationId)) {
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
