import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['/api/user/me'],
    retry: false
  });

  // Mock user for development - in production this would come from real auth
  const mockUser: User = {
    id: "admin-id",
    email: "admin@iasst.com",
    name: "System Administrator",
    role: "system_admin",
    organizationId: "master-org-id",
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return {
    user: user || mockUser,
    isLoading,
    error,
    isAuthenticated: !!(user || mockUser)
  };
}

export function hasPermission(user: User, permission: string): boolean {
  switch (permission) {
    case "view_dashboard":
      return true;
    case "create_organization":
      return user.role === "system_admin";
    case "manage_organization":
      return user.role === "system_admin" || user.role === "org_admin";
    case "invite_user":
      return user.role === "system_admin" || user.role === "org_admin";
    case "create_inspection":
      return user.role !== "client";
    case "manage_action_plans":
      return user.role !== "client";
    case "view_reports":
      return true;
    case "export_data":
      return user.role !== "client";
    case "system_admin":
      return user.role === "system_admin";
    default:
      return false;
  }
}
