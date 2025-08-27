import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Save, ArrowLeft, FileCheck, MapPin, Brain } from 'lucide-react';
import type { ChecklistTemplate } from "@shared/schema";

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    checklistTemplateId: '',
    scheduledAt: '',
  });

  const { data: templates } = useQuery<ChecklistTemplate[]>({
    queryKey: ['/api/checklist-templates'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/inspections', 'POST', data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspections'] });
      setLocation(`/inspections/${result.id}`);
    },
    onError: (error: any) => {
      console.error('Erro ao criar inspeção:', error);
      alert(`Erro ao criar inspeção: ${error.message || 'Tente novamente.'}`);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const inspectionData = {
        ...formData,
        scheduledAt: formData.scheduledAt || undefined,
      };

      createMutation.mutate(inspectionData);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Filtrar apenas templates válidos
  const validTemplates = (templates || []).filter(template => 
    template.name && template.category && template.isActive
  );

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="new-inspection-page">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/inspections')}
          data-testid="back-to-inspections"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-heading font-bold text-compia-blue">Nova Inspeção</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileCheck className="w-5 h-5 mr-2 text-compia-blue" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título da Inspeção *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Ex: Inspeção de Segurança - Canteiro Principal"
                required
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descreva o objetivo e escopo desta inspeção..."
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label htmlFor="location">Local da Inspeção *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Ex: Canteiro de Obras - Bloco A"
                required
                data-testid="input-location"
              />
            </div>

            <div>
              <Label htmlFor="scheduledAt">Data Agendada</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                data-testid="input-scheduled-date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="w-5 h-5 mr-2 text-compia-purple" />
              Template de Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="checklistTemplateId">Selecione o Template *</Label>
              <Select 
                value={formData.checklistTemplateId} 
                onValueChange={(value) => handleInputChange('checklistTemplateId', value)}
              >
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Escolha um template de checklist" />
                </SelectTrigger>
                <SelectContent>
                  {validTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {template.category}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nenhum template de checklist disponível. 
                  <a href="/checklist-templates" className="text-compia-blue hover:underline ml-1">
                    Criar novo template
                  </a>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/inspections')}
            data-testid="cancel-inspection"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || createMutation.isPending || !formData.title || !formData.location || !formData.checklistTemplateId}
            className="bg-compia-blue hover:bg-compia-blue/90"
            data-testid="save-inspection"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading || createMutation.isPending ? 'Criando...' : 'Criar Inspeção'}
          </Button>
        </div>
      </form>
    </div>
  );
}