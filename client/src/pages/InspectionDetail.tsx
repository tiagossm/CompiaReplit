import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Edit
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
    <div className="p-6 max-w-6xl mx-auto" data-testid="inspection-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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

          <Button variant="outline" data-testid="share-inspection">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>

          <Button variant="outline" data-testid="download-report">
            <Download className="w-4 h-4 mr-2" />
            Relatório
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-compia-blue" />
                Informações da Inspeção
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
          <Card>
            <CardHeader>
              <CardTitle>Checklist de Inspeção</CardTitle>
            </CardHeader>
            <CardContent>
              {inspection.checklist ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Checklist baseado no template selecionado.
                  </p>
                  {/* TODO: Implementar componente de checklist */}
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-center text-muted-foreground">
                      Componente de checklist será implementado aqui
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Checklist não carregado</h3>
                  <p className="text-muted-foreground">
                    O checklist será carregado quando a inspeção for iniciada.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="edit-inspection"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar Inspeção
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="add-note"
              >
                <FileText className="w-4 h-4 mr-2" />
                Adicionar Observação
              </Button>
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
    </div>
  );
}