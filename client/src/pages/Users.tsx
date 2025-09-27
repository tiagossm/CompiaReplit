import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Users as UsersIcon, UserPlus, Mail, 
  MoreVertical, Eye, Edit, Trash2, Shield, CheckCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import type { User, UserWithOrganization, InvitationWithDetails } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";
import InviteUserDialog from "@/components/Organizations/InviteUserDialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrganization, setSelectedOrganization] = useState<string>(
    user.role === 'system_admin' ? "all" : user.organizationId || ""
  );

  const { data: users, isLoading: usersLoading } = useQuery<UserWithOrganization[]>({
    queryKey: ['/api/users', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<InvitationWithDetails[]>({
    queryKey: ['/api/invitations', { organizationId: selectedOrganization !== "all" ? selectedOrganization : undefined }],
  });

  const { data: organizations } = useQuery({
    queryKey: ['/api/organizations'],
    enabled: user.role === 'system_admin'
  });

  const canInviteUsers = hasPermission(user, 'invite_user');
  const canManageUsers = hasPermission(user, 'manage_organization') || user.role === 'system_admin';

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<User> }) => {
      return apiRequest(`/api/users/${userId}`, 'PATCH', updates);
    },
    onSuccess: (updatedUser) => {
      toast({
        title: "Usuário atualizado!",
        description: `${updatedUser.name} foi atualizado com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest(`/api/invitations/${invitationId}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Convite cancelado!",
        description: "O convite foi removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao cancelar convite",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const filteredUsers = (users || []).filter(userItem => {
    const matchesSearch = userItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userItem.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || userItem.role === roleFilter;
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && userItem.isActive) ||
                         (statusFilter === "inactive" && !userItem.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredInvitations = (invitations || []).filter(invitation => {
    const matchesSearch = invitation.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || invitation.role === roleFilter;
    return matchesSearch && matchesRole && !invitation.isAccepted;
  });

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    updateUserMutation.mutate({
      userId,
      updates: { isActive: !currentStatus }
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'system_admin':
        return <Shield className="w-4 h-4 text-destructive" />;
      case 'org_admin':
        return <Shield className="w-4 h-4 text-compia-blue" />;
      case 'manager':
        return <UsersIcon className="w-4 h-4 text-compia-purple" />;
      case 'inspector':
        return <CheckCircle className="w-4 h-4 text-compia-green" />;
      default:
        return <Eye className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'system_admin':
        return "bg-destructive/10 text-destructive";
      case 'org_admin':
        return "bg-compia-blue/10 text-compia-blue";
      case 'manager':
        return "bg-compia-purple/10 text-compia-purple";
      case 'inspector':
        return "bg-compia-green/10 text-compia-green";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      const result = await apiRequest(`/api/invitations/${invitationId}/resend`, 'POST');
      toast({
        title: "Convite reenviado!",
        description: "O convite foi enviado novamente por email",
      });
      return result;
    } catch (error) {
      toast({
        title: "Erro ao reenviar convite",
        description: (error as Error).message,
        variant: "destructive"
      });
      throw error;
    }
  };

  if (usersLoading || invitationsLoading) {
    return (
      <div className="p-6" data-testid="users-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="users-page">
      {/* Header with Search and Filters */}
      {/* ... resto do componente permanece igual */}
    </div>
  );
}