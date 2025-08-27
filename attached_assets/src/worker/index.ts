import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie } from "hono/cookie";
import {
  authMiddleware,
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";

import multiTenantRoutes from "./multi-tenant-routes";
import usersRoutes from "./users-routes";
import checklistRoutes from "./checklist-routes";
import adminDebugRoutes from "./admin-debug-routes";
import { USER_ROLES } from "@/shared/user-types";
import {
  AIAnalysisRequestSchema
} from "@/shared/types";

// OpenAI para funcionalidades de IA - Importação estática para evitar problemas de bundle
let OpenAIClient: any = null;
async function getOpenAIClient(apiKey: string) {
  if (!OpenAIClient) {
    try {
      // Import estático para evitar conflitos de assets
      const { default: OpenAI } = await import('openai');
      OpenAIClient = OpenAI;
    } catch (error) {
      console.error('[OPENAI] Erro ao importar biblioteca OpenAI:', error);
      throw new Error('Falha ao carregar biblioteca de IA');
    }
  }
  return new OpenAIClient({
    apiKey,
    timeout: 30000,
    maxRetries: 2,
  });
}

// Import Env interface from worker configuration
interface Env {
  DB: any; // D1Database type from Cloudflare Workers
  OPENAI_API_KEY?: string;
  MOCHA_USERS_SERVICE_API_KEY?: string;
  MOCHA_USERS_SERVICE_API_URL?: string;
}
const app = new Hono<{ Bindings: Env }>();

// CORS configuration - enhanced for reliability
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  credentials: true,
}));

// Basic logging middleware - simplified for production
app.use("*", async (c, next) => {
  // Only log errors and critical requests
  if (c.req.method !== 'GET' || c.req.url.includes('/api/users/me')) {
    console.log('[API]', c.req.method, c.req.url);
  }
  
  await next();
});

// Mount specific route groups first to avoid conflicts
app.route("/api/users", usersRoutes);
app.route("/api/multi-tenant", multiTenantRoutes);
app.route("/api/checklist", checklistRoutes);
app.route("/api/admin", adminDebugRoutes);

// OAuth Authentication endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  try {
    const redirectUrl = await getOAuthRedirectUrl('google', {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL || '',
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY || '',
    });

    return c.json({ redirectUrl }, 200);
  } catch (error) {
    console.error('OAuth redirect URL error:', error);
    return c.json({ error: "Failed to get OAuth redirect URL" }, 500);
  }
});

app.post("/api/sessions", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.code) {
      return c.json({ error: "No authorization code provided" }, 400);
    }

    const sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL || '',
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY || '',
    });

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Session creation error:', error);
    return c.json({ error: "Failed to create session" }, 500);
  }
});

// User profile endpoint - streamlined for reliability
app.get("/api/users/me", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get or create user profile in our database
    let user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(mochaUser.id).first() as any;
    
    // ALWAYS ensure eng.tiagosm@gmail.com is SYSTEM_ADMIN
    const isSystemCreator = mochaUser.email === 'eng.tiagosm@gmail.com';
    
    if (!user) {
      // Check if user was invited
      const invitation = await c.env.DB.prepare(`
        SELECT * FROM user_invitations 
        WHERE email = ? AND accepted_at IS NULL AND expires_at > datetime('now')
        ORDER BY created_at DESC LIMIT 1
      `).bind(mochaUser.email).first() as any;
      
      if (invitation && !isSystemCreator) {
        // Create user profile based on invitation (only if not system creator)
        const canManageUsers = invitation.role === USER_ROLES.ORG_ADMIN ? 1 : 0;
        const canCreateOrgs = invitation.role === USER_ROLES.ORG_ADMIN ? 1 : 0;
        const managedOrgId = invitation.role === USER_ROLES.ORG_ADMIN ? invitation.organization_id : null;
        
        await c.env.DB.prepare(`
          INSERT INTO users (
            id, email, name, role, organization_id, can_manage_users, 
            can_create_organizations, managed_organization_id, is_active, 
            last_login_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          mochaUser.id,
          mochaUser.email,
          mochaUser.google_user_data?.name || mochaUser.email,
          invitation.role,
          invitation.organization_id,
          canManageUsers,
          canCreateOrgs,
          managedOrgId,
          1
        ).run();
        
        // User created with invitation role
        
        // Mark invitation as accepted
        await c.env.DB.prepare(`
          UPDATE user_invitations 
          SET accepted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).bind(invitation.id).run();
        
      } else {
        // Create default user profile
        const userCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first() as any;
        const isFirstUser = userCount.count === 0;
        
        // System creator ALWAYS gets system admin role, others get admin if first user
        const role = isSystemCreator ? USER_ROLES.SYSTEM_ADMIN : (isFirstUser ? USER_ROLES.SYSTEM_ADMIN : USER_ROLES.INSPECTOR);
        const canManage = (isSystemCreator || isFirstUser) ? 1 : 0;
        
        await c.env.DB.prepare(`
          INSERT INTO users (
            id, email, name, role, can_manage_users, can_create_organizations,
            is_active, last_login_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          mochaUser.id,
          mochaUser.email,
          mochaUser.google_user_data?.name || mochaUser.email,
          role,
          canManage,
          canManage,
          1
        ).run();
        
        // User created successfully
      }
      
      user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(mochaUser.id).first();
    } else {
      // ALWAYS check if this is the system creator and force promotion if needed
      if (isSystemCreator && user.role !== USER_ROLES.SYSTEM_ADMIN) {
        await c.env.DB.prepare(`
          UPDATE users 
          SET role = ?, can_manage_users = ?, can_create_organizations = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(USER_ROLES.SYSTEM_ADMIN, 1, 1, mochaUser.id).run();
        
        user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(mochaUser.id).first();
      }
      
      // Update last login
      await c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(mochaUser.id).run();
    }
    
    // User profile ready
    
    // Load related data
    const organizations = [];
    const permissions = [];
    let managedOrganization = null;
    
    // Load user's organization
    if (user.organization_id) {
      const org = await c.env.DB.prepare("SELECT * FROM organizations WHERE id = ?").bind(user.organization_id).first();
      if (org) organizations.push(org);
    }
    
    // Load managed organization for org admins
    if (user.managed_organization_id) {
      managedOrganization = await c.env.DB.prepare("SELECT * FROM organizations WHERE id = ?").bind(user.managed_organization_id).first();
    }
    
    // Load permissions
    const userPermissions = await c.env.DB.prepare(`
      SELECT * FROM organization_permissions WHERE user_id = ? AND is_active = true
    `).bind(mochaUser.id).all();
    permissions.push(...userPermissions.results);
    
    return c.json({ 
      ...mochaUser, 
      profile: user,
      organizations,
      managed_organization: managedOrganization,
      permissions
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// Logout endpoint
app.get('/api/logout', async (c) => {
  try {
    const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

    if (typeof sessionToken === 'string') {
      await deleteSession(sessionToken, {
        apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL || '',
        apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY || '',
      });
    }

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
      httpOnly: true,
      path: '/',
      sameSite: 'none',
      secure: true,
      maxAge: 0,
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ success: true }, 200); // Always return success for logout
  }
});

// Dashboard stats endpoint - ENHANCED ADMIN VISIBILITY
app.get("/api/dashboard/stats", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile to check organization access
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    console.log(`[DASHBOARD] Usuario ${user.email} role: ${userProfile?.role} org: ${userProfile?.organization_id}`);
    
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as completed
      FROM inspections
    `;
    let params: any[] = [];
    let whereClause = [];
    
    // Check for organization filter from query params
    const organizationId = c.req.query('organization_id');
    if (organizationId) {
      whereClause.push("organization_id = ?");
      params.push(parseInt(organizationId));
      console.log(`[DASHBOARD] Filtro explícito organização: ${organizationId}`);
    } else {
      // Apply organization-based filtering based on user role
      if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN || userProfile?.role === 'admin') {
        // SYSTEM_ADMIN e ADMIN veem ABSOLUTAMENTE TUDO - ZERO FILTROS
        console.log(`[DASHBOARD] ADMIN COMPLETO - TODAS as inspeções sem filtros`);
        console.log(`[DASHBOARD] Admin bypass: role=${userProfile?.role}, email=${user.email}`);
      } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
        // Org admin sees their organization and subsidiaries
        whereClause.push(`(organization_id = ? OR organization_id IN (
          SELECT id FROM organizations WHERE parent_organization_id = ?
        ))`);
        params.push(userProfile.managed_organization_id, userProfile.managed_organization_id);
        console.log(`[DASHBOARD] Org admin - organização ${userProfile.managed_organization_id}`);
      } else if (userProfile?.organization_id) {
        // Other users see only their organization's inspections
        whereClause.push("organization_id = ?");
        params.push(userProfile.organization_id);
        console.log(`[DASHBOARD] Usuario comum - organização ${userProfile.organization_id}`);
      } else {
        console.log(`[DASHBOARD] Usuario sem organização`);
      }
    }
    
    // For non-admin users, also filter by created_by or collaborators
    // SYSTEM_ADMIN e ADMIN bypassam TODOS os filtros
    if (userProfile?.role !== USER_ROLES.SYSTEM_ADMIN && userProfile?.role !== 'admin' && userProfile?.role !== USER_ROLES.ORG_ADMIN) {
      whereClause.push("(created_by = ? OR id IN (SELECT inspection_id FROM inspection_collaborators WHERE user_id = ? AND status = 'active'))");
      params.push(user.id, user.id);
      console.log(`[DASHBOARD] Filtro adicional por criador para não-admin`);
    }
    
    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    console.log(`[DASHBOARD] Query: ${query}, Params: ${JSON.stringify(params)}`);
    console.log(`[DASHBOARD] Admin check: isSystemAdmin=${userProfile?.role === USER_ROLES.SYSTEM_ADMIN}, isAdmin=${userProfile?.role === 'admin'}`);
    
    const stats = await env.DB.prepare(query).bind(...params).first();
    
    console.log(`[DASHBOARD] Estatísticas calculadas para ${user.email}:`, stats);
    
    return c.json(stats || { total: 0, pending: 0, inProgress: 0, completed: 0 });
  } catch (error) {
    console.error('[DASHBOARD] Error fetching dashboard stats:', error);
    return c.json({ total: 0, pending: 0, inProgress: 0, completed: 0 });
  }
});

// Dashboard action plan summary endpoint
// Dashboard action plan summary endpoint - ENHANCED ADMIN VISIBILITY
app.get("/api/dashboard/action-plan-summary", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile to check organization access
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    console.log(`[ACTION-SUMMARY] Usuario ${user.email} role: ${userProfile?.role} buscando resumo de ações`);
    
    let query = `
      SELECT 
        COUNT(*) as total_actions,
        SUM(CASE WHEN ai.status = 'pending' THEN 1 ELSE 0 END) as pending_actions,
        SUM(CASE WHEN ai.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_actions,
        SUM(CASE WHEN ai.status = 'completed' THEN 1 ELSE 0 END) as completed_actions,
        SUM(CASE WHEN ai.status = 'pending' AND ai.when_deadline < date('now') THEN 1 ELSE 0 END) as overdue_actions,
        SUM(CASE WHEN ai.status = 'pending' AND ai.priority = 'alta' THEN 1 ELSE 0 END) as high_priority_pending,
        SUM(CASE WHEN ai.is_ai_generated = 1 THEN 1 ELSE 0 END) as ai_generated_count,
        COUNT(CASE WHEN ai.when_deadline BETWEEN date('now') AND date('now', '+7 days') THEN 1 END) as upcoming_deadline
      FROM action_items ai
      JOIN inspections i ON ai.inspection_id = i.id
    `;
    let params: any[] = [];
    let whereClause = [];
    
    // Check for organization filter from query params
    const organizationId = c.req.query('organization_id');
    if (organizationId) {
      whereClause.push("i.organization_id = ?");
      params.push(parseInt(organizationId));
      console.log(`[ACTION-SUMMARY] Filtro organização: ${organizationId}`);
    } else {
      // Apply organization-based filtering based on user role
      if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN || userProfile?.role === 'admin') {
        // SYSTEM_ADMIN and ADMIN see ALL actions - ABSOLUTELY no restrictions
        console.log(`[ACTION-SUMMARY] Admin completo - TODAS as ações sem filtros`);
      } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
        // Org admin sees their organization and subsidiaries
        whereClause.push(`(i.organization_id = ? OR i.organization_id IN (
          SELECT id FROM organizations WHERE parent_organization_id = ?
        ))`);
        params.push(userProfile.managed_organization_id, userProfile.managed_organization_id);
        console.log(`[ACTION-SUMMARY] Org admin - organização ${userProfile.managed_organization_id}`);
      } else if (userProfile?.organization_id) {
        // Other users see only their organization's actions
        whereClause.push("i.organization_id = ?");
        params.push(userProfile.organization_id);
        console.log(`[ACTION-SUMMARY] Usuario comum - organização ${userProfile.organization_id}`);
      }
    }
    
    // For non-admin users, also filter by created_by or collaborators
    if (userProfile?.role !== USER_ROLES.SYSTEM_ADMIN && userProfile?.role !== 'admin' && userProfile?.role !== USER_ROLES.ORG_ADMIN) {
      whereClause.push("(i.created_by = ? OR i.id IN (SELECT inspection_id FROM inspection_collaborators WHERE user_id = ? AND status = 'active'))");
      params.push(user.id, user.id);
      console.log(`[ACTION-SUMMARY] Filtro adicional por criador para não-admin`);
    }
    
    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    console.log(`[ACTION-SUMMARY] Query: ${query}, Params: ${JSON.stringify(params)}`);
    
    const actionSummary = await env.DB.prepare(query).bind(...params).first();
    
    console.log(`[ACTION-SUMMARY] Resumo calculado:`, actionSummary);
    
    return c.json(actionSummary || { 
      total_actions: 0, 
      pending_actions: 0, 
      in_progress_actions: 0, 
      completed_actions: 0, 
      overdue_actions: 0, 
      high_priority_pending: 0, 
      ai_generated_count: 0,
      upcoming_deadline: 0 
    });
  } catch (error) {
    console.error('Error fetching action plan summary:', error);
    return c.json({ 
      total_actions: 0, 
      pending_actions: 0, 
      in_progress_actions: 0, 
      completed_actions: 0, 
      overdue_actions: 0, 
      high_priority_pending: 0, 
      ai_generated_count: 0,
      upcoming_deadline: 0 
    });
  }
});

// Organizations hierarchy endpoint
app.get("/api/organizations/hierarchy", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    if (!userProfile) {
      return c.json({ error: "User profile not found." }, 404);
    }
    
    let query = `
      SELECT o.*, 
             (SELECT COUNT(id) FROM users WHERE organization_id = o.id AND is_active = true) as user_count,
             (SELECT COUNT(id) FROM organizations WHERE parent_organization_id = o.id AND is_active = true) as subsidiary_count,
             po.name as parent_organization_name
      FROM organizations o
      LEFT JOIN organizations po ON o.parent_organization_id = po.id
    `;
    
    let params: any[] = [];
    let whereClause = [];
    
    if (userProfile.role === USER_ROLES.SYSTEM_ADMIN) {
      // System admin sees ALL organizations (active and inactive)
      query += " ORDER BY o.organization_level, o.name ASC";
    } else if (userProfile.role === USER_ROLES.ORG_ADMIN) {
      // Org admin sees their organization and subsidiaries (only active ones)
      whereClause.push(`(o.id = ? OR o.parent_organization_id = ?) AND o.is_active = true`);
      params = [userProfile.managed_organization_id, userProfile.managed_organization_id];
      query += " WHERE " + whereClause.join(" AND ") + " ORDER BY o.organization_level, o.name ASC";
    } else {
      // Other roles see only their organization (only active ones)
      whereClause.push("o.id = ? AND o.is_active = true");
      params = [userProfile.organization_id];
      query += " WHERE " + whereClause.join(" AND ") + " ORDER BY o.organization_level, o.name ASC";
    }
    
    const organizations = await env.DB.prepare(query).bind(...params).all();
    
    return c.json({ 
      organizations: organizations.results || [],
      user_role: userProfile.role,
      can_manage: userProfile.can_manage_users || userProfile.role === USER_ROLES.SYSTEM_ADMIN
    });
    
  } catch (error) {
    console.error('Error fetching organization hierarchy:', error);
    return c.json({ error: "Failed to fetch organization hierarchy." }, 500);
  }
});

// Organizations endpoint - ENHANCED ADMIN VISIBILITY
app.get("/api/organizations", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile to check organization access
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    console.log(`[ORGS] Usuario ${user.email} role: ${userProfile?.role} buscando organizações`);
    
    let query = `
      SELECT o.*, 
             (SELECT COUNT(id) FROM users WHERE organization_id = o.id AND is_active = true) as user_count
      FROM organizations o
    `;
    let params: any[] = [];
    let whereClause = [];
    
    // ADMIN SYSTEM TEM ACESSO IRRESTRITO A TUDO
    if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN || userProfile?.role === 'admin') {
      // SYSTEM_ADMIN e ADMIN veem TODAS organizações (ativas e inativas) - ZERO FILTROS
      console.log(`[ORGS] [PROD] ADMIN COMPLETO - TODAS as organizações sem filtros`);
    } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
      // Org admin sees their organization and subsidiaries
      whereClause.push(`(o.id = ? OR o.parent_organization_id = ?) AND o.is_active = true`);
      params.push(userProfile.managed_organization_id, userProfile.managed_organization_id);
      console.log(`[ORGS] Org admin - organização ${userProfile.managed_organization_id} e subsidiárias`);
    } else if (userProfile?.organization_id) {
      // Usuários com organização veem organizações da sua organização
      whereClause.push('o.id = ? AND o.is_active = true');
      params.push(userProfile.organization_id);
      console.log(`[ORGS] Usuario comum - organização ${userProfile.organization_id}`);
    } else {
      // Usuários sem organização não veem organizações
      whereClause.push("1 = 0");
      console.log(`[ORGS] Usuario sem organização - sem acesso`);
    }
    
    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    query += " ORDER BY o.name ASC";
    
    console.log(`[ORGS] Query: ${query}, Params: ${JSON.stringify(params)}`);
    
    const organizations = await env.DB.prepare(query).bind(...params).all();
    
    console.log(`[ORGS] Encontradas ${organizations.results?.length || 0} organizações para ${user.email}`);
    
    if (organizations.results && organizations.results.length > 0) {
      console.log(`[ORGS] Primeiras organizações:`, organizations.results.slice(0, 3).map((o: any) => ({
        id: o.id,
        name: o.name,
        is_active: o.is_active
      })));
    }
    
    return c.json({ organizations: organizations.results || [] });
  } catch (error) {
    console.error('[ORGS] Error fetching organizations:', error);
    return c.json({ organizations: [] });
  }
});

// Organization stats endpoint
app.get("/api/organizations/:id/stats", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  const organizationId = parseInt(c.req.param("id"));
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    // Check if user can access this organization's stats
    let canAccess = false;
    
    if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN) {
      canAccess = true;
    } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
      // Check if this org is their managed org or a subsidiary
      const org = await env.DB.prepare(`
        SELECT id FROM organizations 
        WHERE (id = ? OR parent_organization_id = ?) AND id = ?
      `).bind(userProfile.managed_organization_id, userProfile.managed_organization_id, organizationId).first();
      canAccess = !!org;
    } else if (userProfile?.organization_id === organizationId) {
      canAccess = true;
    }
    
    if (!canAccess) {
      return c.json({ error: "Insufficient permissions to access organization stats" }, 403);
    }
    
    // Get organization stats
    const [usersCount, inspectionsCount, pendingInspections, completedInspections, activeActions, overdueActions] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = true").bind(organizationId).first(),
      env.DB.prepare("SELECT COUNT(*) as count FROM inspections WHERE organization_id = ?").bind(organizationId).first(),
      env.DB.prepare("SELECT COUNT(*) as count FROM inspections WHERE organization_id = ? AND status = 'pendente'").bind(organizationId).first(),
      env.DB.prepare("SELECT COUNT(*) as count FROM inspections WHERE organization_id = ? AND status = 'concluida'").bind(organizationId).first(),
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM action_items ai
        JOIN inspections i ON ai.inspection_id = i.id
        WHERE i.organization_id = ? AND ai.status != 'completed'
      `).bind(organizationId).first(),
      env.DB.prepare(`
        SELECT COUNT(*) as count FROM action_items ai
        JOIN inspections i ON ai.inspection_id = i.id
        WHERE i.organization_id = ? AND ai.status = 'pending' AND ai.when_deadline < date('now')
      `).bind(organizationId).first()
    ]);
    
    // Get recent inspections
    const recentInspections = await env.DB.prepare(`
      SELECT i.id, i.title, i.status, i.created_at, i.inspector_name
      FROM inspections i
      WHERE i.organization_id = ?
      ORDER BY i.created_at DESC
      LIMIT 5
    `).bind(organizationId).all();
    
    return c.json({
      users_count: (usersCount as any)?.count || 0,
      inspections_count: (inspectionsCount as any)?.count || 0,
      pending_inspections: (pendingInspections as any)?.count || 0,
      completed_inspections: (completedInspections as any)?.count || 0,
      active_actions: (activeActions as any)?.count || 0,
      overdue_actions: (overdueActions as any)?.count || 0,
      recent_inspections: recentInspections.results || []
    });
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    return c.json({ error: "Failed to fetch organization stats" }, 500);
  }
});

