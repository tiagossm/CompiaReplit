import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { 
  ArrowLeft, Play, Pause, Check, AlertTriangle, 
  Camera, Mic, FileText, Download, Share2, Brain,
  Clock, MapPin, User, Calendar, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

export default function InspectionDetail() {
  const [, navigate] = useLocation();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('execution');
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  // Query inspection details
  const { data: inspection, isLoading } = useQuery({
    queryKey: [`/api/inspections/${id}`],
    enabled: !!id
  });

  // Start inspection mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/inspections/${id}/start`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Inspeção Iniciada",
        description: "A inspeção está em andamento"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/inspections/${id}`] });
    }
  });

  // Complete inspection mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/inspections/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ responses })
      });
    },
    onSuccess: () => {
      toast({
        title: "Inspeção Concluída",
        description: "Inspeção finalizada com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/inspections/${id}`] });
      setActiveTab('results');
    }
  });

  // AI Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/inspections/${id}/analyze`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "Análise Concluída",
        description: "IA analisou a inspeção com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/inspections/${id}`] });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p>Carregando inspeção...</p>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p>Inspeção não encontrada</p>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    approved: 'bg-purple-100 text-purple-800',
    rejected: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    draft: 'Rascunho',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    approved: 'Aprovada',
    rejected: 'Rejeitada'
  };

  const checklistFields = inspection.checklist?.items || [];
  const progress = (currentFieldIndex / checklistFields.length) * 100;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/inspections')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{inspection.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {inspection.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(inspection.scheduledAt).toLocaleDateString('pt-BR')}
              </span>
              <Badge className={statusColors[inspection.status]}>
                {statusLabels[inspection.status]}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {inspection.status === 'draft' && (
            <Button onClick={() => startMutation.mutate()}>
              <Play className="mr-2 h-4 w-4" />
              Iniciar Inspeção
            </Button>
          )}
          {inspection.status === 'completed' && (
            <>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="execution">Execução</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="analysis">Análise IA</TabsTrigger>
          <TabsTrigger value="actions">Plano de Ação</TabsTrigger>
        </TabsList>

        {/* Execution Tab */}
        <TabsContent value="execution" className="mt-6">
          {inspection.status === 'draft' ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Inspeção Agendada</h3>
                  <p className="text-muted-foreground mb-4">
                    Esta inspeção está agendada para {new Date(inspection.scheduledAt).toLocaleString('pt-BR')}
                  </p>
                  <Button onClick={() => startMutation.mutate()}>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : inspection.status === 'in_progress' ? (
            <div className="space-y-6">
              {/* Progress Bar */}
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso da Inspeção</span>
                      <span>{currentFieldIndex}/{checklistFields.length} campos</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                </CardContent>
              </Card>

              {/* Current Field */}
              {checklistFields[currentFieldIndex] && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Campo {currentFieldIndex + 1} de {checklistFields.length}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon">
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Mic className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-lg mb-2">
                          {checklistFields[currentFieldIndex].label}
                          {checklistFields[currentFieldIndex].required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </h4>
                        {checklistFields[currentFieldIndex].description && (
                          <p className="text-muted-foreground">
                            {checklistFields[currentFieldIndex].description}
                          </p>
                        )}
                      </div>

                      {/* Render field input based on type */}
                      <div className="py-4">
                        {/* Field inputs would go here based on field type */}
                        <p className="text-muted-foreground">
                          [Campo de entrada tipo: {checklistFields[currentFieldIndex].type}]
                        </p>
                      </div>

                      {/* Navigation */}
                      <div className="flex justify-between">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentFieldIndex(Math.max(0, currentFieldIndex - 1))}
                          disabled={currentFieldIndex === 0}
                        >
                          Anterior
                        </Button>
                        {currentFieldIndex === checklistFields.length - 1 ? (
                          <Button onClick={() => completeMutation.mutate()}>
                            <Check className="mr-2 h-4 w-4" />
                            Concluir Inspeção
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setCurrentFieldIndex(currentFieldIndex + 1)}
                          >
                            Próximo
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Check className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <h3 className="text-lg font-medium mb-2">Inspeção Concluída</h3>
                  <p className="text-muted-foreground">
                    Visualize os resultados e análises nas outras abas
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conformidades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {inspection.findings?.conformities || 0}
                </div>
                <p className="text-sm text-muted-foreground">Itens conformes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Não Conformidades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {inspection.findings?.nonConformities || 0}
                </div>
                <p className="text-sm text-muted-foreground">Itens não conformes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Geral</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {inspection.findings?.score || 0}%
                </div>
                <p className="text-sm text-muted-foreground">Pontuação de conformidade</p>
              </CardContent>
            </Card>
          </div>

          {/* Findings List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Achados da Inspeção</CardTitle>
              <CardDescription>
                Detalhes dos itens verificados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.findings?.details ? (
                <div className="space-y-2">
                  {/* Render findings details */}
                  <p className="text-muted-foreground">Detalhes dos achados...</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum resultado disponível ainda
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Análise de Inteligência Artificial
                </span>
                {inspection.status === 'completed' && !inspection.aiAnalysis && (
                  <Button onClick={() => analysisMutation.mutate()}>
                    Gerar Análise
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inspection.aiAnalysis ? (
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{inspection.aiAnalysis}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {inspection.status === 'completed' 
                      ? 'Clique em "Gerar Análise" para obter insights da IA'
                      : 'Complete a inspeção para gerar análise com IA'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Plans Tab */}
        <TabsContent value="actions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Planos de Ação</span>
                {inspection.status === 'completed' && (
                  <Button>
                    Criar Plano de Ação
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Ações corretivas baseadas nas não conformidades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.actionPlans?.length > 0 ? (
                <div className="space-y-4">
                  {/* Render action plans */}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum plano de ação criado ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}