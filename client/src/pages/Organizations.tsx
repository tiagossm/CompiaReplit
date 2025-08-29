import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, Plus, Settings, BarChart3, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import type { Organization, User, ActivityLog } from "@/lib/types";
import OrganizationHierarchy from "@/components/Organizations/OrganizationHierarchy";
import InviteUserDialog from "@/components/Organizations/InviteUserDialog";

export default function Organizations() {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users', { organizationId: selectedOrg }],
    enabled: !!selectedOrg
  });

  const { data: activityLogs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs', { organizationId: selectedOrg }],
    enabled: !!selectedOrg
  });

  const currentOrg = selectedOrg 
    ? organizations?.find(org => org.id === selectedOrg)
    : organizations?.find(org => org.id === user.organizationId);

  const canManageOrgs = hasPermission(user, 'manage_organization');
  const canInviteUsers = hasPermission(user, 'invite_user');

  return (
    <div className="p-6 space-y-6" data-testid="organizations-page">
      {user.role === 'system_admin' && (
        <OrganizationHierarchy />
      )}

      {/* Organization Details */}
      {currentOrg && (
        <Card data-testid="organization-details">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-compia-blue to-compia-purple rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl" data-testid="org-details-name">
                    {currentOrg.name}
                  </CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className="bg-compia-blue/10 text-compia-blue" data-testid="org-type">
                      {currentOrg.type === 'master' ? 'Master' : 
                       currentOrg.type === 'enterprise' ? 'Empresa' : 'Subsidiária'}
                    </Badge>
                    {currentOrg.plan && (
                      <Badge className="bg-compia-green/10 text-compia-green" data-testid="org-plan">
                        {currentOrg.plan.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {canManageOrgs && (
                <Button variant="outline" data-testid="org-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Organization Tabs */}
      <Tabs defaultValue="overview" className="space-y-6" data-testid="org-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="w-4 h-4 mr-2" />
            Atividades
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings" disabled={!canManageOrgs}>
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" data-testid="overview-content">
          {currentOrg && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-compia-blue/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-compia-blue" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                      <p className="text-2xl font-bold" data-testid="active-users-count">
                        {users?.filter(u => u.isActive).length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-compia-green/10 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-compia-green" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Limite de Usuários</p>
                      <p className="text-2xl font-bold" data-testid="user-limit">
                        {currentOrg.maxUsers}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-compia-purple/10 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-compia-purple" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Subsidiárias</p>
                      <p className="text-2xl font-bold" data-testid="subsidiaries-count">
                        {organizations?.filter(org => org.parentId === currentOrg.id).length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="text-sm font-medium" data-testid="org-status">
                        <Badge className={currentOrg.isActive ? "bg-compia-green/10 text-compia-green" : "bg-destructive/10 text-destructive"}>
                          {currentOrg.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6" data-testid="users-content">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários da Organização</CardTitle>
                {canInviteUsers && (
                  <InviteUserDialog organizationId={currentOrg?.id} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="animate-pulse space-y-4" data-testid="users-loading">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded"></div>
                  ))}
                </div>
              ) : !users || users.length === 0 ? (
                <div className="text-center py-8" data-testid="no-users">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                  {canInviteUsers && (
                    <InviteUserDialog 
                      organizationId={currentOrg?.id}
                      trigger={
                        <Button className="mt-4 bg-compia-blue hover:bg-compia-blue/90" data-testid="invite-first-user">
                          <Plus className="w-4 h-4 mr-2" />
                          Convidar Primeiro Usuário
                        </Button>
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="w-full" data-testid="users-table">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Nome</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Perfil</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Último Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-muted/50" data-testid={`user-row-${userItem.id}`}>
                          <td className="py-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-compia-blue/10 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-compia-blue">
                                  {userItem.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <span className="font-medium" data-testid={`user-name-${userItem.id}`}>
                                {userItem.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground" data-testid={`user-email-${userItem.id}`}>
                            {userItem.email}
                          </td>
                          <td className="py-3" data-testid={`user-role-${userItem.id}`}>
                            <Badge className="bg-muted text-muted-foreground">
                              {userItem.role === 'org_admin' ? 'Admin Org' :
                               userItem.role === 'manager' ? 'Gerente' :
                               userItem.role === 'inspector' ? 'Técnico' :
                               userItem.role === 'client' ? 'Cliente' : userItem.role}
                            </Badge>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6" data-testid="activity-content">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="animate-pulse space-y-4" data-testid="activity-loading">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : !activityLogs || activityLogs.length === 0 ? (
                <div className="text-center py-8" data-testid="no-activity">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma atividade recente</p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="activity-list">
                  {activityLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg"
                      data-testid={`activity-${log.id}`}
                    >
                      <div className="w-2 h-2 bg-compia-blue rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground" data-testid={`activity-action-${log.id}`}>
                          {log.action === 'create_inspection' ? 'Criou uma inspeção' :
                           log.action === 'invite_user' ? 'Convidou um usuário' :
                           log.action === 'create_organization' ? 'Criou uma organização' :
                           log.action === 'accept_invitation' ? 'Aceitou um convite' :
                           log.action}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`activity-time-${log.id}`}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : 'Data não informada'}
                        </p>
                        {log.details && (
                          <div className="text-xs text-muted-foreground mt-1" data-testid={`activity-details-${log.id}`}>
                            {typeof log.details === 'object' && log.details !== null
                              ? JSON.stringify(log.details) 
                              : (log.details as React.ReactNode) || ''
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6" data-testid="settings-content">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Organização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-4" />
                <p>Configurações em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