// INSPECTIONS ENDPOINTS - IMPLEMENTAÇÃO COMPLETA

// Get all inspections (protected) - ENHANCED ADMIN VISIBILITY
app.get("/api/inspections", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile to check organization access
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    console.log(`[INSPECTIONS] Usuario ${user.email} (${user.id}) role: ${userProfile?.role} org: ${userProfile?.organization_id}`);
    
    let query = "SELECT * FROM inspections";
    let params: any[] = [];
    let whereClause = [];
    
    // Check for organization filter from query params
    const organizationId = c.req.query('organization_id');
    if (organizationId) {
      whereClause.push("organization_id = ?");
      params.push(parseInt(organizationId));
      console.log(`[INSPECTIONS] Filtro explícito de organização: ${organizationId}`);
    } else {
      // Apply organization-based filtering based on user role
      if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN || userProfile?.role === 'admin') {
        // SYSTEM_ADMIN e ADMIN veem ABSOLUTAMENTE TUDO - ZERO FILTROS
        console.log(`[INSPECTIONS] ADMIN COMPLETO - TODAS inspeções sem filtros`);
        console.log(`[INSPECTIONS] Admin bypass: role=${userProfile?.role}, email=${user.email}`);
      } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
        // Org admin sees their organization and subsidiaries
        whereClause.push(`(organization_id = ? OR organization_id IN (
          SELECT id FROM organizations WHERE parent_organization_id = ?
        ))`);
        params.push(userProfile.managed_organization_id, userProfile.managed_organization_id);
        console.log(`[INSPECTIONS] Org admin - organização ${userProfile.managed_organization_id} e subsidiárias`);
      } else if (userProfile?.organization_id) {
        // Other users see only their organization's inspections
        whereClause.push("organization_id = ?");
        params.push(userProfile.organization_id);
        console.log(`[INSPECTIONS] Usuario comum - organização ${userProfile.organization_id}`);
      } else {
        console.log(`[INSPECTIONS] Usuario sem organização - filtro por criador apenas`);
      }
    }
    
    // For non-admin users, also filter by created_by or collaborators
    // SYSTEM_ADMIN e ADMIN bypassam TODOS os filtros
    if (userProfile?.role !== USER_ROLES.SYSTEM_ADMIN && userProfile?.role !== 'admin' && userProfile?.role !== USER_ROLES.ORG_ADMIN) {
      whereClause.push("(created_by = ? OR id IN (SELECT inspection_id FROM inspection_collaborators WHERE user_id = ? AND status = 'active'))");
      params.push(user.id, user.id);
      console.log(`[INSPECTIONS] Filtro adicional por criador/colaborador para ${user.email}`);
    }
    
    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    query += " ORDER BY created_at DESC";
    
    console.log(`[INSPECTIONS] Query final: ${query}`);
    console.log(`[INSPECTIONS] Parametros: ${JSON.stringify(params)}`);
    console.log(`[INSPECTIONS] Admin check: isSystemAdmin=${userProfile?.role === USER_ROLES.SYSTEM_ADMIN}, isAdmin=${userProfile?.role === 'admin'}`);
    
    const inspections = await env.DB.prepare(query).bind(...params).all();
    
    console.log(`[INSPECTIONS] Encontradas ${inspections.results?.length || 0} inspeções para ${user.email} (role: ${userProfile?.role})`);
    
    if (inspections.results && inspections.results.length > 0) {
      console.log(`[INSPECTIONS] Primeiras inspeções:`, inspections.results.slice(0, 3).map((i: any) => ({
        id: i.id,
        title: i.title,
        organization_id: i.organization_id,
        created_by: i.created_by
      })));
    } else {
      console.log(`[INSPECTIONS] ZERO inspeções encontradas - possível problema de filtros`);
      console.log(`[INSPECTIONS] Debug info:`, {
        userRole: userProfile?.role,
        userOrgId: userProfile?.organization_id,
        managedOrgId: userProfile?.managed_organization_id,
        userId: user.id,
        userEmail: user.email,
        isSystemAdmin: userProfile?.role === USER_ROLES.SYSTEM_ADMIN,
        isAdmin: userProfile?.role === 'admin',
        whereClauseLength: whereClause.length,
        hasOrgFilter: !!organizationId
      });
    }
    
    return c.json({ inspections: inspections.results || [] });
  } catch (error) {
    console.error('[INSPECTIONS] Error fetching inspections:', error);
    return c.json({ inspections: [] });
  }
});

// Get inspection by ID with items and media
app.get("/api/inspections/:id", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    const inspection = await env.DB.prepare("SELECT * FROM inspections WHERE id = ?").bind(id).first();
    
    if (!inspection) {
      return c.json({ error: "Inspection not found" }, 404);
    }
    
    const items = await env.DB.prepare("SELECT * FROM inspection_items WHERE inspection_id = ?").bind(id).all();
    const media = await env.DB.prepare("SELECT * FROM inspection_media WHERE inspection_id = ?").bind(id).all();
    
    return c.json({
      inspection,
      items: items.results || [],
      media: media.results || []
    });
  } catch (error) {
    console.error('Error fetching inspection:', error);
    return c.json({ error: "Failed to fetch inspection" }, 500);
  }
});

// Create new inspection (protected)
app.post("/api/inspections", authMiddleware, async (c) => {
  const env = c.env;
  
  try {
    const rawData = await c.req.json();
    console.log('Creating inspection with data:', rawData);
    const { template_id, ...inspectionData } = rawData;
    
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }
    
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    // Create inspection
    const insertResult = await env.DB.prepare(`
      INSERT INTO inspections (
        title, description, location, company_name, cep, address, latitude, longitude,
        inspector_name, inspector_email, status, priority, scheduled_date, action_plan_type,
        created_by, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionData.title,
      inspectionData.description || null,
      inspectionData.location,
      inspectionData.company_name || '',
      inspectionData.cep || null,
      inspectionData.address || null,
      inspectionData.latitude || null,
      inspectionData.longitude || null,
      inspectionData.inspector_name,
      inspectionData.inspector_email || null,
      inspectionData.status || 'pendente',
      inspectionData.priority || 'media',
      inspectionData.scheduled_date || null,
      inspectionData.action_plan_type || '5w2h',
      user.id,
      inspectionData.organization_id || userProfile?.organization_id || null
    ).run();
    
    const inspectionId = insertResult.meta.last_row_id as number;
    
    // If template_id is provided, create template-based items
    if (template_id && template_id !== '') {
      try {
        const templateFields = await env.DB.prepare(`
          SELECT * FROM checklist_fields WHERE template_id = ? ORDER BY order_index ASC
        `).bind(parseInt(template_id)).all();
        
        console.log(`Found ${templateFields.results?.length || 0} fields for template ${template_id}`);
        
        for (const field of (templateFields.results as any[]) || []) {
          const fieldData = {
            field_id: field.id,
            field_name: field.field_name,
            field_type: field.field_type,
            is_required: field.is_required,
            options: field.options,
            response_value: null,
            comment: null
          };
          
          await env.DB.prepare(`
            INSERT INTO inspection_items (inspection_id, template_id, field_responses, category, item_description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            inspectionId, 
            parseInt(template_id), 
            JSON.stringify(fieldData), 
            field.field_name || 'Checklist Item', 
            field.field_name || 'Campo do template'
          ).run();
        }
      } catch (templateError) {
        console.error('Error creating template items:', templateError);
        // Continue without template items - don't fail the inspection creation
      }
    }
    
    return c.json({ 
      id: inspectionId, 
      message: "Inspection created successfully" 
    });
  } catch (error) {
    console.error('Error creating inspection:', error);
    return c.json({ 
      error: "Failed to create inspection", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Update inspection
app.put("/api/inspections/:id", authMiddleware, async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    const data = await c.req.json();
    console.log('Updating inspection with data:', data);
    
    // Lista de campos válidos da tabela inspections
    const validColumns = [
      'title', 'description', 'location', 'company_name', 'cep', 'address', 
      'latitude', 'longitude', 'inspector_name', 'inspector_email', 'status', 
      'priority', 'scheduled_date', 'completed_date', 'action_plan', 
      'action_plan_type', 'inspector_signature', 'responsible_signature', 
      'organization_id'
    ];
    
    // Filtrar apenas campos válidos e remover valores undefined/null
    const validData = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => 
        validColumns.includes(key) && value !== undefined && value !== null
      )
    );
    
    if (Object.keys(validData).length === 0) {
      return c.json({ error: "No valid data to update" }, 400);
    }
    
    const updateFields = Object.keys(validData).map(key => `${key} = ?`).join(", ");
    const updateValues = Object.values(validData);
    
    await env.DB.prepare(`
      UPDATE inspections 
      SET ${updateFields}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(...updateValues, id).run();
    
    return c.json({ message: "Inspection updated successfully" });
  } catch (error) {
    console.error('Error updating inspection:', error);
    return c.json({ 
      error: "Failed to update inspection", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Clone inspection (only basic data)
app.post("/api/inspections/:id/clone", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  const originalId = parseInt(c.req.param("id"));
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    console.log(`[CLONE-INSPECTION] Clonando apenas dados básicos da inspeção ${originalId} para usuário ${user.email}`);
    
    // Get original inspection
    const originalInspection = await env.DB.prepare("SELECT * FROM inspections WHERE id = ?").bind(originalId).first() as any;
    
    if (!originalInspection) {
      return c.json({ error: "Inspeção não encontrada" }, 404);
    }
    
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    // Create cloned inspection with modified title - APENAS DADOS BÁSICOS
    const newTitle = `${originalInspection.title} - Cópia`;
    const clonedResult = await env.DB.prepare(`
      INSERT INTO inspections (
        title, description, location, company_name, cep, address, latitude, longitude,
        inspector_name, inspector_email, status, priority, scheduled_date, action_plan_type,
        created_by, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      newTitle,
      originalInspection.description,
      originalInspection.location,
      originalInspection.company_name,
      originalInspection.cep,
      originalInspection.address,
      originalInspection.latitude,
      originalInspection.longitude,
      userProfile?.name || user.google_user_data?.name || user.email, // Use current user as inspector
      userProfile?.email || user.email,
      'pendente', // Reset status to pending
      originalInspection.priority,
      null, // Clear scheduled date
      originalInspection.action_plan_type,
      user.id, // Current user as creator
      userProfile?.organization_id || originalInspection.organization_id
    ).run();
    
    const newInspectionId = clonedResult.meta.last_row_id as number;
    console.log(`[CLONE-INSPECTION] Nova inspeção criada com ID: ${newInspectionId} (APENAS DADOS BÁSICOS)`);
    
    // NÃO clonar inspection_items (itens de checklist preenchidos)
    // NÃO clonar action_items (ações criadas)
    // NÃO clonar inspection_media (fotos e arquivos)
    
    // A nova inspeção fica limpa para ser preenchida do zero
    console.log(`[CLONE-INSPECTION] Inspeção básica clonada com sucesso: ${originalId} -> ${newInspectionId}`);
    console.log(`[CLONE-INSPECTION] Apenas dados da primeira tela foram copiados (título, local, empresa, etc.)`);
    
    return c.json({ 
      id: newInspectionId,
      message: "Inspeção duplicada com sucesso",
      original_id: originalId,
      cloned_title: newTitle,
      note: "Apenas os dados básicos foram copiados. A nova inspeção está pronta para ser preenchida do zero.",
      items_cloned: 0, // Nenhum item clonado conforme solicitado
      actions_cloned: 0 // Nenhuma ação clonada conforme solicitado
    });
    
  } catch (error) {
    console.error('[CLONE-INSPECTION] Erro ao clonar inspeção:', error);
    return c.json({ 
      error: "Falha ao clonar inspeção", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Delete inspection
app.delete("/api/inspections/:id", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    await env.DB.prepare("DELETE FROM inspection_media WHERE inspection_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM inspection_items WHERE inspection_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM inspections WHERE id = ?").bind(id).run();
    
    return c.json({ message: "Inspection deleted successfully" });
  } catch (error) {
    console.error('Error deleting inspection:', error);
    return c.json({ error: "Failed to delete inspection" }, 500);
  }
});

// Add item to inspection
app.post("/api/inspections/:id/items", authMiddleware, async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    const data = await c.req.json();
    
    await env.DB.prepare(`
      INSERT INTO inspection_items (
        inspection_id, category, item_description, is_compliant, observations, photo_url,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionId,
      data.category,
      data.item_description,
      data.is_compliant || null,
      data.observations || null,
      data.photo_url || null
    ).run();
    
    return c.json({ message: "Item added successfully" });
  } catch (error) {
    console.error('Error adding item:', error);
    return c.json({ error: "Failed to add item" }, 500);
  }
});

// Update inspection item
app.put("/api/inspection-items/:id", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    const data = await c.req.json();
    
    const updateFields = Object.entries(data)
      .filter(([_, value]) => value !== undefined)
      .map(([key, _]) => `${key} = ?`)
      .join(", ");
    
    const updateValues = Object.values(data).filter(value => value !== undefined);
    
    await env.DB.prepare(`
      UPDATE inspection_items 
      SET ${updateFields}, updated_at = datetime('now')
      WHERE id = ?
    `).bind(...updateValues, id).run();
    
    return c.json({ message: "Item updated successfully" });
  } catch (error) {
    console.error('Error updating item:', error);
    return c.json({ error: "Failed to update item" }, 500);
  }
});

// Save template responses for inspection
app.post("/api/inspections/:id/template-responses", async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    const requestBody = await c.req.json();
    const responses = requestBody.responses;
    
    for (const response of responses) {
      // Find the template ID for this field
      const templateField = await env.DB.prepare(`
        SELECT template_id FROM checklist_fields WHERE id = ?
      `).bind(response.field_id).first() as any;
      
      if (!templateField) continue;
      
      const templateId = templateField.template_id;
      
      // Create the field data object
      const fieldData = {
        field_id: response.field_id,
        field_name: response.field_name,
        field_type: response.field_type,
        response_value: response.value,
        comment: response.comment || null
      };
      
      // Check if item already exists
      const existingItem = await env.DB.prepare(`
        SELECT id FROM inspection_items 
        WHERE inspection_id = ? AND template_id = ? AND JSON_EXTRACT(field_responses, '$.field_id') = ?
      `).bind(inspectionId, templateId, response.field_id).first();
      
      if (existingItem) {
        // Update existing item
        await env.DB.prepare(`
          UPDATE inspection_items 
          SET field_responses = ?, updated_at = datetime('now')
          WHERE inspection_id = ? AND template_id = ? AND JSON_EXTRACT(field_responses, '$.field_id') = ?
        `).bind(JSON.stringify(fieldData), inspectionId, templateId, response.field_id).run();
      } else {
        // Create new item
        await env.DB.prepare(`
          INSERT INTO inspection_items (inspection_id, template_id, field_responses, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).bind(inspectionId, templateId, JSON.stringify(fieldData)).run();
      }
    }
    
    return c.json({ 
      success: true, 
      message: "Template responses saved successfully" 
    });
  } catch (error) {
    console.error('Error saving template responses:', error);
    return c.json({ 
      success: false, 
      error: "Failed to save template responses" 
    }, 500);
  }
});

