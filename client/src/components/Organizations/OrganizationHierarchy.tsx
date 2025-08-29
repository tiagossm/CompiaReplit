import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, Plus, Users, Settings, MoreVertical, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Organization } from "@/lib/types";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import NewOrganizationModal from "./NewOrganizationModal";

interface OrganizationNode extends Organization {
  children?: OrganizationNode[];
  level: number;
}

export default function OrganizationHierarchy() {
  const { user } = useAuth();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  
  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const buildHierarchy = (orgs: Organization[]): OrganizationNode[] => {
    const orgMap = new Map<string, OrganizationNode>();
    const rootNodes: OrganizationNode[] = [];

    // Create all nodes
    orgs.forEach(org => {
      orgMap.set(org.id, { ...org, children: [], level: 0 });
    });

    // Build parent-child relationships
    orgs.forEach(org => {
      const node = orgMap.get(org.id)!;
      if (org.parentId && orgMap.has(org.parentId)) {
        const parent = orgMap.get(org.parentId)!;
        parent.children!.push(node);
        node.level = parent.level + 1;
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  };

  const renderOrganizationNode = (node: OrganizationNode): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const canManage = hasPermission(user, 'manage_organization');
    const canCreateChild = hasPermission(user, 'create_organization') || 
                          (user.role === 'org_admin' && user.organizationId === node.id);

    const planColors = {
      basic: "bg-gray-100 text-gray-800",
      pro: "bg-compia-blue/10 text-compia-blue",
      enterprise: "bg-compia-purple/10 text-compia-purple"
    };

    const typeColors = {
      master: "bg-yellow-100 text-yellow-800",
      enterprise: "bg-compia-blue/10 text-compia-blue",
      subsidiary: "bg-compia-green/10 text-compia-green"
    };

    return (
      <div key={node.id} className="w-full" data-testid={`org-node-${node.id}`}>
        <div 
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          style={{ marginLeft: `${node.level * 24}px` }}
        >
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6"
                onClick={() => toggleNode(node.id)}
                data-testid={`toggle-${node.id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            )}
            {!hasChildren && <div className="w-6"></div>}
            
            <div className="w-10 h-10 bg-gradient-to-br from-compia-blue to-compia-purple rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 
                  className="font-medium text-foreground truncate"
                  data-testid={`org-name-${node.id}`}
                >
                  {node.name}
                </h3>
                <Badge 
                  className={typeColors[node.type as keyof typeof typeColors]}
                  data-testid={`org-type-${node.id}`}
                >
                  {node.type === 'master' ? 'Master' : 
                   node.type === 'enterprise' ? 'Empresa' : 'Subsidiária'}
                </Badge>
                {node.plan && (
                  <Badge 
                    className={planColors[node.plan as keyof typeof planColors]}
                    data-testid={`org-plan-${node.id}`}
                  >
                    {node.plan.toUpperCase()}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span data-testid={`org-max-users-${node.id}`}>
                    {node.maxUsers} usuários max
                  </span>
                </span>
                <span data-testid={`org-subsidiaries-${node.id}`}>
                  {node.maxSubsidiaries} subsidiárias max
                </span>
                <span className={node.isActive ? "text-compia-green" : "text-destructive"}>
                  {node.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {canCreateChild && (
              <Button
                variant="ghost"
                size="sm"
                className="text-compia-blue hover:text-compia-blue/80"
                data-testid={`add-subsidiary-${node.id}`}
              >
                <Plus className="w-4 h-4" />
                <span className="sr-only">Adicionar Subsidiária</span>
              </Button>
            )}
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                data-testid={`settings-${node.id}`}
              >
                <Settings className="w-4 h-4" />
                <span className="sr-only">Configurações</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              data-testid={`menu-${node.id}`}
            >
              <MoreVertical className="w-4 h-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2" data-testid={`children-${node.id}`}>
            {node.children!.map(child => renderOrganizationNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card data-testid="org-hierarchy-loading">
        <CardHeader>
          <CardTitle>Hierarquia Organizacional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hierarchy = buildHierarchy(organizations || []);

  return (
    <Card data-testid="organization-hierarchy">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading font-semibold text-foreground">
            Hierarquia Organizacional
          </CardTitle>
          {hasPermission(user, 'create_organization') && (
            <Button 
              className="bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground"
              onClick={() => setShowNewOrgModal(true)}
              data-testid="new-organization-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Organização
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hierarchy.length === 0 ? (
          <div className="text-center py-8" data-testid="no-organizations">
            <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma organização encontrada</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="hierarchy-tree">
            {hierarchy.map(node => renderOrganizationNode(node))}
          </div>
        )}
      </CardContent>
      
      <NewOrganizationModal 
        open={showNewOrgModal}
        onOpenChange={setShowNewOrgModal}
      />
    </Card>
  );
}
