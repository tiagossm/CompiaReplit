import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  Share2,
  Download,
  Edit,
  Plus,
  HelpCircle,
  Info
} from 'lucide-react';
import type { Inspection } from "@shared/schema";

export default function InspectionDetail() {
  const [match, params] = useRoute('/inspections/:id');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inspectionId = params?.id;

  const { data: inspection, isLoading, error } = useQuery<Inspection>({
    queryKey: ['/api/inspections', inspectionId],
    enabled: !!inspectionId,
    retry: false,
  });

  // Debug logging
  console.log('InspectionDetail - inspectionId:', inspectionId);
  console.log('InspectionDetail - inspection:', inspection);
  console.log('InspectionDetail - isLoading:', isLoading);
  console.log('InspectionDetail - error:', error);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => 
      apiRequest(`/api/inspections/${inspectionId}`, 'PATCH', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspections', inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/inspections'] });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_progress':
        return <Play className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-compia-green" />;
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Rascunho';
      case 'in_progress':
        return 'Em Andamento';
      case 'completed':
        return 'Concluída';
      case 'approved':
        return 'Aprovada';
      case 'rejected':
        return 'Rejeitada';
      default:
        return 'Desconhecido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-compia-green/20 text-compia-green border-compia-green/30';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStartInspection = () => {
    updateStatusMutation.mutate('in_progress');
  };

  const handleCompleteInspection = () => {
    updateStatusMutation.mutate('completed');
  };

  if (!match || !inspectionId) {
    return (
      <div className="p-6">
        <p>Inspeção não encontrada.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6" data-testid="inspection-detail-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="p-6 text-center" data-testid="inspection-not-found">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Inspeção não encontrada</h2>
        <p className="text-muted-foreground mb-4">
          A inspeção solicitada não existe ou você não tem permissão para visualizá-la.
        </p>
        <Button onClick={() => setLocation('/inspections')}>
          Voltar para Inspeções
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto" data-testid="inspection-detail-page">
        {/* Seção de Ajuda */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Como Usar Esta Tela</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>Template de Checklist:</strong> Escolha um template existente ou crie um novo durante a inspeção</p>
                  <p>• <strong>Status da Inspeção:</strong> Acompanhe o progresso desde rascunho até aprovação</p>
                  <p>• <strong>Ações Rápidas:</strong> Use os botões laterais para editar, adicionar observações ou compartilhar</p>
                  <p>• <strong>Checklist:</strong> Será carregado automaticamente quando a inspeção for iniciada</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex items-center justify-between mb-6"></div>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/inspections')}
            data-testid="back-to-inspections"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-heading font-bold text-compia-blue">
              {inspection.title}
            </h1>
            <div className="flex items-center space-x-2 mt-2">
              <Badge className={`${getStatusColor(inspection.status || 'draft')} border`}>
                {getStatusIcon(inspection.status || 'draft')}
                <span className="ml-2">{getStatusLabel(inspection.status || 'draft')}</span>
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                data-testid="create-new-template"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Novo Template
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Crie um novo template de checklist baseado nesta inspeção</p>
            </TooltipContent>
          </Tooltip>

          {inspection.status === 'draft' && (
            <Button
              onClick={handleStartInspection}
              disabled={updateStatusMutation.isPending}
              className="bg-compia-blue hover:bg-compia-blue/90"
              data-testid="start-inspection"
            >
              <Play className="w-4 h-4 mr-2" />
              Iniciar Inspeção
            </Button>
          )}
          
          {inspection.status === 'in_progress' && (
            <Button
              onClick={handleCompleteInspection}
              disabled={updateStatusMutation.isPending}
              className="bg-compia-green hover:bg-compia-green/90"
              data-testid="complete-inspection"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Finalizar Inspeção
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" data-testid="share-inspection">
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compartilhe esta inspeção com outros usuários</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" data-testid="download-report">
                <Download className="w-4 h-4 mr-2" />
                Relatório
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Baixe o relatório completo da inspeção em PDF</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-compia-blue" />
                Informações da Inspeção
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Informações básicas sobre a inspeção: descrição, local, datas e responsáveis</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inspection.description && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                    Descrição
                  </h4>
                  <p className="text-gray-700">{inspection.description}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Local:</span>
                    <span>{inspection.location}</span>
                  </div>

                  {inspection.scheduledAt && (
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Agendado para:</span>
                      <span>{new Date(inspection.scheduledAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Criado em:</span>
                    <span>{new Date(inspection.createdAt!).toLocaleString('pt-BR')}</span>
                  </div>

                  {inspection.startedAt && (
                    <div className="flex items-center text-sm">
                      <Play className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Iniciado em:</span>
                      <span>{new Date(inspection.startedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}

                  {inspection.completedAt && (
                    <div className="flex items-center text-sm">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium mr-2">Finalizado em:</span>
                      <span>{new Date(inspection.completedAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist Section */}
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  Checklist de Inspeção
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Template de checklist opcional - pode ser escolhido ou criado durante a inspeção</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Opcional
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inspection.checklist ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-green-800">
                      Checklist baseado no template selecionado está ativo.
                    </p>
                  </div>
                  {/* TODO: Implementar componente de checklist */}
                  <div className="p-4 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/20">
                    <p className="text-center text-muted-foreground">
                      Componente de checklist será implementado aqui
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Template de Checklist (Opcional)</h3>
                  <p className="text-muted-foreground mb-4">
                    Escolha um template existente ou crie um novo durante a inspeção para padronizar o processo.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Escolher Template
                    </Button>
                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Novo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                Ações Rápidas
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ações frequentes para gerenciar esta inspeção</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    data-testid="edit-inspection"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Inspeção
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edite as informações básicas desta inspeção</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                    data-testid="add-note"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Adicionar Observação
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adicione observações importantes à inspeção</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          {/* Inspector Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inspetor Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-compia-blue rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{user?.name || 'Usuário'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress Summary */}
          {inspection.status !== 'draft' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progresso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Itens verificados</span>
                    <span className="font-medium">0/0</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-compia-blue h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    0% concluído
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}