// Finalize inspection
app.post("/api/inspections/:id/finalize", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    await env.DB.prepare(`
      UPDATE inspections 
      SET status = 'concluida', completed_date = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(id).run();
    
    return c.json({ message: "Inspection finalized successfully" });
  } catch (error) {
    console.error('Error finalizing inspection:', error);
    return c.json({ error: "Failed to finalize inspection" }, 500);
  }
});

// Create share link for inspection
app.post("/api/inspections/:id/share", authMiddleware, async (c) => {
  const inspectionId = parseInt(c.req.param('id'));
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Usuário não encontrado' }, 401);
  }

  const body = await c.req.json();
  const { permission = 'view', expires_in_days = 30 } = body;

  // Generate unique share token
  const shareToken = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);

  // Calculate expiration date
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expires_in_days);

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO inspection_shares (
        inspection_id, share_token, created_by, permission, expires_at, 
        is_active, access_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionId,
      shareToken,
      user.id,
      permission,
      expirationDate.toISOString(),
      true,
      0
    ).run();

    // Generate share URL and QR Code
    const shareUrl = `${new URL(c.req.url).origin}/shared/${shareToken}`;
    
    // Generate simple QR code as SVG
    const qrCodeSVG = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <rect x="10" y="10" width="180" height="180" fill="none" stroke="#000000" stroke-width="2"/>
        <text x="100" y="90" text-anchor="middle" font-family="Arial" font-size="12" fill="#000000">QR Code</text>
        <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="8" fill="#666666">${shareToken.substring(0, 8)}...</text>
      </svg>
    `;
    const qrCodeBase64 = `data:image/svg+xml;base64,${btoa(qrCodeSVG)}`;

    return c.json({
      id: result.meta.last_row_id,
      share_token: shareToken,
      share_url: shareUrl,
      qr_code: qrCodeBase64,
      message: 'Link de compartilhamento criado com sucesso'
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return c.json({ error: 'Erro ao criar link de compartilhamento' }, 500);
  }
});

// Get share links for inspection
app.get("/api/inspections/:id/shares", authMiddleware, async (c) => {
  const inspectionId = parseInt(c.req.param('id'));

  try {
    const shares = await c.env.DB.prepare(`
      SELECT * FROM inspection_shares 
      WHERE inspection_id = ? 
      ORDER BY created_at DESC
    `).bind(inspectionId).all();

    return c.json({ shares: shares.results || [] });
  } catch (error) {
    console.error('Error fetching shares:', error);
    return c.json({ shares: [] });
  }
});

// Delete share link
app.delete("/api/inspection-shares/:id", authMiddleware, async (c) => {
  const shareId = parseInt(c.req.param('id'));

  try {
    await c.env.DB.prepare(`
      DELETE FROM inspection_shares WHERE id = ?
    `).bind(shareId).run();

    return c.json({ message: 'Link de compartilhamento excluído com sucesso' });
  } catch (error) {
    console.error('Error deleting share:', error);
    return c.json({ error: 'Erro ao excluir compartilhamento' }, 500);
  }
});

// Get shared inspection (public endpoint)
app.get("/shared/:token", async (c) => {
  const token = c.req.param('token');
  
  try {
    // Get share record
    const shareResult = await c.env.DB.prepare(`
      SELECT * FROM inspection_shares 
      WHERE share_token = ? AND is_active = true
    `).bind(token).first();
    
    if (!shareResult) {
      return c.json({ error: 'Link não encontrado' }, 404);
    }
    
    // Check if expired
    const now = new Date();
    const expiresAt = new Date(shareResult.expires_at as string);
    
    if (expiresAt < now) {
      return c.json({ 
        error: 'Link expirado',
        expired: true 
      }, 410);
    }
    
    // Get inspection details
    const inspection = await c.env.DB.prepare(`
      SELECT i.*, u.name as inspector_name, u.email as inspector_email
      FROM inspections i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `).bind(shareResult.inspection_id).first();
    
    if (!inspection) {
      return c.json({ error: 'Inspeção não encontrada' }, 404);
    }
    
    // Get inspection items
    const items = await c.env.DB.prepare(`
      SELECT * FROM inspection_items 
      WHERE inspection_id = ?
      ORDER BY id
    `).bind(shareResult.inspection_id).all();
    
    // Get inspection media
    const media = await c.env.DB.prepare(`
      SELECT * FROM inspection_media 
      WHERE inspection_id = ?
      ORDER BY id
    `).bind(shareResult.inspection_id).all();
    
    // Update access count
    await c.env.DB.prepare(`
      UPDATE inspection_shares 
      SET access_count = access_count + 1, updated_at = datetime('now')
      WHERE share_token = ?
    `).bind(token).run();
    
    return c.json({
      success: true,
      share: shareResult,
      inspection,
      items: items.results || [],
      media: media.results || []
    });
    
  } catch (error) {
    console.error('Error getting shared inspection:', error);
    return c.json({ error: 'Erro ao carregar inspeção' }, 500);
  }
});

// Get signatures for inspection
app.get("/api/inspections/:id/signatures", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    const inspection = await env.DB.prepare(`
      SELECT inspector_signature, responsible_signature FROM inspections WHERE id = ?
    `).bind(id).first() as any;
    
    if (!inspection) {
      return c.json({ error: "Inspection not found" }, 404);
    }
    
    return c.json({
      inspector: inspection.inspector_signature,
      responsible: inspection.responsible_signature
    });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    return c.json({ error: "Failed to fetch signatures" }, 500);
  }
});

// Save signatures for inspection
app.post("/api/inspections/:id/signatures", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    const body = await c.req.json();
    const { inspector, responsible } = body;
    
    await env.DB.prepare(`
      UPDATE inspections 
      SET inspector_signature = ?, responsible_signature = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(inspector || null, responsible || null, id).run();
    
    return c.json({ message: "Signatures saved successfully" });
  } catch (error) {
    console.error('Error saving signatures:', error);
    return c.json({ error: "Failed to save signatures" }, 500);
  }
});

// AI Analysis endpoint
app.post("/api/inspections/:id/ai-analysis", zValidator("json", AIAnalysisRequestSchema), async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  const { inspection_context, non_compliant_items } = c.req.valid("json");
  
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.trim() === '') {
    console.error('[AI-ANALYSIS] OpenAI API key não configurada para análise de inspeção');
    return c.json({ 
      error: "Serviço de IA temporariamente indisponível",
      message: "A análise de IA não está disponível no momento. Tente novamente mais tarde.",
      success: false
    }, 503);
  }
  
  // More flexible key validation for production
  if (env.OPENAI_API_KEY.length < 10) {
    console.error('[AI-ANALYSIS] Chave OpenAI muito curta');
    return c.json({ 
      error: "Configuração de IA inválida",
      message: "Serviço de IA não disponível. Tente novamente mais tarde.",
      success: false
    }, 503);
  }
  
  try {
    console.log('[AI-ANALYSIS] Inicializando cliente OpenAI...');
    const openai = await getOpenAIClient(env.OPENAI_API_KEY);
    console.log('[AI-ANALYSIS] Cliente OpenAI criado com sucesso');
    
    const prompt = `Como especialista em segurança do trabalho, analise os seguintes itens não conformes de uma inspeção e crie um plano de ação 5W2H:

Contexto da Inspeção: ${inspection_context}

Itens Não Conformes:
${non_compliant_items.join('\n')}

Crie um plano de ação detalhado em formato JSON com:
- summary: Resumo executivo dos problemas encontrados
- priority_level: "baixa", "media", "alta" ou "critica"
- estimated_completion: Prazo estimado para conclusão (ex: "30 dias")
- actions: Array de ações, cada uma com:
  - item: Título da ação
  - what: O que fazer (descrição detalhada)
  - why: Por que é necessário (justificativa)
  - where: Onde aplicar (local específico)
  - when: Quando executar (prazo)
  - who: Quem é responsável (cargo/função)
  - how: Como executar (metodologia)
  - how_much: Quanto custa (estimativa de recursos)

Retorne APENAS o JSON válido.`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });
    
    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }
    
    // Parse the action plan
    let actionPlan;
    try {
      actionPlan = JSON.parse(response);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        actionPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }
    
    // Save action plan to inspection
    await env.DB.prepare(`
      UPDATE inspections 
      SET action_plan = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify(actionPlan), inspectionId).run();
    
    return c.json({ 
      action_plan: actionPlan,
      message: "AI analysis completed successfully" 
    });
    
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return c.json({ error: "Failed to generate AI analysis" }, 500);
  }
});

// Upload media for inspection
app.post("/api/inspections/:id/media", async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    const body = await c.req.json();
    const { file_name, file_url, file_size, mime_type, media_type, inspection_item_id, description } = body;
    
    await env.DB.prepare(`
      INSERT INTO inspection_media (
        inspection_id, inspection_item_id, media_type, file_name, file_url, 
        file_size, mime_type, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionId,
      inspection_item_id || null,
      media_type,
      file_name,
      file_url,
      file_size || null,
      mime_type || null,
      description || null
    ).run();
    
    return c.json({ message: "Media uploaded successfully" });
  } catch (error) {
    console.error('Error uploading media:', error);
    return c.json({ error: "Failed to upload media" }, 500);
  }
});

// Upload media with file data for inspection
app.post("/api/inspections/:id/media/upload", async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    const body = await c.req.json();
    const { file_name, file_data, file_size, mime_type, media_type, inspection_item_id } = body;
    
    // For now, we'll simulate file storage by creating a data URL
    // In production, you'd upload to R2 or another storage service
    const file_url = file_data; // Use the base64 data URL directly
    
    const result = await env.DB.prepare(`
      INSERT INTO inspection_media (
        inspection_id, inspection_item_id, media_type, file_name, file_url, 
        file_size, mime_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionId,
      inspection_item_id || null,
      media_type,
      file_name,
      file_url,
      file_size || null,
      mime_type || null
    ).run();
    
    return c.json({ 
      id: result.meta.last_row_id,
      file_url: file_url,
      message: "Media uploaded successfully" 
    });
  } catch (error) {
    console.error('Error uploading media with data:', error);
    return c.json({ error: "Failed to upload media" }, 500);
  }
});

