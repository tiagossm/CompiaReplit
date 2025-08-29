import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Save, ArrowLeft, FileCheck, MapPin, Brain, Calendar, Building2, Users, Navigation } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import type { ChecklistTemplate, User, Organization } from "@shared/schema";

// AI Assistants mapping
const AI_ASSISTANTS = [
  { id: 'NR-01', name: 'Assistente Geral de Segurança do Trabalho', description: 'Análise geral de SST' },
  { id: 'NR-05', name: 'Assistente CIPA', description: 'Comissão Interna de Prevenção de Acidentes' },
  { id: 'NR-06', name: 'Assistente EPI', description: 'Equipamentos de Proteção Individual' },
  { id: 'NR-07', name: 'Assistente PCMSO', description: 'Programa de Controle Médico de Saúde Ocupacional' },
  { id: 'NR-09', name: 'Assistente PGR', description: 'Programa de Gerenciamento de Riscos' },
  { id: 'NR-10', name: 'Assistente Segurança Elétrica', description: 'Segurança em Instalações e Serviços em Eletricidade' },
  { id: 'NR-11', name: 'Assistente Transporte e Movimentação', description: 'Transporte, Movimentação, Armazenagem e Manuseio' },
  { id: 'NR-12', name: 'Assistente Máquinas e Equipamentos', description: 'Segurança no Trabalho em Máquinas e Equipamentos' },
  { id: 'NR-15', name: 'Assistente Insalubridade', description: 'Atividades e Operações Insalubres' },
  { id: 'NR-16', name: 'Assistente Periculosidade', description: 'Atividades e Operações Perigosas' },
  { id: 'NR-17', name: 'Assistente Ergonomia', description: 'Ergonomia' },
  { id: 'NR-18', name: 'Assistente Construção Civil', description: 'Condições de Trabalho na Indústria da Construção' },
  { id: 'NR-23', name: 'Assistente Proteção Contra Incêndios', description: 'Proteção Contra Incêndios' },
  { id: 'NR-24', name: 'Assistente Condições Sanitárias', description: 'Condições Sanitárias e de Conforto' },
  { id: 'NR-35', name: 'Assistente Trabalho em Altura', description: 'Trabalho em Altura' },
];

const ACTION_PLAN_TYPES = [
  { id: '5W2H', name: '5W2H (Completo)', description: 'What, Why, Where, When, Who, How, How Much' },
  { id: '5W2H_SIMPLE', name: '5W2H (Simplificado)', description: 'Versão simplificada do 5W2H' },
  { id: 'PDCA', name: 'PDCA', description: 'Plan, Do, Check, Act' },
  { id: 'ISHIKAWA', name: 'Diagrama de Ishikawa', description: 'Análise de causa raiz' },
  { id: 'CUSTOM', name: 'Personalizado', description: 'Plano de ação customizado' },
];

