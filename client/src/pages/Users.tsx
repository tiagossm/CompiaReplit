import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Filter, Users as UsersIcon, UserPlus, Mail, Settings, 
  MoreVertical, Eye, Edit, Trash2, Shield, Clock, CheckCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import type { User, UserWithOrganization, Invitation, InvitationWithDetails } from "@/lib/types";
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
      const response = await apiRequest('PATCH', `/api/users/${userId}`, updates);
      return response.json();
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
      const response = await apiRequest('DELETE', `/api/invitations/${invitationId}`);
      return response.json();
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
      await apiRequest('POST', `/api/invitations/${invitationId}/resend`);
      toast({
        title: "Convite reenviado!",
        description: "O convite foi enviado novamente por email",
      });
    } catch (error) {
      toast({
        title: "Erro ao reenviar convite",
        description: (error as Error).message,
        variant: "destructive"
      });
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
      <Card data-testid="users-header">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 flex space-x-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-users"
                />
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-role">
                  <SelectValue placeholder="Perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {user.role === 'system_admin' && (
                    <SelectItem value="org_admin">Admin Org</SelectItem>
                  )}
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="inspector">Técnico</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>

              {user.role === 'system_admin' && (
                <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                  <SelectTrigger className="w-[180px]" data-testid="filter-organization">
                    <SelectValue placeholder="Organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {organizations?.map((org: any) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {canInviteUsers && (
              <InviteUserDialog 
                organizationId={selectedOrganization !== "all" ? selectedOrganization : user.organizationId || undefined}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Management Tabs */}
      <Tabs defaultValue="users" className="space-y-6" data-testid="users-tabs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" data-testid="tab-users">
            <UsersIcon className="w-4 h-4 mr-2" />
            Usuários ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            <Mail className="w-4 h-4 mr-2" />
            Convites ({filteredInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6" data-testid="users-content">
          {filteredUsers.length === 0 ? (
            <Card data-testid="no-users">
              <CardContent className="p-12 text-center">
                <UsersIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchTerm || roleFilter !== "all" || statusFilter !== "all"
                    ? "Nenhum usuário encontrado" 
                    : "Nenhum usuário cadastrado"
                  }
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || roleFilter !== "all" || statusFilter !== "all"
                    ? "Tente ajustar os filtros de pesquisa"
                    : "Comece convidando usuários para sua organização"
                  }
                </p>
                {canInviteUsers && !searchTerm && roleFilter === "all" && statusFilter === "all" && (
                  <InviteUserDialog 
                    organizationId={selectedOrganization !== "all" ? selectedOrganization : user.organizationId || undefined}
                    trigger={
                      <Button className="bg-compia-blue hover:bg-compia-blue/90" data-testid="invite-first-user">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Convidar Primeiro Usuário
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card data-testid="users-table-card">
              <CardHeader>
                <CardTitle>Usuários Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden">
                  <table className="w-full" data-testid="users-table">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Usuário</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Perfil</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Último Acesso</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-muted/50" data-testid={`user-row-${userItem.id}`}>
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-compia-blue/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-compia-blue">
                                  {userItem.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-foreground" data-testid={`user-name-${userItem.id}`}>
                                  {userItem.name}
                                </p>
                                {user.role === 'system_admin' && userItem.organization && (
                                  <p className="text-xs text-muted-foreground">
                                    {userItem.organization.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground" data-testid={`user-email-${userItem.id}`}>
                            {userItem.email}
                          </td>
                          <td className="py-3" data-testid={`user-role-${userItem.id}`}>
                            <div className="flex items-center space-x-2">
                              {getRoleIcon(userItem.role)}
                              <Badge className={getRoleBadgeColor(userItem.role)}>
                                {ROLE_LABELS[userItem.role as keyof typeof ROLE_LABELS]}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-3" data-testid={`user-status-${userItem.id}`}>
                            <Badge className={userItem.isActive ? "bg-compia-green/10 text-compia-green" : "bg-destructive/10 text-destructive"}>
                              {userItem.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground" data-testid={`user-last-login-${userItem.id}`}>
                            {userItem.lastLoginAt 
                              ? new Date(userItem.lastLoginAt).toLocaleDateString('pt-BR')
                              : "Nunca"
                            }
                          </td>
                          <td className="py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-muted-foreground hover:text-foreground"
                                  data-testid={`user-actions-${userItem.id}`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {/* View user details */}}
                                  data-testid={`view-user-${userItem.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                {canManageUsers && userItem.id !== user.id && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => toggleUserStatus(userItem.id, userItem.isActive)}
                                      data-testid={`toggle-user-${userItem.id}`}
                                    >
                                      {userItem.isActive ? (
                                        <>
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Desativar
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          Ativar
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {/* Edit user */}}
                                      data-testid={`edit-user-${userItem.id}`}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6" data-testid="invitations-content">
          {filteredInvitations.length === 0 ? (
            <Card data-testid="no-invitations">
              <CardContent className="p-12 text-center">
                <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchTerm || roleFilter !== "all"
                    ? "Nenhum convite encontrado" 
                    : "Nenhum convite pendente"
                  }
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || roleFilter !== "all"
                    ? "Tente ajustar os filtros de pesquisa"
                    : "Todos os convites foram aceitos ou não há convites ativos"
                  }
                </p>
                {canInviteUsers && !searchTerm && roleFilter === "all" && (
                  <InviteUserDialog 
                    organizationId={selectedOrganization !== "all" ? selectedOrganization : user.organizationId || undefined}
                    trigger={
                      <Button className="bg-compia-blue hover:bg-compia-blue/90" data-testid="send-new-invitation">
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Novo Convite
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card data-testid="invitations-table-card">
              <CardHeader>
                <CardTitle>Convites Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden">
                  <table className="w-full" data-testid="invitations-table">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Perfil</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Convidado por</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Data</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredInvitations.map((invitation) => {
                        const isExpired = new Date(invitation.expiresAt) < new Date();
                        
                        return (
                          <tr key={invitation.id} className="hover:bg-muted/50" data-testid={`invitation-row-${invitation.id}`}>
                            <td className="py-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-compia-purple/10 rounded-full flex items-center justify-center">
                                  <Mail className="w-4 h-4 text-compia-purple" />
                                </div>
                                <span className="font-medium text-foreground" data-testid={`invitation-email-${invitation.id}`}>
                                  {invitation.email}
                                </span>
                              </div>
                            </td>
                            <td className="py-3" data-testid={`invitation-role-${invitation.id}`}>
                              <div className="flex items-center space-x-2">
                                {getRoleIcon(invitation.role)}
                                <Badge className={getRoleBadgeColor(invitation.role)}>
                                  {ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS]}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-3 text-sm text-muted-foreground" data-testid={`invitation-invited-by-${invitation.id}`}>
                              {invitation.invitedByUser?.name || "Sistema"}
                            </td>
                            <td className="py-3 text-sm text-muted-foreground" data-testid={`invitation-date-${invitation.id}`}>
                              {new Date(invitation.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-3" data-testid={`invitation-status-${invitation.id}`}>
                              <Badge className={isExpired ? "bg-destructive/10 text-destructive" : "bg-yellow-100 text-yellow-800"}>
                                {isExpired ? "Expirado" : "Pendente"}
                              </Badge>
                            </td>
                            <td className="py-3">
                              <div className="flex space-x-2">
                                {!isExpired && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resendInvitation(invitation.id)}
                                    className="text-compia-blue hover:text-compia-blue/80"
                                    data-testid={`resend-invitation-${invitation.id}`}
                                  >
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                )}
                                {canManageUsers && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                                    className="text-destructive hover:text-destructive/80"
                                    data-testid={`cancel-invitation-${invitation.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