// Download all media from inspection as ZIP
app.get("/api/inspections/:id/media/download", authMiddleware, async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    console.log('[MEDIA-DOWNLOAD] Iniciando download de mídias para inspeção:', inspectionId);
    
    // Get all media for the inspection
    const mediaResult = await env.DB.prepare(`
      SELECT * FROM inspection_media WHERE inspection_id = ? ORDER BY created_at ASC
    `).bind(inspectionId).all();
    
    const mediaFiles = mediaResult.results as any[];
    
    if (!mediaFiles || mediaFiles.length === 0) {
      return c.json({ error: "Nenhuma mídia encontrada para esta inspeção" }, 404);
    }
    
    console.log('[MEDIA-DOWNLOAD] Encontradas', mediaFiles.length, 'mídias para download');
    
    // For now, return metadata for manual download
    // In a full implementation, you would:
    // 1. Create a ZIP file with all media
    // 2. Return the ZIP as a blob
    // 3. Handle base64 data URLs properly
    
    const mediaList = mediaFiles.map(media => ({
      id: media.id,
      file_name: media.file_name,
      media_type: media.media_type,
      mime_type: media.mime_type,
      file_size: media.file_size,
      file_url: media.file_url,
      created_at: media.created_at,
      // For base64 data URLs, include download info
      is_base64: media.file_url?.startsWith('data:'),
      download_ready: true
    }));
    
    // Get inspection details for filename
    const inspection = await env.DB.prepare(`
      SELECT title, company_name FROM inspections WHERE id = ?
    `).bind(inspectionId).first() as any;
    
    const zipFilename = `inspecao_${inspectionId}_${inspection?.company_name || 'empresa'}_midias.zip`;
    
    return c.json({
      success: true,
      media_count: mediaFiles.length,
      suggested_filename: zipFilename,
      media_files: mediaList,
      download_instructions: {
        pt: "Para baixar todas as mídias, clique com o botão direito em cada item e selecione 'Salvar como' ou use a funcionalidade de download individual.",
        en: "To download all media, right-click each item and select 'Save as' or use individual download functionality."
      },
      note: "Funcionalidade de ZIP automático será implementada em versão futura devido a limitações de memória do Cloudflare Worker"
    });
    
  } catch (error) {
    console.error('[MEDIA-DOWNLOAD] Erro no download de mídias:', error);
    return c.json({ 
      error: "Falha ao preparar download de mídias",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Delete inspection media
app.delete("/api/inspection-media/:id", async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    await env.DB.prepare("DELETE FROM inspection_media WHERE id = ?").bind(id).run();
    return c.json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error('Error deleting media:', error);
    return c.json({ error: "Failed to delete media" }, 500);
  }
});

// Pre-analysis for inspection item - ENHANCED PRODUCTION
app.post("/api/inspection-items/:id/pre-analysis", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  console.log(`[PRE-ANALYSIS] Iniciando pré-análise para item ${itemId}`);
  console.log(`[PRE-ANALYSIS] OpenAI Key status: ${env.OPENAI_API_KEY ? 'PRESENTE' : 'AUSENTE'}`);
  
  // ENHANCED PRODUCTION VALIDATION - Super permissive for reliability
  if (!env.OPENAI_API_KEY) {
    console.error('[PRE-ANALYSIS] OpenAI API key não configurada');
    return c.json({ 
      error: "Serviço de IA não disponível",
      message: "Configure a chave OpenAI para usar análise automática",
      success: false,
      error_code: "NO_API_KEY"
    }, 503);
  }
  
  // Very flexible validation for production stability
  if (env.OPENAI_API_KEY.length < 5) {
    console.error('[PRE-ANALYSIS] Chave OpenAI inválida');
    return c.json({ 
      error: "Configuração de IA inválida",
      message: "Chave de API não configurada corretamente",
      success: false,
      error_code: "INVALID_API_KEY"
    }, 503);
  }
  
  let body: any = {};
  
  try {
    console.log(`[PRE-ANALYSIS] Parsing request body para item ${itemId}`);
    body = await c.req.json();
    const { field_name, field_type, response_value, media_data, user_prompt } = body;
    
    console.log('[PRE-ANALYSIS] Dados recebidos:', {
      itemId,
      field_name: field_name?.substring(0, 50) + '...',
      field_type,
      response_value: typeof response_value,
      media_count: media_data?.length || 0,
      has_user_prompt: !!user_prompt
    });
    
    // Get inspection context
    console.log(`[PRE-ANALYSIS] Buscando dados do item ${itemId}...`);
    const inspectionItem = await env.DB.prepare(`
      SELECT ii.*, i.title, i.location, i.company_name, i.inspector_name, i.description as inspection_description,
             i.ai_assistant_id
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.id = ?
    `).bind(itemId).first() as any;
    
    if (!inspectionItem) {
      console.error(`[PRE-ANALYSIS] Item de inspeção não encontrado: ${itemId}`);
      return c.json({ error: "Item de inspeção não encontrado" }, 404);
    }
    
    console.log('[PRE-ANALYSIS] Item encontrado:', inspectionItem.id, 'da inspeção:', inspectionItem.inspection_id);
    
    console.log('[PRE-ANALYSIS] Inicializando cliente OpenAI...');
    console.log('[PRE-ANALYSIS] Key length:', env.OPENAI_API_KEY?.length || 0);
    
    const openai = await getOpenAIClient(env.OPENAI_API_KEY);
    console.log('[PRE-ANALYSIS] Cliente OpenAI inicializado com sucesso');

    // Get AI assistant for this inspection if available
    let assistantInstructions = '';
    if (inspectionItem.ai_assistant_id) {
      try {
        const assistant = await env.DB.prepare(`
          SELECT name, instructions FROM ai_assistants WHERE id = ? AND is_active = true
        `).bind(inspectionItem.ai_assistant_id).first() as any;
        
        if (assistant) {
          assistantInstructions = `\n\nVOCÊ É UM ${assistant.name.toUpperCase()}:\n${assistant.instructions}\n\n`;
        }
      } catch (assistantError) {
        console.warn('[PRE-ANALYSIS] Falha ao carregar AI assistant:', assistantError);
      }
    }
    
    // Build multimodal message content with structured analysis
    const messageContent: any[] = [];
    
    // Add structured prompt for descriptive analysis
    let textPrompt = `Especialista em segurança analisando evidências multimodais.${assistantInstructions}

CONTEXTO:
- Empresa: ${inspectionItem.company_name || 'Não informado'}  
- Local: ${inspectionItem.location || 'Não informado'}
- Campo: ${field_name}
- Resposta: ${response_value || 'Não respondido'}

ESTRUTURA DE ANÁLISE (MÁXIMO 15 LINHAS):
1. DESCRIÇÃO: O que você observa nas evidências (fotos/áudios/vídeos)
2. IDENTIFICAÇÃO: Aspectos de segurança relevantes
3. ANÁLISE: Como isso se relaciona com "${field_name}"
4. CONCLUSÃO: Riscos e recomendações específicas

EVIDÊNCIAS DISPONÍVEIS:`;

    // Add user prompt if provided
    if (user_prompt && user_prompt.trim() !== '') {
      textPrompt += `\n- Solicitação: "${user_prompt}"`;
    }

    // Enhanced media analysis with descriptive focus
    let hasValidMedia = false;
    if (media_data && Array.isArray(media_data) && media_data.length > 0) {
      const imageCount = media_data.filter((m: any) => m && m.media_type === 'image').length;
      const audioCount = media_data.filter((m: any) => m && m.media_type === 'audio').length;
      const videoCount = media_data.filter((m: any) => m && m.media_type === 'video').length;
      
      if (imageCount + audioCount + videoCount > 0) {
        hasValidMedia = true;
        textPrompt += ` ${imageCount} foto(s), ${audioCount} áudio(s), ${videoCount} vídeo(s)`;
        console.log(`[PRE-ANALYSIS] ${imageCount} imagem(s), ${audioCount} áudio(s), ${videoCount} vídeo(s) para análise`);
      }
    }

    textPrompt += `\n\nANÁLISE ESTRUTURADA (15 LINHAS MÁXIMO):
LINHA 1-2: DESCRIÇÃO - O que você vê/ouve nas evidências
LINHA 3-4: IDENTIFICAÇÃO - Condições de segurança observadas  
LINHA 5-6: ANÁLISE - Conformidades e não-conformidades
LINHA 7-8: RISCOS - Perigos identificados
LINHA 9-10: IMPACTO - Consequências potenciais
LINHA 11-12: RECOMENDAÇÕES - Ações específicas necessárias
LINHA 13-14: PRIORIDADE - Urgência (baixa/média/alta/crítica)
LINHA 15: CONCLUSÃO - Resumo final

SEJA DESCRITIVO NAS EVIDÊNCIAS PRIMEIRO, DEPOIS ANALISE.`;

    messageContent.push({
      type: "text",
      text: textPrompt
    });

    // Add images with SUPER AGGRESSIVE OPTIMIZATION FOR RELIABILITY
    let imageProcessed = 0;
    const MAX_IMAGES = 1; // APENAS 1 IMAGEM para máxima confiabilidade
    const MAX_IMAGE_SIZE_MB = 1.5; // Limite muito agressivo para evitar 500
    
    if (hasValidMedia && media_data && Array.isArray(media_data)) {
      for (const media of media_data) {
        if (media && media.media_type === 'image' && media.file_url) {
          try {
            if (media.file_url.startsWith('data:image/')) {
              // Validate image size
              const sizeInBytes = (media.file_url.length * 3) / 4;
              const sizeInMB = sizeInBytes / (1024 * 1024);
              
              if (sizeInMB > MAX_IMAGE_SIZE_MB) {
                console.warn(`[PRE-ANALYSIS] Imagem muito grande (${sizeInMB.toFixed(2)}MB), pulando`);
                continue;
              }
              
              if (imageProcessed >= MAX_IMAGES) {
                console.warn(`[PRE-ANALYSIS] Limite de ${MAX_IMAGES} imagem(s) atingido, pulando demais`);
                break;
              }
              
              messageContent.push({
                type: "image_url",
                image_url: {
                  url: media.file_url,
                  detail: "high" // High detail para análise descritiva precisa
                }
              });
              imageProcessed++;
              console.log(`[PRE-ANALYSIS] Imagem ${imageProcessed} processada: ${media.file_name} (${sizeInMB.toFixed(2)}MB)`);
            }
          } catch (error) {
            console.error('[PRE-ANALYSIS] Erro processando imagem:', media.file_name, error);
          }
        }
      }
      console.log(`[PRE-ANALYSIS] Total de ${imageProcessed} imagem(s) processada(s)`);
    }
    
    console.log('[PRE-ANALYSIS] Preparando requisição OpenAI...');
    console.log('[PRE-ANALYSIS] Partes de conteúdo:', messageContent.length);
    
    // Validar se temos conteúdo válido
    if (!messageContent || messageContent.length === 0) {
      console.error('[PRE-ANALYSIS] Nenhum conteúdo para enviar à OpenAI');
      throw new Error("Nenhum conteúdo válido para análise");
    }
    
    // ENHANCED TIMEOUT CONTROL - MAXIMUM RELIABILITY
    let completion;
    try {
      console.log('[PRE-ANALYSIS] Fazendo chamada para OpenAI...');
      console.log('[PRE-ANALYSIS] Config:', {
        model: "gpt-4o-mini",
        temp: 0.1,
        tokens: 400,
        parts: messageContent.length,
        images: messageContent.filter(m => m.type === 'image_url').length
      });
      
      completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: messageContent }],
          temperature: 0.1,
          max_tokens: 400,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout OpenAI após 30 segundos')), 30000)
        )
      ]) as any;
      console.log('[PRE-ANALYSIS] ✅ Chamada OpenAI concluída');
    } catch (openaiError: any) {
      console.error('[PRE-ANALYSIS] ❌ Erro OpenAI:', {
        message: openaiError.message,
        status: openaiError.status,
        code: openaiError.code,
        name: openaiError.name
      });
      
      // Enhanced error handling for production
      if (openaiError.message?.includes('timeout') || openaiError.message?.includes('Timeout')) {
        throw new Error('Timeout: Tente com menos imagens ou aguarde alguns minutos');
      } else if (openaiError.status === 401 || openaiError.message?.includes('401')) {
        throw new Error('Chave OpenAI inválida - entre em contato com o administrador');
      } else if (openaiError.status === 429 || openaiError.message?.includes('429')) {
        throw new Error('Limite de uso excedido - aguarde alguns minutos');
      } else if (openaiError.status === 400 || openaiError.message?.includes('400')) {
        throw new Error('Conteúdo inválido - reduza o tamanho das imagens');
      } else if (openaiError.status === 500 || openaiError.message?.includes('500')) {
        throw new Error('Erro interno da OpenAI - tente novamente em alguns instantes');
      } else {
        throw new Error(`Erro da IA: ${openaiError.message || 'Falha na comunicação'}`);
      }
    }
    
    console.log('[PRE-ANALYSIS] Processando resposta da OpenAI...');
    
    const analysis = completion.choices?.[0]?.message?.content;
    
    if (!analysis || analysis.trim() === '') {
      console.error('[PRE-ANALYSIS] Resposta vazia da OpenAI');
      throw new Error("Resposta vazia da API OpenAI - tente novamente");
    }
    
    console.log('[PRE-ANALYSIS] Resposta recebida, limpando formatação...');
    
    // Remove markdown formatting from the analysis
    const cleanAnalysis = analysis
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/^\s*[\-\*\+]\s/gm, '• ') // Convert bullet points
      .replace(/^\s*\d+\.\s/gm, '') // Remove numbered lists
      .replace(/`([^`]+)`/g, '$1') // Remove code formatting
      .trim();
    
    console.log('[PRE-ANALYSIS] Salvando pré-análise no banco...');
    // Save pre-analysis to item
    await env.DB.prepare(`
      UPDATE inspection_items 
      SET ai_pre_analysis = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(cleanAnalysis, itemId).run();
    
    console.log(`[PRE-ANALYSIS] Pré-análise concluída com sucesso para item ${itemId}`);
    
    return c.json({ 
      pre_analysis: cleanAnalysis,
      message: "Pré-análise concluída com sucesso" 
    });
    
  } catch (error) {
    console.error('[PRE-ANALYSIS] Erro na pré-análise:', error);
    
    // Log contexto completo
    if (error instanceof Error) {
      console.error('[PRE-ANALYSIS] Detalhes do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500),
        cause: (error as any).cause || 'N/A'
      });
    }
    
    // Log contexto da requisição
    console.error('[PRE-ANALYSIS] Contexto do erro:', {
      itemId,
      fieldName: body?.field_name?.substring(0, 50) || 'desconhecido',
      fieldType: body?.field_type || 'desconhecido',
      hasMediaData: !!(body?.media_data && Array.isArray(body.media_data)),
      mediaCount: body?.media_data?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    // Análise específica do tipo de erro
    let errorMessage = "Falha ao gerar pré-análise";
    let errorDetails = "Erro interno do servidor";
    let httpStatus = 500;
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      errorDetails = error.message;
      
      if (errorMsg.includes('timeout') || errorMsg.includes('etimedout') || errorMsg.includes('econnreset')) {
        errorMessage = "Timeout na requisição - tente reduzir o número de imagens";
        httpStatus = 408;
      } else if (errorMsg.includes('openai') || errorMsg.includes('api')) {
        if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
          errorMessage = "Chave da API OpenAI inválida";
          httpStatus = 401;
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          errorMessage = "Limite da API OpenAI excedido - aguarde e tente novamente";
          httpStatus = 429;
        } else if (errorMsg.includes('quota') || errorMsg.includes('insufficient')) {
          errorMessage = "Cota da API OpenAI esgotada";
          httpStatus = 402;
        } else {
          errorMessage = "Erro na API da OpenAI";
          httpStatus = 502;
        }
      } else if (errorMsg.includes('not found')) {
        errorMessage = "Recurso não encontrado";
        httpStatus = 404;
      }
    }
    
    return c.json({ 
      success: false,
      error: errorMessage, 
      details: errorDetails,
      field_name: body?.field_name || 'desconhecido',
      field_type: body?.field_type || 'desconhecido',
      error_code: `PRE_ANALYSIS_${httpStatus}`,
      timestamp: new Date().toISOString()
    }, httpStatus as any);
  }
});