export default function NewInspection() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic info
    companyName: '',
    organizationId: '',
    priority: 'medium',
    
    // Checklist & AI config
    checklistTemplateId: '',
    aiAssistantId: '',
    actionPlanType: '5W2H',
    
    // Location
    location: '',
    zipCode: '',
    fullAddress: '',
    latitude: null as number | null,
    longitude: null as number | null,
    
    // Responsible parties
    technicianName: '',
    technicianEmail: '',
    companyResponsibleName: '',
    scheduledAt: '',
    
    // Additional
    title: '',
    description: '',
  });

  // Queries
  const { data: templates } = useQuery<ChecklistTemplate[]>({
    queryKey: ['/api/checklist-templates'],
  });

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Set default organization from user
  useEffect(() => {
    if (user?.organizationId && !formData.organizationId) {
      setFormData(prev => ({
        ...prev,
        organizationId: user.organizationId!,
        technicianName: user.name || '',
        technicianEmail: user.email || '',
      }));
    }
  }, [user]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/inspections', 'POST', data),
    onSuccess: (result: any) => {
      console.log('NewInspection - mutation success result:', result);
      queryClient.invalidateQueries({ queryKey: ['/api/inspections'] });
      if (result && result.id) {
        console.log('NewInspection - navigating to:', `/inspections/${result.id}`);
        setLocation(`/inspections/${result.id}`);
      } else {
        console.error('NewInspection - no ID in result:', result);
        setLocation('/inspections');
      }
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
      // Generate title if not provided
      const title = formData.title || `Inspeção - ${formData.companyName || 'Empresa'} - ${formData.location}`;
      
      const inspectionData = {
        title,
        description: formData.description,
        location: formData.location,
        checklistTemplateId: formData.checklistTemplateId,
        scheduledAt: formData.scheduledAt || undefined,
        organizationId: formData.organizationId,
        priority: formData.priority,
        companyName: formData.companyName,
        zipCode: formData.zipCode,
        fullAddress: formData.fullAddress,
        latitude: formData.latitude,
        longitude: formData.longitude,
        technicianName: formData.technicianName,
        technicianEmail: formData.technicianEmail,
        companyResponsibleName: formData.companyResponsibleName,
        aiAssistantId: formData.aiAssistantId,
        actionPlanType: formData.actionPlanType,
      };

      createMutation.mutate(inspectionData);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCaptureGPS = () => {
    setGpsLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setGpsLoading(false);
        },
        (error) => {
          console.error("Erro ao capturar GPS:", error);
          alert("Não foi possível capturar a localização GPS");
          setGpsLoading(false);
        }
      );
    } else {
      alert("Geolocalização não suportada neste navegador");
      setGpsLoading(false);
    }
  };

  const handleZipCodeChange = async (zipCode: string) => {
    handleInputChange('zipCode', zipCode);
    
    // Format CEP for API
    const cleanZipCode = zipCode.replace(/\D/g, '');
    if (cleanZipCode.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanZipCode}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
          handleInputChange('fullAddress', fullAddress);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  // Filter valid templates
  const validTemplates = (templates || []).filter(template => 
    template.name && template.category && template.isActive
  );

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="new-inspection-page">
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
            <h1 className="text-3xl font-heading font-bold text-compia-blue">Nova Inspeção</h1>
            <p className="text-muted-foreground">Configure e agende uma nova inspeção de segurança</p>
          </div>
        </div>
        <Badge variant="outline" className="text-compia-purple">
          <Brain className="w-4 h-4 mr-1" />
          IA Integrada
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-compia-blue" />
                  Informações da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nome da Empresa *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="Ex: ABC Indústria Ltda"
                    required
                    data-testid="input-company-name"
                  />
                </div>

                <div>
                  <Label htmlFor="organizationId">Organização</Label>
                  <Select 
                    value={formData.organizationId} 
                    onValueChange={(value) => handleInputChange('organizationId', value)}
                  >
                    <SelectTrigger data-testid="select-organization">
                      <SelectValue placeholder="Selecione a organização" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          <div className="flex items-center">
                            <Badge variant="outline" className="mr-2">
                              {org.type === 'master' ? 'Master' : org.type === 'enterprise' ? 'Empresa' : 'Filial'}
                            </Badge>
                            {org.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value) => handleInputChange('priority', value)}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
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

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-compia-green" />
                  Localização
                </CardTitle>
                <CardDescription>Local e endereço da inspeção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="location">Local *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Ex: Galpão A - Setor de Produção"
                    required
                    data-testid="input-location"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => handleZipCodeChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      data-testid="input-zip-code"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCaptureGPS}
                      disabled={gpsLoading}
                      className="w-full"
                      data-testid="capture-gps"
                    >
                      <Navigation className="w-4 h-4 mr-2" />
                      {gpsLoading ? 'Capturando...' : 'Capturar GPS'}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="fullAddress">Endereço Completo</Label>
                  <Textarea
                    id="fullAddress"
                    value={formData.fullAddress}
                    onChange={(e) => handleInputChange('fullAddress', e.target.value)}
                    placeholder="Endereço será preenchido automaticamente pelo CEP ou digite manualmente"
                    rows={2}
                    data-testid="input-full-address"
                  />
                </div>

                {formData.latitude && formData.longitude && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      📍 GPS capturado: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Checklist & AI Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-compia-purple" />
                  Configuração do Checklist e IA
                </CardTitle>
                <CardDescription>Template, assistente de IA e tipo de plano de ação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="checklistTemplateId">Template de Checklist (Opcional)</Label>
                  <Select 
                    value={formData.checklistTemplateId} 
                    onValueChange={(value) => handleInputChange('checklistTemplateId', value)}
                  >
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Escolha um template ou crie durante a inspeção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum template - Criar inspeção sem template</SelectItem>
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Você pode criar uma inspeção sem template e adicionar itens manualmente ou escolher um template para pré-configurar os itens do checklist
                  </p>
                </div>

                <div>
                  <Label htmlFor="aiAssistantId">Assistente de IA Especializado</Label>
                  <Select 
                    value={formData.aiAssistantId} 
                    onValueChange={(value) => handleInputChange('aiAssistantId', value)}
                  >
                    <SelectTrigger data-testid="select-ai-assistant">
                      <SelectValue placeholder="Selecione um assistente especializado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">Assistente Geral de Segurança do Trabalho</SelectItem>
                      {AI_ASSISTANTS.map((assistant) => (
                        <SelectItem key={assistant.id} value={assistant.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{assistant.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {assistant.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha um especialista para que as análises de IA sejam mais precisas e contextualizadas para esta área específica
                  </p>
                </div>

                <div>
                  <Label htmlFor="actionPlanType">Tipo de Plano de Ação</Label>
                  <Select 
                    value={formData.actionPlanType} 
                    onValueChange={(value) => handleInputChange('actionPlanType', value)}
                  >
                    <SelectTrigger data-testid="select-action-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_PLAN_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {type.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha entre plano 5W2H completo ou formato simples
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Responsible Parties */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-compia-orange" />
                  Responsáveis e Agendamento
                </CardTitle>
                <CardDescription>Técnico responsável e cronograma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="technicianName">Nome do Técnico *</Label>
                  <Input
                    id="technicianName"
                    value={formData.technicianName}
                    onChange={(e) => handleInputChange('technicianName', e.target.value)}
                    placeholder="Nome completo do técnico responsável"
                    required
                    data-testid="input-technician-name"
                  />
                </div>

                <div>
                  <Label htmlFor="technicianEmail">Email do Técnico</Label>
                  <Input
                    id="technicianEmail"
                    type="email"
                    value={formData.technicianEmail}
                    onChange={(e) => handleInputChange('technicianEmail', e.target.value)}
                    placeholder="email@exemplo.com"
                    data-testid="input-technician-email"
                  />
                </div>

                <div>
                  <Label htmlFor="companyResponsibleName">Nome do Responsável da Empresa</Label>
                  <Input
                    id="companyResponsibleName"
                    value={formData.companyResponsibleName}
                    onChange={(e) => handleInputChange('companyResponsibleName', e.target.value)}
                    placeholder="Nome do responsável técnico da empresa"
                    data-testid="input-company-responsible"
                  />
                </div>

                <div>
                  <Label htmlFor="scheduledAt2">Data Agendada</Label>
                  <Input
                    id="scheduledAt2"
                    type="date"
                    value={formData.scheduledAt ? formData.scheduledAt.split('T')[0] : ''}
                    onChange={(e) => {
                      const time = formData.scheduledAt ? formData.scheduledAt.split('T')[1] : '08:00';
                      handleInputChange('scheduledAt', `${e.target.value}T${time}`);
                    }}
                    data-testid="input-scheduled-date-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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
            disabled={loading || createMutation.isPending || !formData.companyName || !formData.location || !formData.technicianName}
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