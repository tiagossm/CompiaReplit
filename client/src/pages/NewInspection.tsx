import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Search, FileText, Calendar, MapPin, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

export default function NewInspection() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    description: '',
    checklistTemplateId: '',
    scheduledAt: new Date().toISOString().slice(0, 16)
  });

  // Query checklist templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['/api/checklist-templates']
  });

  // Create inspection mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/inspections', 'POST', formData);
    },
    onSuccess: (data) => {
      toast({
        title: "Inspeção Criada",
        description: "Inspeção agendada com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inspections'] });
      navigate(`/inspections/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao Criar",
        description: error.message || "Falha ao criar inspeção",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.location || !formData.checklistTemplateId) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/inspections')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nova Inspeção</h1>
          <p className="text-muted-foreground">
            Agende uma nova inspeção de segurança
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Inspeção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Título da Inspeção *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Inspeção Semanal de Segurança"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Local *
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Canteiro de Obras - Setor A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o objetivo e escopo da inspeção..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Data e Hora Agendada
                </Label>
                <Input
                  id="scheduled"
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist Template</CardTitle>
              <CardDescription>
                Selecione o checklist a ser usado nesta inspeção
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <p className="text-muted-foreground">Carregando templates...</p>
              ) : (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      placeholder="Buscar templates..."
                    />
                  </div>

                  {/* Templates List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {templates.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Nenhum template disponível</p>
                        <Button
                          variant="link"
                          onClick={() => navigate('/checklists/new')}
                        >
                          Criar novo template
                        </Button>
                      </div>
                    ) : (
                      templates.map((template: any) => (
                        <div
                          key={template.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            formData.checklistTemplateId === template.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:bg-secondary'
                          }`}
                          onClick={() => setFormData({ ...formData, checklistTemplateId: template.id })}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {template.category} • {template.items?.length || 0} campos
                              </p>
                            </div>
                            {formData.checklistTemplateId === template.id && (
                              <div className="text-blue-600 bg-blue-100 rounded-full p-1">
                                ✓
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">Rascunho</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inspetor</p>
                <p className="font-medium flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Você
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organização</p>
                <p className="font-medium flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  Sua Empresa
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formData.checklistTemplateId}
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Inspeção'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/inspections')}
            >
              Cancelar
            </Button>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">
                <strong>Dica:</strong> Após criar a inspeção, você poderá iniciar a execução 
                imediatamente ou aguardar o horário agendado. Durante a execução, você pode 
                anexar fotos, vídeos e áudios que serão analisados pela IA.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}