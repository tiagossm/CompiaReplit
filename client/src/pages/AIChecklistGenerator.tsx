import { useState } from 'react';
import { useLocation } from 'wouter';
import { Brain, ArrowLeft, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export default function AIChecklistGenerator() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    industry: '',
    location_type: '',
    template_name: '',
    category: '',
    num_questions: 10,
    specific_requirements: '',
    assistant: 'GENERAL'
  });

  const industryOptions = [
    'Construção Civil',
    'Indústria Química', 
    'Indústria Alimentícia',
    'Metalurgia',
    'Hospitalar',
    'Educacional',
    'Comercial',
    'Logística e Transporte',
    'Energia e Utilities',
    'Tecnologia',
    'Outro'
  ];

  const locationTypes = [
    'Escritório',
    'Fábrica',
    'Canteiro de Obras',
    'Laboratório',
    'Hospital',
    'Escola',
    'Armazém',
    'Área Externa',
    'Oficina',
    'Outro'
  ];

  const nrAssistants = [
    { value: 'GENERAL', label: 'Assistente Geral SST' },
    { value: 'NR-01', label: 'NR-01 - Disposições Gerais e GRO' },
    { value: 'NR-05', label: 'NR-05 - CIPA' },
    { value: 'NR-06', label: 'NR-06 - EPI' },
    { value: 'NR-07', label: 'NR-07 - PCMSO' },
    { value: 'NR-09', label: 'NR-09 - Exposições Ocupacionais' },
    { value: 'NR-10', label: 'NR-10 - Eletricidade' },
    { value: 'NR-11', label: 'NR-11 - Transporte e Movimentação' },
    { value: 'NR-12', label: 'NR-12 - Máquinas e Equipamentos' },
    { value: 'NR-15', label: 'NR-15 - Insalubridade' },
    { value: 'NR-16', label: 'NR-16 - Periculosidade' },
    { value: 'NR-17', label: 'NR-17 - Ergonomia' },
    { value: 'NR-18', label: 'NR-18 - Construção Civil' },
    { value: 'NR-23', label: 'NR-23 - Proteção Contra Incêndios' },
    { value: 'NR-24', label: 'NR-24 - Condições Sanitárias' },
    { value: 'NR-35', label: 'NR-35 - Trabalho em Altura' }
  ];

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/checklist-templates/generate-ai', 'POST', {
        ...formData,
        detail_level: 'detalhado',
        priority_focus: 'seguranca'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Checklist Gerado!",
        description: `Template "${formData.template_name}" criado com sucesso usando IA.`
      });
      navigate('/checklists');
    },
    onError: (error) => {
      toast({
        title: "Erro na Geração",
        description: error.message || "Falha ao gerar checklist com IA",
        variant: "destructive"
      });
    }
  });

  const handleGenerate = () => {
    if (!formData.industry || !formData.location_type || !formData.template_name || !formData.category) {
      toast({
        title: "Campos Obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }
    generateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/checklists')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            Gerador de Checklist com IA
          </h1>
          <p className="text-muted-foreground mt-1">
            Use inteligência artificial para criar checklists personalizados com assistentes especializados em NRs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Checklist</CardTitle>
          <CardDescription>
            Forneça detalhes sobre o ambiente e requisitos para gerar um checklist otimizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="industry">Setor/Indústria *</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map(industry => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Tipo de Local *</Label>
              <Select
                value={formData.location_type}
                onValueChange={(value) => setFormData({ ...formData, location_type: value })}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Selecione o tipo de local" />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="Ex: Checklist de Segurança - Construção"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Segurança, EPIs, Equipamentos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistant">Assistente Especializado (NR)</Label>
              <Select
                value={formData.assistant}
                onValueChange={(value) => setFormData({ ...formData, assistant: value })}
              >
                <SelectTrigger id="assistant">
                  <SelectValue placeholder="Selecione o assistente" />
                </SelectTrigger>
                <SelectContent>
                  {nrAssistants.map(assistant => (
                    <SelectItem key={assistant.value} value={assistant.value}>
                      {assistant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="questions">
                Número de Perguntas: {formData.num_questions}
              </Label>
              <input
                id="questions"
                type="range"
                min="5"
                max="30"
                value={formData.num_questions}
                onChange={(e) => setFormData({ ...formData, num_questions: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 (Rápido)</span>
                <span>30 (Detalhado)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requisitos Específicos (Opcional)</Label>
            <Textarea
              id="requirements"
              rows={4}
              value={formData.specific_requirements}
              onChange={(e) => setFormData({ ...formData, specific_requirements: e.target.value })}
              placeholder="Descreva requisitos específicos, normas aplicáveis, equipamentos especiais, riscos particulares..."
              className="resize-none"
            />
          </div>

          {/* AI Assistant Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900 space-y-1">
                <p className="font-medium">Assistente IA Especializado</p>
                <p>O assistente selecionado irá gerar o checklist com foco nas normas e requisitos específicos da NR escolhida.</p>
                <p>Use o Assistente Geral para uma análise abrangente de múltiplas normas.</p>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !formData.industry || !formData.location_type}
              className="min-w-[200px]"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Gerar Checklist com IA
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-purple-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Dicas para Melhor Resultado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-purple-800 space-y-2">
          <p>• Seja específico no setor e tipo de local para maior precisão</p>
          <p>• Escolha o assistente de NR mais adequado ao seu contexto</p>
          <p>• Adicione requisitos específicos para personalização</p>
          <p>• Use 15-20 perguntas para checklists equilibrados</p>
          <p>• O sistema usa GPT-5 para máxima qualidade e precisão</p>
        </CardContent>
      </Card>
    </div>
  );
}