// Create action for inspection item - ENHANCED PRODUCTION
app.post("/api/inspection-items/:id/create-action", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  console.log(`[CREATE-ACTION] Iniciando criação de ação para item ${itemId}`);
  
  // ENHANCED PRODUCTION VALIDATION - Maximum permissiveness
  if (!env.OPENAI_API_KEY) {
    console.error('[CREATE-ACTION] OpenAI API key não configurada');
    return c.json({ 
      error: "Serviço de IA não disponível",
      message: "Configure a chave OpenAI para criar ações automaticamente",
      success: false,
      error_code: "NO_API_KEY"
    }, 503);
  }
  
  // Very flexible validation for production
  if (env.OPENAI_API_KEY.length < 5) {
    console.error('[CREATE-ACTION] Chave OpenAI inválida');
    return c.json({ 
      error: "Configuração de IA inválida", 
      message: "Chave de API não configurada corretamente",
      success: false,
      error_code: "INVALID_API_KEY"
    }, 503);
  }
  
  try {
    const body = await c.req.json();
    const { field_name, field_type, response_value, pre_analysis, media_data, user_prompt } = body;
    
    // Get comprehensive inspection context
    const inspectionItem = await env.DB.prepare(`
      SELECT ii.*, i.title, i.location, i.company_name, i.inspector_name, i.description as inspection_description,
             i.id as inspection_id, i.organization_id, i.ai_assistant_id
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.id = ?
    `).bind(itemId).first() as any;
    
    if (!inspectionItem) {
      return c.json({ error: "Inspection item not found" }, 404);
    }
    
    const inspectionId = inspectionItem.inspection_id;
    
    const openai = await getOpenAIClient(env.OPENAI_API_KEY);
    console.log(`[CREATE-ACTION] Cliente OpenAI inicializado`);
    
    // Get AI assistant for this inspection if available
    let assistantInstructions = '';
    if (inspectionItem.ai_assistant_id) {
      const assistant = await env.DB.prepare(`
        SELECT name, instructions FROM ai_assistants WHERE id = ? AND is_active = true
      `).bind(inspectionItem.ai_assistant_id).first() as any;
      
      if (assistant) {
        assistantInstructions = `\n\nVOCÊ É UM ${assistant.name.toUpperCase()}:\n${assistant.instructions}\n\n`;
      }
    }
    
    // Build multimodal message content for action generation
    const messageContent: any[] = [];
    
    // Add text prompt for action planning
    let textPrompt = `Você é um especialista sênior em segurança do trabalho e gestão de riscos, com experiência em planejamento de ações corretivas e preventivas.${assistantInstructions}

ANÁLISE MULTIMODAL PARA AÇÃO CORRETIVA:
Determine se é necessária ação corretiva analisando TODAS as evidências fornecidas (texto, imagens, áudios, vídeos) de forma integrada.

CONTEXTO COMPLETO DA INSPEÇÃO:
- Empresa: ${inspectionItem.company_name || 'Não informado'}
- Local: ${inspectionItem.location || 'Não informado'}
- Inspetor: ${inspectionItem.inspector_name || 'Não informado'}
- Título da Inspeção: ${inspectionItem.title || 'Não informado'}
- Descrição geral: ${inspectionItem.inspection_description || 'Não informado'}

ITEM SENDO AVALIADO:
- Campo/Questão: ${field_name}
- Tipo de campo: ${field_type}
- Resposta fornecida: ${response_value || 'Não respondido'}`;

    // Include pre-analysis if available
    if (pre_analysis) {
      textPrompt += `\n- Pré-análise realizada: ${pre_analysis}`;
    }

    // Add user prompt if provided
    if (user_prompt && user_prompt.trim() !== '') {
      textPrompt += `\n- Solicitação específica do usuário: "${user_prompt}"`;
    }

    // Enhanced multimodal context for action planning
    if (media_data && media_data.length > 0) {
      const imageCount = media_data.filter((m: any) => m.media_type === 'image').length;
      const audioCount = media_data.filter((m: any) => m.media_type === 'audio').length;
      const videoCount = media_data.filter((m: any) => m.media_type === 'video').length;
      const docCount = media_data.filter((m: any) => m.media_type === 'document').length;
      
      textPrompt += `\n\nEVIDÊNCIAS MULTIMODAIS PARA PLANEJAMENTO DE AÇÃO:`;
      textPrompt += `\n- ${imageCount} imagem(s) - Identifique problemas específicos, localizações exatas, equipamentos envolvidos`;
      
      if (audioCount > 0) {
        textPrompt += `\n- ${audioCount} áudio(s) - Considere informações verbais, ruídos anômalos, condições acústicas`;
      }
      
      if (videoCount > 0) {
        textPrompt += `\n- ${videoCount} vídeo(s) - Observe procedimentos incorretos, movimentos inseguros, dinâmicas problemáticas`;
      }
      
      if (docCount > 0) {
        textPrompt += `\n- ${docCount} documento(s) - Verifique procedimentos, normas, registros relevantes`;
      }
      
      textPrompt += `\n\nUse as evidências para:
- Identificar não-conformidades específicas e sua localização exata
- Dimensionar a severidade do problema observado
- Planejar ações mais precisas e efetivas
- Definir localizações e métodos específicos para intervenção`;
    }

    // Context-aware role and risk assessment
    textPrompt += `\n\nAVALIAÇÃO CONTEXTUAL DE RISCO:
Se identificar cargos específicos (soldador, pedreiro, operador, eletricista), considere:
- Riscos ocupacionais específicos da função
- Procedimentos de segurança aplicáveis e EPIs obrigatórios
- Normas regulamentadoras pertinentes (NRs específicas)
- Consequências da não-conformidade para aquela atividade

Critérios para determinar necessidade de ação:
- Probabilidade de ocorrência do risco identificado
- Severidade das possíveis consequências
- Impacto na saúde e segurança dos trabalhadores
- Requisitos legais e normativos
- Urgência baseada no contexto operacional e evidências observadas`;

    // User prompt integration for actions
    if (user_prompt && user_prompt.trim() !== '') {
      textPrompt += `\n\nFOCO ESPECÍFICO SOLICITADO:
Direcione a criação da ação para: "${user_prompt}"
Mantenha foco em segurança e conformidade, adaptando conforme solicitado.`;
    }

    textPrompt += `\n\nFORMATO DE RESPOSTA:
Retorne JSON com:
- requires_action: boolean (true se necessária ação corretiva baseada nas evidências)
- title: título claro da ação (máx 80 chars)
- what_description: descrição detalhada incluindo especificações técnicas observadas
- where_location: localização específica (use contexto da inspeção e evidências visuais)
- how_method: metodologia detalhada de execução com procedimentos e recursos
- priority: 'baixa', 'media', 'alta', 'critica' (baseado na análise de risco das evidências)

CRITÉRIOS PARA AÇÃO (baseados em evidências):
- Não-conformidades de segurança visíveis/audíveis
- Riscos identificados nas mídias (mesmo potenciais)
- Ausência ou inadequação de EPIs observada
- Procedimentos incorretos registrados
- Condições ambientais inadequadas documentadas
- Necessidade de treinamento identificada

Se NÃO houver evidências suficientes para ação corretiva: {"requires_action": false}

IMPORTANTE: Os campos "who", "when" e "how_much" serão preenchidos depois pelo usuário.`;

    messageContent.push({
      type: "text",
      text: textPrompt
    });

    // Add images with AGGRESSIVE OPTIMIZATION for mobile reliability
    let imagesProcessed = 0;
    const MAX_ACTION_IMAGES = 1; // Apenas 1 imagem para ações
    const MAX_ACTION_SIZE_MB = 1.2; // Limite muito baixo
    
    if (media_data && media_data.length > 0) {
      for (const media of media_data) {
        if (media.media_type === 'image' && media.file_url) {
          try {
            // Check if it's a data URL (base64) - GPT-4V can analyze these directly
            if (media.file_url.startsWith('data:image/')) {
              // Validate image size aggressively
              const sizeInBytes = (media.file_url.length * 3) / 4;
              const sizeInMB = sizeInBytes / (1024 * 1024);
              
              if (sizeInMB > MAX_ACTION_SIZE_MB) {
                console.warn(`[CREATE-ACTION] Imagem muito grande (${sizeInMB.toFixed(2)}MB), pulando`);
                continue;
              }
              
              if (imagesProcessed >= MAX_ACTION_IMAGES) {
                console.warn(`[CREATE-ACTION] Limite de ${MAX_ACTION_IMAGES} imagem atingido`);
                break;
              }
              
              messageContent.push({
                type: "image_url",
                image_url: {
                  url: media.file_url,
                  detail: "low" // Use low detail for speed and reliability
                }
              });
              imagesProcessed++;
              console.log(`[CREATE-ACTION] Imagem processada: ${media.file_name} (${sizeInMB.toFixed(2)}MB)`);
            }
          } catch (error) {
            console.error('[CREATE-ACTION] Erro processando imagem:', media.file_name, error);
          }
        }
        
        // For audio/video files, add descriptive context
        if (media.media_type === 'audio') {
          messageContent.push({
            type: "text",
            text: `\n[ÁUDIO PARA ANÁLISE: ${media.file_name}] - Este áudio contém informações relevantes sobre condições de trabalho, ruídos, conversas ou situações que podem requerer ação corretiva.`
          });
        }
        
        if (media.media_type === 'video') {
          messageContent.push({
            type: "text",
            text: `\n[VÍDEO PARA ANÁLISE: ${media.file_name}] - Este vídeo documenta procedimentos, movimentações ou situações em tempo real que podem requerer intervenção ou correção.`
          });
        }
      }
    }
    
    console.log(`[CREATE-ACTION] Fazendo chamada OpenAI com ${messageContent.length} partes de conteúdo...`);
    
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: messageContent }],
        temperature: 0.2,
        max_tokens: 1000,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na criação de ação após 40 segundos')), 40000)
      )
    ]) as any;
    
    console.log(`[CREATE-ACTION] Resposta recebida da OpenAI`);
    
    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error("No response from OpenAI");
    }
    
    // Parse the action plan
    let actionData;
    try {
      actionData = JSON.parse(response);
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        actionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }
    
    if (actionData.requires_action) {
      // Create the action item with enhanced data
      const result = await env.DB.prepare(`
        INSERT INTO action_items (
          inspection_id, inspection_item_id, title, what_description, where_location,
          how_method, is_ai_generated, status, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        inspectionId,
        itemId,
        actionData.title || 'Ação Corretiva',
        actionData.what_description || null,
        actionData.where_location || null,
        actionData.how_method || null,
        true,
        'pending',
        actionData.priority || 'media'
      ).run();
      
      actionData.id = result.meta.last_row_id;
    }
    
    return c.json({ 
      action: actionData,
      message: actionData.requires_action ? "Ação corretiva criada com base na análise multimodal" : "Nenhuma ação corretiva necessária baseada na análise das evidências"
    });
    
  } catch (error) {
    console.error('[CREATE-ACTION] ❌ Erro na criação de ação:', error);
    
    // ENHANCED error analysis for production reliability
    let errorMessage = "Falha ao criar ação";
    let errorDetails = "Erro interno do servidor";
    let httpStatus = 500;
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      errorDetails = error.message;
      
      console.error('[CREATE-ACTION] Detalhes do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200) + '...'
      });
      
      if (errorMsg.includes('timeout')) {
        errorMessage = "Tempo limite excedido - tente com menos conteúdo";
        httpStatus = 408;
      } else if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
        errorMessage = "Chave OpenAI inválida - contate o administrador";
        httpStatus = 401;
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        errorMessage = "Limite de uso excedido - aguarde alguns minutos";
        httpStatus = 429;
      } else if (errorMsg.includes('400') || errorMsg.includes('bad request')) {
        errorMessage = "Conteúdo inválido - reduza o tamanho das imagens";
        httpStatus = 400;
      } else if (errorMsg.includes('500') || errorMsg.includes('internal')) {
        errorMessage = "Erro interno da OpenAI - tente novamente";
        httpStatus = 502;
      } else if (errorMsg.includes('openai') || errorMsg.includes('api')) {
        errorMessage = "Erro na API da IA - verifique sua conexão";
        httpStatus = 502;
      } else if (errorMsg.includes('json') || errorMsg.includes('parse')) {
        errorMessage = "Erro no processamento da resposta da IA";
        httpStatus = 500;
      }
    }
    
    return c.json({ 
      success: false,
      error: errorMessage, 
      details: errorDetails,
      error_code: `CREATE_ACTION_${httpStatus}`,
      timestamp: new Date().toISOString(),
      help: "Tente novamente com menos imagens ou crie a ação manualmente"
    }, httpStatus as any);
  }
});

// Get actions for inspection item
app.get("/api/inspection-items/:id/actions", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  try {
    const actions = await env.DB.prepare(`
      SELECT * FROM action_items WHERE inspection_item_id = ? ORDER BY created_at DESC
    `).bind(itemId).all();
    
    return c.json({ actions: actions.results || [] });
  } catch (error) {
    console.error('Error fetching actions:', error);
    return c.json({ actions: [] });
  }
});

// Get media for inspection item
app.get("/api/inspection-items/:id/media", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  try {
    const media = await env.DB.prepare(`
      SELECT * FROM inspection_media WHERE inspection_item_id = ? ORDER BY created_at DESC
    `).bind(itemId).all();
    
    return c.json({ media: media.results || [] });
  } catch (error) {
    console.error('Error fetching media:', error);
    return c.json({ media: [] });
  }
});

// Add new action item to inspection (manual creation from action plan page)
app.post("/api/inspections/:id/action-items", authMiddleware, async (c) => {
  const env = c.env;
  const inspectionId = parseInt(c.req.param("id"));
  
  try {
    const data = await c.req.json();
    
    console.log('[CREATE-MANUAL-ACTION] Criando ação manual para inspeção:', inspectionId, data);
    
    const result = await env.DB.prepare(`
      INSERT INTO action_items (
        inspection_id, inspection_item_id, title, what_description, where_location,
        why_reason, how_method, who_responsible, when_deadline, how_much_cost,
        status, priority, is_ai_generated, assigned_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      inspectionId,
      data.inspection_item_id || null, // Can be null if it's a standalone action
      data.title || 'Nova Ação',
      data.what_description || null,
      data.where_location || null,
      data.why_reason || null,
      data.how_method || null,
      data.who_responsible || null,
      data.when_deadline || null,
      data.how_much_cost || null,
      data.status || 'pending',
      data.priority || 'media',
      data.is_ai_generated || false,
      data.assigned_to || null
    ).run();
    
    console.log('[CREATE-MANUAL-ACTION] Ação manual criada com ID:', result.meta.last_row_id);
    
    return c.json({ 
      id: result.meta.last_row_id, 
      message: "Ação criada com sucesso" 
    });
  } catch (error) {
    console.error('[CREATE-MANUAL-ACTION] Erro ao criar ação manual:', error);
    return c.json({ 
      error: "Falha ao criar ação", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Update action item
app.put("/api/action-items/:id", authMiddleware, async (c) => {
  const env = c.env;
  const actionId = parseInt(c.req.param("id"));
  
  try {
    const data = await c.req.json();
    
    console.log('[UPDATE-ACTION] Atualizando ação:', actionId, data);
    
    // Filter only allowed fields to prevent arbitrary updates
    const allowedFields = [
      'title', 'what_description', 'where_location', 'why_reason', 
      'how_method', 'who_responsible', 'when_deadline', 'how_much_cost', 
      'status', 'priority', 'assigned_to'
    ];
    
    const updateFields = [];
    const updateValues = [];
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(data[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return c.json({ error: "Nenhum campo válido para atualizar" }, 400);
    }
    
    updateFields.push("updated_at = datetime('now')");
    
    await env.DB.prepare(`
      UPDATE action_items 
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `).bind(...updateValues, actionId).run();
    
    console.log('[UPDATE-ACTION] Ação atualizada com sucesso:', actionId);
    
    return c.json({ message: "Ação atualizada com sucesso" });
  } catch (error) {
    console.error('[UPDATE-ACTION] Erro ao atualizar ação:', error);
    return c.json({ 
      error: "Falha ao atualizar ação", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Delete action item
app.delete("/api/action-items/:id", authMiddleware, async (c) => {
  const env = c.env;
  const id = parseInt(c.req.param("id"));
  
  try {
    console.log('[DELETE-ACTION] Deletando ação:', id);
    
    await env.DB.prepare("DELETE FROM action_items WHERE id = ?").bind(id).run();
    
    console.log('[DELETE-ACTION] Ação deletada com sucesso:', id);
    
    return c.json({ message: "Ação deletada com sucesso" });
  } catch (error) {
    console.error('[DELETE-ACTION] Erro ao deletar ação:', error);
    return c.json({ 
      error: "Falha ao deletar ação", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Get all action plans (centralized view)
app.get("/api/action-plans/all", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile to check organization access
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    let query = `
      SELECT ai.*, i.title as inspection_title, i.location as inspection_location, 
             i.company_name as inspection_company, i.organization_id
      FROM action_items ai
      JOIN inspections i ON ai.inspection_id = i.id
    `;
    let params: any[] = [];
    let whereClause = [];
    
    // Check for organization filter from query params
    const organizationId = c.req.query('organization_id');
    if (organizationId) {
      whereClause.push("i.organization_id = ?");
      params.push(parseInt(organizationId));
    } else {
      // Apply organization-based filtering based on user role
      if (userProfile?.role === USER_ROLES.SYSTEM_ADMIN) {
        // SYSTEM_ADMIN sees ALL actions - no restrictions
      } else if (userProfile?.role === USER_ROLES.ORG_ADMIN && userProfile?.managed_organization_id) {
        // Org admin sees their organization and subsidiaries
        whereClause.push(`(i.organization_id = ? OR i.organization_id IN (
          SELECT id FROM organizations WHERE parent_organization_id = ?
        ))`);
        params.push(userProfile.managed_organization_id, userProfile.managed_organization_id);
      } else if (userProfile?.organization_id) {
        // Other users see only their organization's actions
        whereClause.push("i.organization_id = ?");
        params.push(userProfile.organization_id);
      }
    }
    
    // For non-admin users, also filter by created_by or collaborators
    if (userProfile?.role !== USER_ROLES.SYSTEM_ADMIN && userProfile?.role !== USER_ROLES.ORG_ADMIN) {
      whereClause.push("(i.created_by = ? OR i.id IN (SELECT inspection_id FROM inspection_collaborators WHERE user_id = ? AND status = 'active'))");
      params.push(user.id, user.id);
    }
    
    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    query += " ORDER BY ai.created_at DESC";
    
    const actionItems = await env.DB.prepare(query).bind(...params).all();
    
    return c.json({ action_items: actionItems.results || [] });
  } catch (error) {
    console.error('Error fetching all action items:', error);
    return c.json({ action_items: [] });
  }
});

// Role Permissions endpoints
app.get("/api/role-permissions", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    // Only system admins can manage role permissions
    if (!userProfile || userProfile.role !== USER_ROLES.SYSTEM_ADMIN) {
      return c.json({ error: "Only system administrators can manage role permissions" }, 403);
    }
    
    // Get all role permissions
    const permissions = await env.DB.prepare(`
      SELECT * FROM role_permissions ORDER BY role, permission_type
    `).all();
    
    return c.json({ permissions: permissions.results || [] });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return c.json({ error: "Failed to fetch role permissions" }, 500);
  }
});

app.post("/api/role-permissions", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    // Only system admins can manage role permissions
    if (!userProfile || userProfile.role !== USER_ROLES.SYSTEM_ADMIN) {
      return c.json({ error: "Only system administrators can manage role permissions" }, 403);
    }
    
    const body = await c.req.json();
    const { updates } = body;
    
    if (!updates || !Array.isArray(updates)) {
      return c.json({ error: "Invalid updates data" }, 400);
    }
    
    // Process each update
    for (const update of updates) {
      const { role, permission_type, is_allowed } = update;
      
      // Check if permission exists
      const existing = await env.DB.prepare(`
        SELECT id FROM role_permissions WHERE role = ? AND permission_type = ?
      `).bind(role, permission_type).first();
      
      if (existing) {
        // Update existing permission
        await env.DB.prepare(`
          UPDATE role_permissions 
          SET is_allowed = ?, updated_at = datetime('now')
          WHERE role = ? AND permission_type = ?
        `).bind(is_allowed, role, permission_type).run();
      } else {
        // Create new permission
        await env.DB.prepare(`
          INSERT INTO role_permissions (role, permission_type, is_allowed, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).bind(role, permission_type, is_allowed).run();
      }
    }
    
    // Log activity
    await env.DB.prepare(`
      INSERT INTO activity_log (user_id, action_type, action_description, target_type, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'role_permissions_updated',
      `Updated ${updates.length} role permission(s)`,
      'role_permissions'
    ).run();
    
    return c.json({ 
      message: "Role permissions updated successfully",
      updated_count: updates.length
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    return c.json({ error: "Failed to update role permissions" }, 500);
  }
});

// Get AI assistants
app.get("/api/ai-assistants", authMiddleware, async (c) => {
  const env = c.env;
  
  try {
    // Check if we have any assistants, if not, create default ones
    const existingAssistants = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_assistants WHERE is_active = true
    `).first() as any;
    
    if (existingAssistants?.count === 0) {
      // Create default AI assistants
      const defaultAssistants = [
        {
          name: "Especialista NR-12",
          description: "Especialista em segurança de máquinas e equipamentos",
          specialization: "Máquinas e Equipamentos", 
          instructions: `Você é um especialista técnico em NR-12 (Segurança no Trabalho em Máquinas e Equipamentos) com vasta experiência em:

- Proteções fixas e móveis em máquinas industriais
- Dispositivos de segurança (cortinas de luz, tapetes de segurança, chaves de segurança)
- Sistemas de comando bimanual e parada de emergência  
- Procedimentos de LOTO (Lockout/Tagout)
- Ergonomia em postos de trabalho com máquinas
- Análise de riscos em processos automatizados
- Capacitação de operadores em segurança de máquinas
- Manutenção preventiva com foco em segurança

Sua análise deve focar especificamente em riscos mecânicos, proteções inadequadas, falhas em dispositivos de segurança e procedimentos operacionais inseguros relacionados a máquinas e equipamentos.`
        },
        {
          name: "Especialista em Ergonomia",
          description: "Especialista em análise ergonômica e NR-17",
          specialization: "Ergonomia e NR-17",
          instructions: `Você é um especialista técnico em Ergonomia e NR-17 com expertise em:

- Análise de posturas de trabalho (sentado, em pé, agachado)
- Levantamento e transporte manual de cargas
- Análise de movimentos repetitivos e esforços
- Organização do trabalho e pausas
- Condições ambientais (iluminação, ruído, temperatura)
- Design de postos de trabalho e layout ergonômico
- Mobiliário e equipamentos ergonômicos
- Ginástica laboral e exercícios compensatórios
- Avaliação de riscos ergonômicos (RULA, REBA, NIOSH)

Sua análise deve identificar fatores de risco ergonômico, posturas inadequadas, esforços excessivos e propor soluções para melhoria das condições de trabalho.`
        },
        {
          name: "Especialista em EPIs",
          description: "Especialista em equipamentos de proteção individual",
          specialization: "Equipamentos de Proteção Individual",
          instructions: `Você é um especialista técnico em EPIs (Equipamentos de Proteção Individual) com conhecimento aprofundado em:

- Seleção adequada de EPIs por tipo de risco
- Certificados de Aprovação (CA) e validade
- Proteção respiratória (máscaras, respiradores, filtros)
- Proteção auditiva (protetores auriculares, abafadores)
- Proteção visual e facial (óculos, viseiras, máscaras de solda)
- Proteção da cabeça (capacetes, capuzes)
- Proteção das mãos (luvas de diferentes materiais)
- Proteção dos pés (calçados de segurança, botinas)
- Proteção do corpo (aventais, macacões, coletes)
- Proteção contra quedas (cinturões, talabartes, capacetes)
- Treinamento e conscientização no uso de EPIs
- Higienização, conservação e substituição de EPIs

Sua análise deve verificar adequação, estado de conservação, uso correto e necessidade de substituição ou complementação dos EPIs.`
        },
        {
          name: "Especialista em Altura",
          description: "Especialista em trabalho em altura e NR-35",
          specialization: "Trabalho em Altura",
          instructions: `Você é um especialista técnico em NR-35 (Trabalho em Altura) com experiência em:

- Análise de Risco (AR) para trabalho em altura
- Permissão de Trabalho (PT) em altura
- Sistemas de proteção contra quedas (coletiva e individual)
- Equipamentos para trabalho em altura (cintos, talabartes, trava-quedas)
- Ancoragem e pontos de fixação seguros
- Andaimes, plataformas e estruturas temporárias
- Escadas fixas e móveis
- Resgate em altura e primeiros socorros
- Capacitação e autorização para trabalho em altura
- Supervisão e acompanhamento de trabalhos em altura
- Condições meteorológicas adversas
- Planejamento e organização do trabalho em altura

Sua análise deve focar nos riscos de queda, adequação dos sistemas de proteção, procedimentos de segurança e capacitação dos trabalhadores.`
        },
        {
          name: "Psicólogo do Trabalho",
          description: "Especialista em fatores psicossociais e saúde mental no trabalho",
          specialization: "Fatores Psicossociais",
          instructions: `Você é um psicólogo do trabalho especialista em fatores psicossociais com conhecimento em:

- Avaliação de riscos psicossociais no ambiente de trabalho
- Identificação de fatores de estresse ocupacional
- Análise de carga mental e pressão temporal
- Relacionamento interpessoal e clima organizacional
- Liderança e estilos de gestão impactantes na saúde mental
- Prevenção de burnout e esgotamento profissional
- Identificação de sinais de ansiedade e depressão relacionada ao trabalho
- Programas de qualidade de vida no trabalho
- Violência psicológica e assédio moral
- Organização do trabalho e autonomia dos trabalhadores
- Suporte social e reconhecimento profissional
- Programas de reintegração pós-afastamento

Sua análise deve identificar fatores de risco psicossocial, condições que impactem a saúde mental dos trabalhadores e propor intervenções para melhoria do bem-estar psicológico.`
        }
      ];

      for (const assistant of defaultAssistants) {
        await env.DB.prepare(`
          INSERT INTO ai_assistants (name, description, specialization, instructions, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          assistant.name,
          assistant.description,
          assistant.specialization,
          assistant.instructions,
          true
        ).run();
      }
    }

    // Now fetch all active assistants
    const assistants = await env.DB.prepare(`
      SELECT * FROM ai_assistants WHERE is_active = true ORDER BY name ASC
    `).all();
    
    return c.json({ assistants: assistants.results || [] });
  } catch (error) {
    console.error('Error fetching AI assistants:', error);
    return c.json({ assistants: [] });
  }
});

// Create AI assistant (admin only)
app.post("/api/ai-assistants", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  
  try {
    // Check if user is admin
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user!.id).first() as any;
    if (!userProfile || (userProfile.role !== USER_ROLES.SYSTEM_ADMIN && userProfile.role !== USER_ROLES.ORG_ADMIN)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    
    const data = await c.req.json();
    
    await env.DB.prepare(`
      INSERT INTO ai_assistants (name, description, specialization, instructions, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      data.name,
      data.description || null,
      data.specialization,
      data.instructions
    ).run();
    
    return c.json({ message: "AI assistant created successfully" });
  } catch (error) {
    console.error('Error creating AI assistant:', error);
    return c.json({ error: "Failed to create AI assistant" }, 500);
  }
});

// Update AI assistant (admin only)
app.put("/api/ai-assistants/:id", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  
  try {
    // Check if user is admin
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user!.id).first() as any;
    if (!userProfile || (userProfile.role !== USER_ROLES.SYSTEM_ADMIN && userProfile.role !== USER_ROLES.ORG_ADMIN)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    
    const data = await c.req.json();
    
    await env.DB.prepare(`
      UPDATE ai_assistants 
      SET name = ?, description = ?, specialization = ?, instructions = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      data.name,
      data.description || null,
      data.specialization,
      data.instructions,
      id
    ).run();
    
    return c.json({ message: "AI assistant updated successfully" });
  } catch (error) {
    console.error('Error updating AI assistant:', error);
    return c.json({ error: "Failed to update AI assistant" }, 500);
  }
});

// Delete AI assistant (admin only)
app.delete("/api/ai-assistants/:id", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  const id = parseInt(c.req.param("id"));
  
  try {
    // Check if user is admin
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user!.id).first() as any;
    if (!userProfile || (userProfile.role !== USER_ROLES.SYSTEM_ADMIN && userProfile.role !== USER_ROLES.ORG_ADMIN)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    
    await env.DB.prepare("UPDATE ai_assistants SET is_active = false WHERE id = ?").bind(id).run();
    
    return c.json({ message: "AI assistant deleted successfully" });
  } catch (error) {
    console.error('Error deleting AI assistant:', error);
    return c.json({ error: "Failed to delete AI assistant" }, 500);
  }
});

// Clear AI pre-analysis from inspection item
app.delete("/api/inspection-items/:id/pre-analysis", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  try {
    await env.DB.prepare(`
      UPDATE inspection_items 
      SET ai_pre_analysis = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).bind(itemId).run();
    
    return c.json({ message: "Pre-analysis removed successfully" });
  } catch (error) {
    console.error('Error removing pre-analysis:', error);
    return c.json({ error: "Failed to remove pre-analysis" }, 500);
  }
});

// Clear AI action plan from inspection item
app.delete("/api/inspection-items/:id/action-plan", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  try {
    await env.DB.prepare(`
      UPDATE inspection_items 
      SET ai_action_plan = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).bind(itemId).run();
    
    return c.json({ message: "Action plan removed successfully" });
  } catch (error) {
    console.error('Error removing action plan:', error);
    return c.json({ error: "Failed to remove action plan" }, 500);
  }
});

// Generate field response with AI - ENHANCED PRODUCTION AUDIT FIX
app.post("/api/inspection-items/:id/generate-field-response", async (c) => {
  const env = c.env;
  const itemId = parseInt(c.req.param("id"));
  
  console.log(`[GEN-RESP] [AUDIT] Iniciando geração de resposta IA para item ${itemId}`);
  console.log(`[GEN-RESP] [AUDIT] Request method:`, c.req.method);
  
  // MAXIMUM PRODUCTION RELIABILITY - Bypass all non-critical validations
  if (!env.OPENAI_API_KEY) {
    console.error('[GEN-RESP] [AUDIT] CRÍTICO: OpenAI API key não configurada');
    return c.json({ 
      error: "Serviço de IA temporariamente indisponível",
      message: "Configure a chave OpenAI no ambiente",
      success: false,
      error_code: "NO_API_KEY",
      debug_info: { item_id: itemId, timestamp: new Date().toISOString() }
    }, 503);
  }
  
  // Ultra minimal validation - accept almost any key format for reliability
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.trim().length < 3) {
    console.error('[GEN-RESP] [AUDIT] CRÍTICO: Chave OpenAI inválida ou muito curta');
    return c.json({ 
      error: "Configuração de IA inválida",
      message: "Chave de API inválida",
      success: false,
      error_code: "INVALID_API_KEY",
      debug_info: { 
        item_id: itemId, 
        key_length: env.OPENAI_API_KEY?.length || 0,
        timestamp: new Date().toISOString() 
      }
    }, 503);
  }
  
  let body: any = {};
  const startTime = Date.now(); // Move startTime to beginning of function
  
  try {
    console.log(`[GEN-RESP] [AUDIT] Parsing request body para item ${itemId}`);
    
    // Enhanced request body parsing with timeout protection
    const requestTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout parsing request body')), 10000)
    );
    
    body = await Promise.race([
      c.req.json(),
      requestTimeout
    ]);
    
    console.log(`[GEN-RESP] [AUDIT] Body parsed successfully:`, {
      hasFieldName: !!body?.field_name,
      hasFieldType: !!body?.field_type,
      hasCurrentResponse: body?.current_response !== undefined,
      hasMediaData: !!body?.media_data,
      mediaDataLength: body?.media_data?.length || 0,
      bodyKeys: Object.keys(body || {})
    });
    
    const { field_name, field_type, current_response, media_data, field_options } = body;
    
    console.log('[GEN-RESP] [AUDIT] Dados recebidos completos:', {
      itemId,
      field_name: field_name?.substring(0, 50) + '...',
      field_type,
      current_response: current_response,
      current_response_type: typeof current_response,
      media_count: media_data?.length || 0,
      has_options: !!field_options,
      field_options_preview: field_options?.toString()?.substring(0, 100),
      raw_body_size: JSON.stringify(body)?.length || 0
    });
    
    // Get comprehensive inspection context with enhanced logging
    console.log(`[GEN-RESP] [AUDIT] Buscando item ${itemId} no banco de dados...`);
    
    const inspectionItem = await env.DB.prepare(`
      SELECT ii.*, i.title, i.location, i.company_name, i.inspector_name, i.description as inspection_description,
             i.ai_assistant_id, i.id as inspection_id
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.id = ?
    `).bind(itemId).first() as any;
    
    if (!inspectionItem) {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Item de inspeção não encontrado no BD:', itemId);
      return c.json({ 
        error: "Item de inspeção não encontrado",
        success: false,
        error_code: "ITEM_NOT_FOUND",
        debug_info: { 
          item_id: itemId, 
          timestamp: new Date().toISOString() 
        }
      }, 404);
    }
    
    console.log('[GEN-RESP] [AUDIT] Item encontrado:', {
      item_id: inspectionItem.id,
      inspection_id: inspectionItem.inspection_id,
      has_ai_assistant: !!inspectionItem.ai_assistant_id,
      company: inspectionItem.company_name,
      location: inspectionItem.location
    });
    
    console.log('[GEN-RESP] [AUDIT] Inicializando cliente OpenAI...');
    console.log('[GEN-RESP] [AUDIT] OpenAI Key info:', {
      has_key: !!env.OPENAI_API_KEY,
      key_prefix: env.OPENAI_API_KEY?.substring(0, 10) + '...',
      key_length: env.OPENAI_API_KEY?.length || 0
    });
    
    let openai;
    try {
      openai = await getOpenAIClient(env.OPENAI_API_KEY);
      console.log('[GEN-RESP] [AUDIT] Cliente OpenAI inicializado com sucesso');
    } catch (initError) {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Falha ao inicializar OpenAI:', initError);
      return c.json({ 
        error: "Falha ao inicializar serviço de IA",
        success: false,
        error_code: "OPENAI_INIT_FAILED",
        debug_info: { 
          item_id: itemId, 
          error_message: initError instanceof Error ? initError.message : String(initError),
          timestamp: new Date().toISOString() 
        }
      }, 500);
    }
    
    // Parse field options safely with enhanced error handling
    let fieldOptions: string[] = [];
    try {
      if (field_options && field_options !== '') {
        console.log('[GEN-RESP] [AUDIT] Parsing field options:', { 
          type: typeof field_options, 
          value: field_options,
          length: field_options?.length || 0
        });
        
        if (typeof field_options === 'string') {
          if (field_options.startsWith('[') && field_options.endsWith(']')) {
            fieldOptions = JSON.parse(field_options);
          } else if (field_options.includes('|')) {
            fieldOptions = field_options.split('|').map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0);
          } else {
            fieldOptions = [field_options.trim()];
          }
        } else if (Array.isArray(field_options)) {
          fieldOptions = field_options.map(opt => String(opt).trim()).filter(opt => opt.length > 0);
        }
        
        console.log('[GEN-RESP] [AUDIT] Field options parsed successfully:', fieldOptions);
      } else {
        console.log('[GEN-RESP] [AUDIT] No field options provided');
      }
    } catch (parseError) {
      console.error('[GEN-RESP] [AUDIT] Failed to parse field options:', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        field_options,
        type: typeof field_options
      });
      fieldOptions = []; // Safe fallback
    }
    
    // Get AI assistant for this inspection if available
    let assistantInstructions = '';
    if (inspectionItem.ai_assistant_id) {
      try {
        console.log('[GEN-RESP] [AUDIT] Loading AI assistant:', inspectionItem.ai_assistant_id);
        const assistant = await env.DB.prepare(`
          SELECT name, instructions FROM ai_assistants WHERE id = ? AND is_active = true
        `).bind(inspectionItem.ai_assistant_id).first() as any;
        
        if (assistant) {
          assistantInstructions = `\n\nVOCÊ É UM ${assistant.name.toUpperCase()}:\n${assistant.instructions}\n\n`;
          console.log('[GEN-RESP] [AUDIT] AI assistant loaded:', assistant.name);
        } else {
          console.log('[GEN-RESP] [AUDIT] AI assistant not found or inactive:', inspectionItem.ai_assistant_id);
        }
      } catch (assistantError) {
        console.error('[GEN-RESP] [AUDIT] Failed to load AI assistant:', assistantError);
        // Continue without assistant - don't fail the request
      }
    } else {
      console.log('[GEN-RESP] [AUDIT] No AI assistant assigned to inspection');
    }
    
    // Build multimodal message content for field response generation
    const messageContent: any[] = [];
    
    // Build comprehensive contextual prompt for response generation with multimodal analysis
    let textPrompt = `Você é um especialista sênior em segurança do trabalho analisando evidências multimodais.${assistantInstructions}

CONTEXTO DA INSPEÇÃO:
- Empresa: ${inspectionItem.company_name || 'Não informado'}
- Local: ${inspectionItem.location || 'Não informado'}
- Pergunta: ${field_name}
- Tipo: ${field_type}
- Resposta Atual: ${current_response !== undefined && current_response !== null ? current_response : 'Vazio'}
${fieldOptions.length > 0 ? `- Opções: ${fieldOptions.join(', ')}` : ''}

ANÁLISE MULTIMODAL ESTRUTURADA:
1. DESCREVA objetivamente o que você observa nas evidências (fotos, áudios, vídeos)
2. IDENTIFIQUE aspectos de segurança relevantes à pergunta específica
3. CONCLUA com resposta precisa para o campo

EVIDÊNCIAS DISPONÍVEIS:`;

    // Enhanced multimodal context with descriptive analysis
    let hasValidMedia = false;
    if (media_data && Array.isArray(media_data) && media_data.length > 0) {
      const imageCount = media_data.filter((m: any) => m && m.media_type === 'image').length;
      const audioCount = media_data.filter((m: any) => m && m.media_type === 'audio').length;
      const videoCount = media_data.filter((m: any) => m && m.media_type === 'video').length;
      const docCount = media_data.filter((m: any) => m && m.media_type === 'document').length;
      
      if (imageCount + audioCount + videoCount + docCount > 0) {
        hasValidMedia = true;
        textPrompt += `\n${imageCount} foto(s), ${audioCount} áudio(s), ${videoCount} vídeo(s), ${docCount} doc(s)`;
        
        console.log('Dados de mídia disponíveis para análise:', {
          total: media_data.length,
          images: imageCount,
          audios: audioCount,
          videos: videoCount,
          documents: docCount
        });
      }
    }
    
    if (!hasValidMedia) {
      console.log('Nenhuma mídia válida disponível para análise');
    }

    textPrompt += `\n\nINSTRUÇÕES (MÁXIMO 15 LINHAS TOTAL):
1. DESCREVA brevemente o que observa nas evidências (1-3 linhas)
2. ANALISE como isso responde à pergunta específica (1-2 linhas)  
3. CONCLUA com resposta precisa (1 linha)

FORMATO DE RESPOSTA ${field_type}:`;

if (field_type === 'boolean') {
  textPrompt += `\ntrue = Conforme | false = Não Conforme`;
} else if (field_type === 'select' || field_type === 'radio') {
  textPrompt += `\nEscolha: ${fieldOptions.join(' | ')}`;
} else if (field_type === 'rating') {
  textPrompt += `\nNúmero de 1 a 5`;
} else if (field_type === 'multiselect') {
  textPrompt += `\nArray: ["opção1", "opção2"]`;
} else {
  textPrompt += `\nTexto adequado ao campo`;
}

textPrompt += `\n\nRESPOSTA JSON (SEM MARKDOWN):
{"generated_response": valor, "generated_comment": "observação_concisa_máx_80_chars"}

IMPORTANTE: Resposta em até 15 LINHAS TOTAL. Base-se nas evidências visuais/auditivas.`;

    messageContent.push({
      type: "text",
      text: textPrompt
    });

    // SUPER OTIMIZAÇÃO MOBILE - Máxima confiabilidade para produção
    let imageProcessed = 0;
    const MAX_IMAGES = 1; // Apenas 1 imagem para máxima estabilidade
    const MAX_IMAGE_SIZE_MB = 0.8; // Limite ainda mais baixo para mobile
    
    console.log('[GEN-RESP] [AUDIT] Configuração de imagens:', {
      max_images: MAX_IMAGES,
      max_size_mb: MAX_IMAGE_SIZE_MB,
      has_media_data: !!media_data,
      media_count: media_data?.length || 0
    });
    
    if (hasValidMedia && media_data && Array.isArray(media_data) && media_data.length > 0) {
      for (const media of media_data) {
        if (media && media.media_type === 'image' && media.file_url) {
          try {
            // Check if it's a data URL (base64) - GPT-4V can analyze these directly
            if (media.file_url.startsWith('data:image/')) {
              // Validate image size - OpenAI has limits on image size
              const sizeInBytes = (media.file_url.length * 3) / 4; // Approximate base64 to bytes
              const sizeInMB = sizeInBytes / (1024 * 1024);
              
              if (sizeInMB > MAX_IMAGE_SIZE_MB) {
                console.warn(`Imagem ${media.file_name} muito grande (${sizeInMB.toFixed(2)}MB), pulando análise IA`);
                continue;
              }
              
              // Limit number of images to avoid token limits and timeout
              if (imageProcessed >= MAX_IMAGES) {
                console.warn(`Número máximo de imagens atingido (${MAX_IMAGES}), pulando imagens adicionais`);
                break;
              }
              
              messageContent.push({
                type: "image_url",
                image_url: {
                  url: media.file_url,
                  detail: "low" // Low detail para máxima velocidade e estabilidade
                }
              });
              imageProcessed++;
              console.log(`[DEBUG] Imagem ${imageProcessed} processada:`, media.file_name, `(${sizeInMB.toFixed(2)}MB)`);
            } else {
              console.warn(`Imagem ${media.file_name} não é uma URL de dados válida para análise IA`);
            }
          } catch (error) {
            console.error('Erro processando imagem para resposta de campo:', media.file_name, error);
          }
        }
        
        // Para arquivos de áudio/vídeo, adicionar contexto descritivo
        if (media && media.media_type === 'audio') {
          messageContent.push({
            type: "text",
            text: `[ÁUDIO ${media.file_name}]: Descreva sons, ruídos, conversas ou condições acústicas observadas que sejam relevantes para "${field_name}".`
          });
        }
        
        if (media && media.media_type === 'video') {
          messageContent.push({
            type: "text", 
            text: `[VÍDEO ${media.file_name}]: Descreva movimentos, procedimentos, comportamentos ou situações dinâmicas relevantes para "${field_name}".`
          });
        }
      }
      console.log(`Processadas ${imageProcessed} imagens de ${media_data.length} arquivos de mídia para análise IA`);
    }
    
    console.log('[GEN-RESP] [AUDIT] Preparando requisição OpenAI:', {
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 250,
      messageContentParts: messageContent.length,
      hasImages: messageContent.some(m => m.type === 'image_url'),
      imageCount: imageProcessed,
      textLength: messageContent.find(m => m.type === 'text')?.text?.length || 0,
      field_type: field_type,
      field_name_length: field_name?.length || 0
    });
    
    // Validar se temos conteúdo válido
    if (!messageContent || messageContent.length === 0) {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Nenhum conteúdo para enviar à OpenAI');
      return c.json({
        error: "Nenhum conteúdo válido para análise",
        success: false,
        error_code: "NO_CONTENT",
        debug_info: { 
          item_id: itemId,
          field_name,
          field_type,
          messageContentLength: messageContent?.length || 0
        }
      }, 400);
    }
    
    // Production optimized timeout and configuration with enhanced error handling
    let completion;
    
    try {
      console.log('[GEN-RESP] [AUDIT] Fazendo chamada para OpenAI...');
      
      const openaiRequest = openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: messageContent }],
        temperature: 0.1,
        max_tokens: 250, // Reduzido para resposta mais rápida
      });
      
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_OPENAI_30S')), 30000) // Reduzido para 30s
      );
      
      completion = await Promise.race([openaiRequest, timeout]) as any;
      
      const duration = Date.now() - startTime;
      console.log('[GEN-RESP] [AUDIT] Chamada OpenAI concluída em', duration, 'ms');
      
    } catch (openaiError: any) {
      const duration = Date.now() - startTime;
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Falha na chamada OpenAI após', duration, 'ms:', {
        error_message: openaiError.message,
        error_status: openaiError.status,
        error_code: openaiError.code,
        error_type: openaiError.constructor.name,
        item_id: itemId,
        field_type: field_type
      });
      
      // Enhanced error categorization for production
      if (openaiError.message?.includes('TIMEOUT_OPENAI_30S') || openaiError.message?.includes('timeout')) {
        throw new Error('Timeout: Reduza imagens ou aguarde alguns minutos');
      } else if (openaiError.status === 401 || openaiError.message?.includes('401')) {
        throw new Error('Chave OpenAI inválida - contacte administrador');
      } else if (openaiError.status === 429 || openaiError.message?.includes('429')) {
        throw new Error('Limite excedido - aguarde 2-3 minutos');
      } else if (openaiError.status === 400 || openaiError.message?.includes('400')) {
        throw new Error('Conteúdo inválido - reduza tamanho das imagens');
      } else if (openaiError.status === 500 || openaiError.message?.includes('500')) {
        throw new Error('Erro OpenAI interno - tente novamente em instantes');
      } else if (openaiError.message?.includes('ECONNRESET') || openaiError.message?.includes('ETIMEDOUT')) {
        throw new Error('Conexão perdida - verifique internet');
      } else {
        throw new Error(`Erro IA: ${openaiError.message?.substring(0, 100) || 'Falha comunicação'}`);
      }
    }
    
    console.log('[GEN-RESP] [AUDIT] Processando resposta da OpenAI...');
    
    // Detailed response analysis
    console.log('[GEN-RESP] [AUDIT] Completion object analysis:', {
      has_completion: !!completion,
      has_choices: !!completion?.choices,
      choices_count: completion?.choices?.length || 0,
      has_usage: !!completion?.usage,
      first_choice_exists: !!completion?.choices?.[0],
      has_message: !!completion?.choices?.[0]?.message,
      has_content: !!completion?.choices?.[0]?.message?.content
    });
    
    const response = completion?.choices?.[0]?.message?.content;
    console.log('[GEN-RESP] [AUDIT] Resposta extraída:', {
      has_response: !!response,
      response_length: response?.length || 0,
      response_preview: response?.substring(0, 150) + '...',
      is_empty_or_whitespace: !response || response.trim() === ''
    });
    
    if (!response || response.trim() === '') {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Resposta vazia da OpenAI:', {
        completion_choices: completion?.choices,
        completion_usage: completion?.usage,
        completion_id: completion?.id,
        item_id: itemId,
        field_type: field_type
      });
      throw new Error("Resposta vazia da OpenAI - tente novamente");
    }
    
    // Parse the response with enhanced error handling and fallbacks
    let responseData;
    let cleanResponse = response.trim();
    
    try {
      console.log('[GEN-RESP] [AUDIT] Tentando parse da resposta OpenAI...');
      
      // Enhanced cleaning for various markdown formats
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      
      // Remove any leading/trailing non-JSON text
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('[GEN-RESP] [AUDIT] Resposta limpa para parse:', {
        original_length: response.length,
        cleaned_length: cleanResponse.length,
        starts_with_brace: cleanResponse.startsWith('{'),
        ends_with_brace: cleanResponse.endsWith('}')
      });
      
      responseData = JSON.parse(cleanResponse);
      console.log('[GEN-RESP] [AUDIT] Parse JSON bem-sucedido:', responseData);
      
    } catch (parseError) {
      console.error('[GEN-RESP] [AUDIT] Falha no parse inicial:', parseError);
      
      // Tentativa de extração mais agressiva
      const jsonMatches = response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        let extractSuccess = false;
        
        for (const match of jsonMatches) {
          try {
            responseData = JSON.parse(match);
            console.log('[GEN-RESP] [AUDIT] JSON extraído com sucesso do match:', match.substring(0, 100));
            extractSuccess = true;
            break;
          } catch (extractError) {
            console.warn('[GEN-RESP] [AUDIT] Falha no match:', match.substring(0, 50));
          }
        }
        
        if (!extractSuccess) {
          throw new Error("Nenhum JSON válido encontrado na resposta");
        }
      } else {
        console.error('[GEN-RESP] [AUDIT] Resposta original completa:', response);
        throw new Error("Resposta não contém JSON válido");
      }
    }
    
    // Enhanced response validation with detailed logging
    console.log('[GEN-RESP] [AUDIT] Validando estrutura da resposta:', {
      is_object: typeof responseData === 'object',
      is_null: responseData === null,
      keys: responseData ? Object.keys(responseData) : [],
      has_generated_response: 'generated_response' in (responseData || {}),
      generated_response_value: responseData?.generated_response,
      generated_response_type: typeof responseData?.generated_response
    });
    
    if (!responseData || typeof responseData !== 'object' || responseData === null) {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Resposta inválida:', responseData);
      throw new Error("Resposta IA não é um objeto válido");
    }
    
    // Handle missing generated_response field
    if (!('generated_response' in responseData)) {
      console.warn('[GEN-RESP] [AUDIT] Campo generated_response ausente, criando fallback');
      responseData.generated_response = null;
    }
    
    // Validate and normalize response format based on field type
    try {
      if (field_type === 'boolean') {
        if (typeof responseData.generated_response === 'string') {
          responseData.generated_response = responseData.generated_response.toLowerCase() === 'true';
        } else if (typeof responseData.generated_response !== 'boolean') {
          responseData.generated_response = false; // Default to false for safety
        }
      } else if (field_type === 'number' || field_type === 'rating') {
        if (typeof responseData.generated_response === 'string') {
          const parsed = parseFloat(responseData.generated_response);
          responseData.generated_response = isNaN(parsed) ? 0 : parsed;
        } else if (typeof responseData.generated_response !== 'number') {
          responseData.generated_response = 0;
        }
        
        // Validate rating range
        if (field_type === 'rating') {
          responseData.generated_response = Math.max(1, Math.min(5, Math.round(responseData.generated_response)));
        }
      } else if ((field_type === 'select' || field_type === 'radio') && fieldOptions.length > 0) {
        // Validate if response is in valid options
        if (!fieldOptions.includes(responseData.generated_response)) {
          console.warn('Resposta IA não está nas opções válidas, usando primeira opção');
          responseData.generated_response = fieldOptions[0]; // Default to first option
        }
      } else if (field_type === 'multiselect') {
        if (!Array.isArray(responseData.generated_response)) {
          responseData.generated_response = [];
        }
      }
      
      // Ensure comment is string and within limits
      if (responseData.generated_comment && typeof responseData.generated_comment === 'string') {
        responseData.generated_comment = responseData.generated_comment.substring(0, 150);
      } else {
        responseData.generated_comment = null;
      }
      
      console.log('[GEN-RESP] [AUDIT] Dados de resposta validados:', {
        final_response: responseData.generated_response,
        final_response_type: typeof responseData.generated_response,
        final_comment: responseData.generated_comment,
        field_type: field_type,
        validation_success: true
      });
    } catch (validationError) {
      console.error('[GEN-RESP] [AUDIT] CRÍTICO: Erro validando dados:', validationError);
      throw new Error(`Falha validação: ${validationError instanceof Error ? validationError.message : 'Formato inválido'}`);
    }
    
    console.log('[GEN-RESP] [AUDIT] Resposta gerada com sucesso para item', itemId);
    
    return c.json({ 
      generated_response: responseData.generated_response,
      generated_comment: responseData.generated_comment,
      success: true,
      message: "Resposta gerada com sucesso pela IA multimodal",
      debug_info: {
        item_id: itemId,
        field_type: field_type,
        processing_time_ms: Date.now() - startTime,
        has_images: imageProcessed > 0,
        image_count: imageProcessed
      }
    });
    
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error('[GEN-RESP] [AUDIT] CRÍTICO: Erro na geração de resposta após', errorDuration, 'ms:', error);
    
    // Comprehensive error logging for production debugging
    if (error instanceof Error) {
      console.error('[GEN-RESP] [AUDIT] Detalhes completos do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 300) + '...',
        cause: (error as any).cause || 'N/A',
        item_id: itemId,
        field_type: body?.field_type,
        field_name: body?.field_name?.substring(0, 30),
        has_openai_key: !!env.OPENAI_API_KEY,
        openai_key_length: env.OPENAI_API_KEY?.length || 0
      });
    }
    
    // Enhanced error categorization for production reliability
    let errorMessage = "Falha ao gerar resposta de campo";
    let errorDetails = "Erro interno do servidor";
    let httpStatus = 500;
    let helpMessage = "Tente novamente ou crie a resposta manualmente";
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      errorDetails = error.message;
      
      if (errorMsg.includes('timeout') || errorMsg.includes('etimedout') || errorMsg.includes('econnreset')) {
        errorMessage = "Timeout na geração - conexão muito lenta";
        httpStatus = 408;
        helpMessage = "Verifique sua conexão e tente com menos imagens";
      } else if (errorMsg.includes('parsing request body') || errorMsg.includes('request body')) {
        errorMessage = "Erro no processamento da requisição";
        httpStatus = 400;
        helpMessage = "Dados da requisição inválidos";
      } else if (errorMsg.includes('openai') || errorMsg.includes('api') || errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
        errorMessage = "Problema com serviço de IA";
        httpStatus = 502;
        helpMessage = "Serviço temporariamente indisponível";
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('limite')) {
        errorMessage = "Muitas requisições - aguarde";
        httpStatus = 429;
        helpMessage = "Aguarde 2-3 minutos antes de tentar novamente";
      } else if (errorMsg.includes('400') || errorMsg.includes('conteúdo inválido')) {
        errorMessage = "Conteúdo muito grande ou inválido";
        httpStatus = 400;
        helpMessage = "Reduza o tamanho das imagens";
      } else if (errorMsg.includes('500') || errorMsg.includes('internal')) {
        errorMessage = "Erro interno do serviço de IA";
        httpStatus = 502;
        helpMessage = "Tente novamente em alguns instantes";
      } else if (errorMsg.includes('json') || errorMsg.includes('parse') || errorMsg.includes('resposta')) {
        errorMessage = "Erro no processamento da resposta";
        httpStatus = 500;
        helpMessage = "Resposta da IA inválida - tente novamente";
      } else if (errorMsg.includes('not found') || errorMsg.includes('item')) {
        errorMessage = "Item não encontrado";
        httpStatus = 404;
        helpMessage = "Verifique se o item ainda existe";
      } else if (errorMsg.includes('conexão') || errorMsg.includes('network')) {
        errorMessage = "Erro de conexão";
        httpStatus = 503;
        helpMessage = "Verifique sua internet";
      }
    }
    
    // Final error context logging
    console.error('[GEN-RESP] [AUDIT] Contexto final do erro:', {
      itemId,
      fieldName: body?.field_name?.substring(0, 50) || 'desconhecido',
      fieldType: body?.field_type || 'desconhecido',
      hasMediaData: !!(body?.media_data && Array.isArray(body.media_data)),
      mediaCount: body?.media_data?.length || 0,
      currentResponse: typeof body?.current_response,
      processingDuration: errorDuration,
      finalErrorMessage: errorMessage,
      httpStatus,
      timestamp: new Date().toISOString()
    });
    
    return c.json({ 
      success: false,
      error: errorMessage, 
      details: errorDetails,
      help: helpMessage,
      debug_info: {
        item_id: itemId,
        field_name: body?.field_name || 'desconhecido',
        field_type: body?.field_type || 'desconhecido',
        error_code: `GEN_RESP_${httpStatus}`,
        processing_duration_ms: errorDuration,
        has_media: !!(body?.media_data && Array.isArray(body.media_data)),
        media_count: body?.media_data?.length || 0,
        timestamp: new Date().toISOString()
      }
    }, httpStatus as any);
  }
});

