import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Search, Filter, Plus, Eye, Edit, Trash2, Clock, AlertTriangle, 
  CheckCircle, Calendar, User, MapPin, Lightbulb, Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import type { ActionPlan } from "@/lib/types";
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/constants";

const actionPlanSchema = z.object({
  inspectionId: z.string().min(1, "Inspeção é obrigatória"),
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  what: z.string().min(1, "O que fazer é obrigatório"),
  why: z.string().min(1, "Por que fazer é obrigatório"),
  where: z.string().min(1, "Onde executar é obrigatório"),
  when: z.string().min(1, "Quando executar é obrigatório"),
  who: z.string().min(1, "Quem é responsável é obrigatório"),
  how: z.string().min(1, "Como executar é obrigatório"),
  howMuch: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
});

type ActionPlanFormData = z.infer<typeof actionPlanSchema>;

export default function ActionPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedActionPlan, setSelectedActionPlan] = useState<ActionPlan | null>(null);
  const [showDetails, setShowDetails] = useState<ActionPlan | null>(null);

  const { data: actionPlans, isLoading } = useQuery<ActionPlan[]>({
    queryKey: ['/api/action-plans'],
  });

  const { data: inspections } = useQuery<any[]>({
    queryKey: ['/api/inspections'],
  });

  const form = useForm<ActionPlanFormData>({
    resolver: zodResolver(actionPlanSchema),
    defaultValues: {
      title: "",
      description: "",
      what: "",
      why: "",
      where: "",
      when: "",
      who: "",
      how: "",
      howMuch: "",
      priority: "medium",
      inspectionId: "",
      assignedTo: "",
      dueDate: "",
    }
  });

  const createActionPlanMutation = useMutation({
    mutationFn: async (data: ActionPlanFormData) => {
      const endpoint = selectedActionPlan ? `/api/action-plans/${selectedActionPlan.id}` : '/api/action-plans';
      const method = selectedActionPlan ? 'PATCH' : 'POST';
      return await apiRequest(endpoint, method, data);
    },
    onSuccess: (actionPlan) => {
      toast({
        title: selectedActionPlan ? "Plano atualizado!" : "Plano criado!",
        description: `Plano de ação "${actionPlan.title}" ${selectedActionPlan ? 'atualizado' : 'criado'} com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/action-plans'] });
      setShowCreateForm(false);
      setSelectedActionPlan(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar plano",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const generateRecommendationMutation = useMutation({
    mutationFn: async (finding: any) => {
      const response = await apiRequest('/api/action-plans/generate', 'POST', { finding });
      return response.json();
    },
    onSuccess: (recommendations) => {
      form.setValue('what', recommendations.what);
      form.setValue('why', recommendations.why);
      form.setValue('where', recommendations.where);
      form.setValue('when', recommendations.when);
      form.setValue('who', recommendations.who);
      form.setValue('how', recommendations.how);
      form.setValue('howMuch', recommendations.howMuch);
      
      toast({
        title: "Recomendações geradas!",
        description: "Plano 5W2H gerado pela IA com base na não conformidade",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao gerar recomendações",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const canManageActionPlans = hasPermission(user, 'manage_action_plans');

  const filteredActionPlans = (actionPlans || []).filter(plan => {
    const matchesSearch = plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.where.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || plan.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleSubmit = (data: ActionPlanFormData) => {
    createActionPlanMutation.mutate(data);
  };

  const openEditForm = (actionPlan: ActionPlan) => {
    setSelectedActionPlan(actionPlan);
    form.reset({
      title: actionPlan.title,
      description: actionPlan.description || "",
      what: actionPlan.what,
      why: actionPlan.why,
      where: actionPlan.where,
      when: new Date(actionPlan.when).toISOString().slice(0, 16),
      who: actionPlan.who,
      how: actionPlan.how,
      howMuch: actionPlan.howMuch || "",
      priority: actionPlan.priority,
      inspectionId: actionPlan.inspectionId,
      assignedTo: actionPlan.assignedTo || "",
      dueDate: actionPlan.dueDate ? new Date(actionPlan.dueDate).toISOString().slice(0, 10) : "",
    });
    setShowCreateForm(true);
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-compia-green" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-compia-green" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const generateAIRecommendations = () => {
    const mockFinding = {
      description: form.getValues('description') || "Não conformidade detectada",
      severity: "medium",
      location: form.getValues('where') || "Local não especificado"
    };
    generateRecommendationMutation.mutate(mockFinding);
  };

  if (isLoading) {
    return (
      <div className="p-6" data-testid="action-plans-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="action-plans-page">
      {/* Header with Search and Filters */}
      <Card data-testid="action-plans-header">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 flex space-x-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar planos de ação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-action-plans"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="overdue">Atrasada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-priority">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {canManageActionPlans && (
              <Button 
                onClick={() => {
                  setSelectedActionPlan(null);
                  form.reset();
                  setShowCreateForm(true);
                }}
                className="bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground"
                data-testid="new-action-plan-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano de Ação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="action-plans-grid">
        {filteredActionPlans.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3" data-testid="no-action-plans">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Nenhum plano de ação encontrado" 
                  : "Nenhum plano de ação cadastrado"
                }
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Tente ajustar os filtros de pesquisa"
                  : "Comece criando seu primeiro plano de ação 5W2H"
                }
              </p>
              {canManageActionPlans && !searchTerm && statusFilter === "all" && priorityFilter === "all" && (
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-compia-blue hover:bg-compia-blue/90"
                  data-testid="create-first-action-plan"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Plano
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredActionPlans.map((actionPlan) => {
            const isOverdue = actionPlan.dueDate && new Date(actionPlan.dueDate) < new Date() && actionPlan.status !== 'completed';
            const daysUntilDue = actionPlan.dueDate 
              ? Math.ceil((new Date(actionPlan.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card 
                key={actionPlan.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                data-testid={`action-plan-card-${actionPlan.id}`}
                onClick={() => setShowDetails(actionPlan)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2 mb-2" data-testid={`action-plan-title-${actionPlan.id}`}>
                        {actionPlan.title}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(actionPlan.status)}
                        <Badge 
                          className={ACTION_STATUS_COLORS[actionPlan.status as keyof typeof ACTION_STATUS_COLORS]}
                          data-testid={`action-plan-status-${actionPlan.id}`}
                        >
                          {ACTION_STATUS_LABELS[actionPlan.status as keyof typeof ACTION_STATUS_LABELS]}
                        </Badge>
                        {getPriorityIcon(actionPlan.priority)}
                        <Badge 
                          className={PRIORITY_COLORS[actionPlan.priority as keyof typeof PRIORITY_COLORS]}
                          data-testid={`action-plan-priority-${actionPlan.id}`}
                        >
                          {PRIORITY_LABELS[actionPlan.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate" data-testid={`action-plan-location-${actionPlan.id}`}>
                        {actionPlan.where}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <User className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Responsável: {actionPlan.who}</span>
                    </div>
                    
                    {actionPlan.dueDate && (
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span 
                          className={isOverdue ? "text-destructive font-medium" : daysUntilDue && daysUntilDue <= 3 ? "text-yellow-600 font-medium" : "text-muted-foreground"}
                          data-testid={`action-plan-due-${actionPlan.id}`}
                        >
                          {isOverdue 
                            ? `Atrasado ${Math.abs(daysUntilDue || 0)} dias`
                            : daysUntilDue !== null && daysUntilDue <= 7
                            ? `Vence em ${daysUntilDue} dias`
                            : `Prazo: ${new Date(actionPlan.dueDate).toLocaleDateString('pt-BR')}`
                          }
                        </span>
                      </div>
                    )}

                    {actionPlan.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {actionPlan.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-compia-blue hover:text-compia-blue/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDetails(actionPlan);
                        }}
                        data-testid={`view-action-plan-${actionPlan.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      {canManageActionPlans && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(actionPlan);
                          }}
                          data-testid={`edit-action-plan-${actionPlan.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Action Plan Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="action-plan-form-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-compia-blue" />
              <span>{selectedActionPlan ? "Editar Plano de Ação" : "Novo Plano de Ação 5W2H"}</span>
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" data-testid="action-plan-form">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título do Plano</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: Correção de fiação elétrica exposta"
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="inspectionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inspeção Relacionada</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-inspection">
                                <SelectValue placeholder="Selecione uma inspeção" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inspections?.map((inspection: any) => (
                                <SelectItem key={inspection.id} value={inspection.id}>
                                  {inspection.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-priority">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Baixa</SelectItem>
                              <SelectItem value="medium">Média</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="critical">Crítica</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="assignedTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Atribuído a (Opcional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ID do usuário responsável"
                              data-testid="input-assigned-to"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Limite</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              data-testid="input-due-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Descreva o contexto e objetivo do plano de ação..."
                            rows={3}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 5W2H Method */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Metodologia 5W2H</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAIRecommendations}
                      disabled={generateRecommendationMutation.isPending}
                      className="text-compia-purple hover:text-compia-purple/80"
                      data-testid="generate-ai-recommendations"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {generateRecommendationMutation.isPending ? "Gerando..." : "Gerar com IA"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="what"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>O QUE será feito?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Descreva a ação específica que será executada..."
                              rows={3}
                              data-testid="textarea-what"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="why"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>POR QUE será feito?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Justifique a necessidade e os benefícios..."
                              rows={3}
                              data-testid="textarea-why"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="where"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ONDE será executado?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Especifique o local, setor ou área..."
                              rows={3}
                              data-testid="textarea-where"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="when"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>QUANDO será executado?</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="datetime-local"
                              data-testid="input-when"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="who"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>QUEM será responsável?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Identifique pessoas, cargos ou equipes responsáveis..."
                              rows={3}
                              data-testid="textarea-who"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="how"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COMO será executado?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Descreva o método, procedimentos e recursos necessários..."
                              rows={3}
                              data-testid="textarea-how"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="howMuch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QUANTO custará? (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Estime custos, orçamento e recursos financeiros necessários..."
                            rows={2}
                            data-testid="textarea-how-much"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-4" data-testid="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  data-testid="cancel-action-plan"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createActionPlanMutation.isPending}
                  className="bg-compia-blue hover:bg-compia-blue/90"
                  data-testid="save-action-plan"
                >
                  {createActionPlanMutation.isPending 
                    ? "Salvando..." 
                    : selectedActionPlan 
                      ? "Atualizar Plano" 
                      : "Criar Plano de Ação"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Action Plan Details Dialog */}
      <Dialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="action-plan-details-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-compia-blue" />
              <span>Detalhes do Plano de Ação</span>
            </DialogTitle>
          </DialogHeader>
          
          {showDetails && (
            <div className="space-y-6" data-testid="action-plan-details">
              {/* Header Info */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-2" data-testid="details-title">
                        {showDetails.title}
                      </h2>
                      <div className="flex items-center space-x-3">
                        <Badge className={ACTION_STATUS_COLORS[showDetails.status as keyof typeof ACTION_STATUS_COLORS]}>
                          {ACTION_STATUS_LABELS[showDetails.status as keyof typeof ACTION_STATUS_LABELS]}
                        </Badge>
                        <Badge className={PRIORITY_COLORS[showDetails.priority as keyof typeof PRIORITY_COLORS]}>
                          {PRIORITY_LABELS[showDetails.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </div>
                    </div>
                    {canManageActionPlans && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDetails(null);
                          openEditForm(showDetails);
                        }}
                        data-testid="edit-from-details"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    )}
                  </div>
                  
                  {showDetails.description && (
                    <p className="text-muted-foreground mb-4">{showDetails.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-foreground">Responsável:</span>
                      <p className="text-muted-foreground">{showDetails.who}</p>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Local:</span>
                      <p className="text-muted-foreground">{showDetails.where}</p>
                    </div>
                    {showDetails.dueDate && (
                      <div>
                        <span className="font-medium text-foreground">Prazo:</span>
                        <p className="text-muted-foreground">
                          {new Date(showDetails.dueDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 5W2H Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Metodologia 5W2H</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">O QUE será feito?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.what}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">POR QUE será feito?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.why}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">ONDE será executado?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.where}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">QUANDO será executado?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">
                        {new Date(showDetails.when).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">QUEM será responsável?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.who}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">COMO será executado?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.how}</p>
                    </div>
                  </div>
                  
                  {showDetails.howMuch && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">QUANTO custará?</h4>
                      <p className="text-muted-foreground bg-muted/50 p-3 rounded">{showDetails.howMuch}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
