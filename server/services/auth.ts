import { storage } from "../storage";
import type { User } from "@shared/schema";

export interface AuthContext {
  user: User;
  organization: any;
  hasPermission: (permission: string, resourceId?: string) => boolean;
}

export async function authenticateUser(email: string): Promise<User | null> {
  const user = await storage.getUserByEmail(email);
  return user || null;
}

export function hasPermission(user: User, permission: string, resourceId?: string): boolean {
  const { role, organizationId } = user;

  switch (permission) {
    case "view_dashboard":
      return true; // All users can view dashboard

    case "create_organization":
      return role === "system_admin";

    case "manage_organization":
      return role === "system_admin" || role === "org_admin";

    case "invite_user":
      return role === "system_admin" || role === "org_admin";

    case "create_inspection":
      return role !== "client";

    case "edit_inspection":
      // Can edit if inspector of the inspection or admin
      return role === "system_admin" || role === "org_admin" || role === "inspector";

    case "view_inspection":
      // Can view if same organization or admin
      return role === "system_admin" || role === "org_admin" || 
             (resourceId && user.organizationId === resourceId);

    case "delete_inspection":
      return role === "system_admin" || role === "org_admin";

    case "manage_action_plans":
      return role !== "client";

    case "view_reports":
      return true; // All users can view reports for their organization

    case "export_data":
      return role !== "client";

    case "system_admin":
      return role === "system_admin";

    default:
      return false;
  }
}

export async function getOrganizationHierarchy(organizationId: string): Promise<string[]> {
  const organizations: string[] = [organizationId];
  
  // Get all child organizations recursively
  async function getChildren(parentId: string) {
    const children = await storage.getOrganizationsByParent(parentId);
    for (const child of children) {
      organizations.push(child.id);
      await getChildren(child.id);
    }
  }
  
  await getChildren(organizationId);
  return organizations;
}

export function canAccessOrganization(user: User, targetOrgId: string): boolean {
  if (user.role === "system_admin") {
    return true; // System admin can access all organizations
  }
  
  return user.organizationId === targetOrgId && user.isActive !== false;
}

export async function filterByOrganizationAccess<T extends { organizationId: string }>(
  user: User,
  items: T[]
): Promise<T[]> {
  if (user.role === "system_admin") {
    return items; // System admin sees everything
  }

  // Get accessible organization IDs
  const accessibleOrgs = await getOrganizationHierarchy(user.organizationId!);
  
  return items.filter(item => accessibleOrgs.includes(item.organizationId));
}