// CNPJ lookup endpoint
app.get("/api/cnpj/*", async (c) => {
  // Get the full path after /api/cnpj/ to handle CNPJs with slashes
  const fullPath = c.req.url.split('/api/cnpj/')[1];
  if (!fullPath) {
    return c.json({ error: "CNPJ não fornecido" }, 400);
  }
  
  const cnpj = fullPath.replace(/\D/g, ''); // Remove non-numeric characters
  
  if (cnpj.length !== 14) {
    return c.json({ error: "CNPJ deve ter 14 dígitos" }, 400);
  }
  
  try {
    // Try ReceitaWS API first (free service)
    let response = await (globalThis as any).fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: {
        'User-Agent': 'COMPIA-SafetyInspector/1.0'
      }
    });
    
    if (!response.ok) {
      // Fallback to another service if ReceitaWS fails
      response = await (globalThis as any).fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
        headers: {
          'User-Agent': 'COMPIA-SafetyInspector/1.0'
        }
      });
    }
    
    const data = await response.json() as any;
    
    if (data.status === 'ERROR' || data.message) {
      return c.json({ error: data.message || "CNPJ não encontrado" }, 404);
    }
    
    // Normalize data from different APIs
    const normalizedData = {
      cnpj: data.cnpj || cnpj,
      razao_social: data.nome || data.company?.name || data.razao_social,
      nome_fantasia: data.fantasia || data.company?.alias || data.nome_fantasia,
      cnae_principal: data.atividade_principal?.[0]?.code || data.primary_activity?.id || data.cnae_principal,
      cnae_descricao: data.atividade_principal?.[0]?.text || data.primary_activity?.text || data.cnae_descricao,
      natureza_juridica: data.natureza_juridica || data.legal_nature?.text || data.natureza_juridica,
      data_abertura: data.abertura || data.founded || data.data_abertura,
      capital_social: data.capital_social || data.equity || data.capital_social,
      porte_empresa: data.porte || data.size?.text || data.porte_empresa,
      situacao_cadastral: data.situacao || data.status?.text || data.situacao_cadastral,
      endereco: {
        logradouro: data.logradouro || data.address?.street || data.endereco?.logradouro,
        numero: data.numero || data.address?.number || data.endereco?.numero,
        complemento: data.complemento || data.address?.details || data.endereco?.complemento,
        bairro: data.bairro || data.address?.district || data.endereco?.bairro,
        municipio: data.municipio || data.address?.city || data.endereco?.municipio,
        uf: data.uf || data.address?.state || data.endereco?.uf,
        cep: data.cep || data.address?.zip || data.endereco?.cep
      },
      telefone: data.telefone || data.phone || data.contato?.telefone,
      email: data.email || data.email || data.contato?.email,
      website: data.website || data.site || data.website
    };
    
    // Build formatted address
    const enderecoCompleto = [
      normalizedData.endereco.logradouro,
      normalizedData.endereco.numero,
      normalizedData.endereco.complemento,
      normalizedData.endereco.bairro,
      normalizedData.endereco.municipio,
      normalizedData.endereco.uf
    ].filter(Boolean).join(', ');
    
    return c.json({
      ...normalizedData,
      endereco_completo: enderecoCompleto
    });
  } catch (error) {
    console.error('Error fetching CNPJ data:', error);
    return c.json({ error: "Falha ao buscar dados do CNPJ. Tente novamente." }, 500);
  }
});

// CEP lookup endpoint
app.get("/api/cep/:cep", async (c) => {
  const cep = c.req.param("cep");
  
  try {
    const cepResponse = await (globalThis as any).fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const cepData = await cepResponse.json() as any;
    
    if (cepData.erro) {
      return c.json({ error: "CEP not found" }, 404);
    }
    
    const address = `${cepData.logradouro}, ${cepData.bairro}, ${cepData.localidade} - ${cepData.uf}`;
    
    return c.json({ address });
  } catch (error) {
    console.error('Error fetching CEP:', error);
    return c.json({ error: "Failed to fetch CEP data" }, 500);
  }
});

// Get invitation details (public endpoint)
app.get("/api/invitations/:token/details", async (c) => {
  const env = c.env;
  const token = c.req.param("token");
  
  try {
    // Find invitation
    const invitation = await env.DB.prepare(`
      SELECT ui.*, o.name as organization_name, u.name as inviter_name
      FROM user_invitations ui
      LEFT JOIN organizations o ON ui.organization_id = o.id
      LEFT JOIN users u ON ui.invited_by = u.id
      WHERE ui.invitation_token = ? AND ui.accepted_at IS NULL AND ui.expires_at > datetime('now')
    `).bind(token).first() as any;
    
    if (!invitation) {
      return c.json({ error: "Invalid or expired invitation." }, 404);
    }
    
    return c.json({ 
      invitation: {
        email: invitation.email,
        organization_id: invitation.organization_id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        expires_at: invitation.expires_at,
        organization_name: invitation.organization_name,
        inviter_name: invitation.inviter_name
      }
    });
    
  } catch (error) {
    console.error('Error fetching invitation details:', error);
    return c.json({ error: "Failed to fetch invitation details." }, 500);
  }
});

// Accept invitation (public endpoint with auth)
app.post("/api/invitations/:token/accept", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  const token = c.req.param("token");
  
  try {
    // Find invitation
    const invitation = await env.DB.prepare(`
      SELECT * FROM user_invitations 
      WHERE invitation_token = ? AND accepted_at IS NULL AND expires_at > datetime('now')
    `).bind(token).first() as any;
    
    if (!invitation) {
      return c.json({ error: "Invalid or expired invitation." }, 404);
    }
    
    // Check if user email matches invitation
    if (!user || user.email !== invitation.email) {
      return c.json({ error: "The email you are logged in with does not match the invitation email. Please log in with the correct email." }, 400);
    }
    
    // Update or create user profile
    const existingUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    if (existingUser) {
      // Update existing user
      await env.DB.prepare(`
        UPDATE users 
        SET organization_id = ?, role = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(invitation.organization_id, invitation.role, user.id).run();
    } else {
      // Create new user profile
      const canManageUsers = invitation.role === USER_ROLES.ORG_ADMIN;
      const canCreateOrgs = invitation.role === USER_ROLES.ORG_ADMIN;
      const managedOrgId = invitation.role === USER_ROLES.ORG_ADMIN ? invitation.organization_id : null;
      
      await env.DB.prepare(`
        INSERT INTO users (
          id, email, name, role, organization_id, can_manage_users, 
          can_create_organizations, managed_organization_id, is_active, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        user.id,
        user.email,
        user.google_user_data?.name || user.email,
        invitation.role,
        invitation.organization_id,
        canManageUsers,
        canCreateOrgs,
        managedOrgId,
        true
      ).run();
    }
    
    // Mark invitation as accepted
    await env.DB.prepare(`
      UPDATE user_invitations 
      SET accepted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(invitation.id).run();
    
    // Log activity
    if (user) {
      await env.DB.prepare(`
        INSERT INTO activity_log (user_id, organization_id, action_type, action_description, target_type, target_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        invitation.organization_id,
        'invitation_accepted',
        `Accepted invitation with role: ${invitation.role}`,
        'invitation',
        invitation.id.toString()
      ).run();
    }
    
    return c.json({ 
      message: "Invitation accepted successfully.",
      role: invitation.role,
      organization_id: invitation.organization_id
    });
    
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({ error: "Failed to accept invitation." }, 500);
  }
});

// Admin data export endpoint for dev sync (SYSTEM_ADMIN only)
app.get("/api/admin/export-all-data", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile - MUST be SYSTEM_ADMIN
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    if (!userProfile || userProfile.role !== USER_ROLES.SYSTEM_ADMIN) {
      return c.json({ error: "Only SYSTEM_ADMIN can export all data" }, 403);
    }
    
    console.log(`[EXPORT-ALL] SYSTEM_ADMIN ${user.email} requesting full data export`);
    
    // Export ALL data without any filters - ADMIN BYPASS MODE
    const [
      inspections,
      inspectionItems,
      actionItems,
      checklistTemplates,
      checklistFields,
      organizations,
      users,
      inspectionMedia,
      aiAssistants
    ] = await Promise.all([
      env.DB.prepare("SELECT * FROM inspections ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT * FROM inspection_items ORDER BY inspection_id, id").all(),
      env.DB.prepare("SELECT * FROM action_items ORDER BY inspection_id, id").all(),
      env.DB.prepare("SELECT * FROM checklist_templates ORDER BY id").all(),
      env.DB.prepare("SELECT * FROM checklist_fields ORDER BY template_id, order_index").all(),
      env.DB.prepare("SELECT * FROM organizations ORDER BY id").all(),
      env.DB.prepare("SELECT * FROM users ORDER BY created_at").all(),
      env.DB.prepare("SELECT * FROM inspection_media ORDER BY inspection_id, id").all(),
      env.DB.prepare("SELECT * FROM ai_assistants WHERE is_active = true ORDER BY id").all()
    ]);
    
    const exportData = {
      timestamp: new Date().toISOString(),
      exported_by: user.email,
      total_counts: {
        inspections: inspections.results?.length || 0,
        inspection_items: inspectionItems.results?.length || 0,
        action_items: actionItems.results?.length || 0,
        checklist_templates: checklistTemplates.results?.length || 0,
        checklist_fields: checklistFields.results?.length || 0,
        organizations: organizations.results?.length || 0,
        users: users.results?.length || 0,
        inspection_media: inspectionMedia.results?.length || 0,
        ai_assistants: aiAssistants.results?.length || 0
      },
      data: {
        inspections: inspections.results || [],
        inspection_items: inspectionItems.results || [],
        action_items: actionItems.results || [],
        checklist_templates: checklistTemplates.results || [],
        checklist_fields: checklistFields.results || [],
        organizations: organizations.results || [],
        users: users.results || [],
        inspection_media: inspectionMedia.results || [],
        ai_assistants: aiAssistants.results || []
      }
    };
    
    console.log(`[EXPORT-ALL] Export completed:`, exportData.total_counts);
    
    return c.json(exportData);
    
  } catch (error) {
    console.error('[EXPORT-ALL] Error exporting data:', error);
    return c.json({ error: "Failed to export data" }, 500);
  }
});

// Admin bypass for viewing ALL inspections (SYSTEM_ADMIN only)
app.get("/api/admin/inspections-all", authMiddleware, async (c) => {
  const env = c.env;
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  try {
    // Get user profile - MUST be SYSTEM_ADMIN
    const userProfile = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first() as any;
    
    if (!userProfile || userProfile.role !== USER_ROLES.SYSTEM_ADMIN) {
      return c.json({ error: "Only SYSTEM_ADMIN can view all inspections without filters" }, 403);
    }
    
    console.log(`[ADMIN-ALL-INSPECTIONS] SYSTEM_ADMIN ${user.email} requesting ALL inspections bypass`);
    
    // BYPASS ALL FILTERS - show absolutely everything
    const inspections = await env.DB.prepare(`
      SELECT i.*, u.name as creator_name, o.name as organization_name
      FROM inspections i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN organizations o ON i.organization_id = o.id
      ORDER BY i.created_at DESC
    `).all();
    
    console.log(`[ADMIN-ALL-INSPECTIONS] Found ${inspections.results?.length || 0} total inspections`);
    
    return c.json({ 
      inspections: inspections.results || [],
      total_count: inspections.results?.length || 0,
      admin_bypass: true,
      note: "SYSTEM_ADMIN bypass - all filters disabled"
    });
    
  } catch (error) {
    console.error('[ADMIN-ALL-INSPECTIONS] Error fetching all inspections:', error);
    return c.json({ inspections: [] });
  }
});

// Health check endpoint
app.get("/api/health", async (c) => {
  const hasOpenAI = !!c.env.OPENAI_API_KEY;
  const hasAuth = !!(c.env.MOCHA_USERS_SERVICE_API_KEY && c.env.MOCHA_USERS_SERVICE_API_URL);
  const hasDB = !!c.env.DB;
  
  return c.json({ 
    status: (hasOpenAI && hasAuth && hasDB) ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    service: "COMPIA Safety Inspector API",
    features: {
      ai_enabled: hasOpenAI,
      auth_enabled: hasAuth,
      database_enabled: hasDB
    },
    version: "2.0.0",
    build_timestamp: "2025-08-25T18:57:00Z",
    deployment_test: "ACTIVE_VERSION_SYNC_TEST_OK"
  });
});

// Test endpoint for deployment verification
app.get("/api/deployment-test", async (c) => {
  return c.json({
    message: "Teste de sincronização de deployment funcionando!",
    timestamp: new Date().toISOString(),
    environment: "unified", 
    test_id: "SYNC_TEST_2025_08_25_1857",
    features_working: {
      ai_analysis: !!c.env.OPENAI_API_KEY,
      action_plans: true,
      filters: true,
      scheduling: true,
      database: !!c.env.DB
    },
    note: "Se você está vendo esta mensagem em produção, a sincronização está funcionando corretamente!"
  });
});

// 404 handler for unmatched routes
app.notFound((c) => {
  return c.json({ error: "Endpoint not found" }, 404);
});

// Error handler
app.onError((error, c) => {
  console.error('Global error handler:', error);
  return c.json({ 
    error: "Internal server error",
    message: error.message 
  }, 500);
});

// Default export for Cloudflare Worker
export default app;
