import { useState } from 'react';
import { useLocation } from 'wouter';
import { Upload, ArrowLeft, Download, FileText, Check, Info, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function CSVImport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [csvData, setCsvData] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiDialog, setShowAiDialog] = useState(false);

  const sampleCSV = `campo,tipo,obrigatorio,opcoes,descricao
Nome do Funcionário,text,sim,,Nome completo do funcionário responsável
Data da Inspeção,date,sim,,Data de realização da inspeção
Hora de Início,time,sim,,Horário de início da inspeção
EPIs Adequados,select,sim,"Conforme|Não Conforme|Parcial",Verificação do uso correto de EPIs
Capacete de Segurança,checkbox,sim,,Uso obrigatório em áreas de risco
Óculos de Proteção,checkbox,sim,,Proteção ocular adequada
Luvas de Proteção,checkbox,sim,,Proteção das mãos
Calçado de Segurança,checkbox,sim,,Botas com biqueira de aço
Estado dos Equipamentos,select,sim,"Excelente|Bom|Regular|Ruim|Crítico",Avaliação geral dos equipamentos
Sinalização de Segurança,rating,sim,,Avaliação da sinalização (1-5)
Organização do Local,rating,sim,,Limpeza e organização (1-5)
Riscos Identificados,multiselect,não,"Queda|Elétrico|Químico|Ergonômico|Incêndio",Riscos observados
Fotos da Inspeção,file,não,,Upload de evidências fotográficas
Observações Gerais,textarea,não,,Comentários e observações adicionais
Ações Necessárias,textarea,sim,,Descrição das ações corretivas necessárias
Responsável pela Ação,text,não,,Nome do responsável pelas correções
Prazo para Correção,date,não,,Data limite para implementação`;

  const fieldTypeMap: Record<string, string> = {
    'text': 'Texto Curto',
    'textarea': 'Texto Longo',
    'select': 'Lista Suspensa',
    'multiselect': 'Múltipla Escolha',
    'checkbox': 'Caixa de Seleção',
    'radio': 'Escolha Única',
    'boolean': 'Sim/Não',
    'date': 'Data',
    'time': 'Hora',
    'datetime': 'Data e Hora',
    'number': 'Número',
    'rating': 'Avaliação (1-5)',
    'file': 'Upload de Arquivo',
    'signature': 'Assinatura Digital',
    'location': 'Localização GPS'
  };

  const downloadSample = () => {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_checklist_completo.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvData(content);
        parseCSV(content);
      };
      reader.readAsText(file);
    }
  };

  const parseCSV = (data: string) => {
    try {
      if (!data || typeof data !== 'string') {
        throw new Error('Dados CSV inválidos');
      }
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      if (!headers.includes('campo') || !headers.includes('tipo')) {
        toast({
          title: "Formato Inválido",
          description: "CSV deve conter pelo menos as colunas 'campo' e 'tipo'",
          variant: "destructive"
        });
        return;
      }

      const parsed = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const field: any = { order: index + 1 };
        
        headers.forEach((header, i) => {
          if (header === 'campo') field.name = values[i];
          else if (header === 'tipo') field.type = values[i];
          else if (header === 'obrigatorio') field.required = values[i]?.toLowerCase() === 'sim';
          else if (header === 'opcoes') field.options = values[i] ? values[i].split('|') : [];
          else if (header === 'descricao') field.description = values[i];
        });
        
        return field;
      }).filter(field => field.name && field.type);

      setPreview(parsed);
      toast({
        title: "CSV Processado",
        description: `${parsed.length} campos detectados com sucesso`
      });
    } catch (error) {
      console.error('Erro ao parsear CSV:', error);
      toast({
        title: "Erro no Processamento",
        description: "Verifique o formato do arquivo CSV",
        variant: "destructive"
      });
    }
  };

  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/checklist-templates/generate-from-prompt', 'POST', {
        prompt: aiPrompt,
        format: 'csv'
      });
    },
    onSuccess: (data) => {
      // Remove markdown formatting if present
      let cleanCsv = data.csv;
      if (cleanCsv.includes('```csv')) {
        cleanCsv = cleanCsv.replace(/```csv\n?/g, '').replace(/```/g, '');
      }
      setCsvData(cleanCsv);
      parseCSV(cleanCsv);
      setShowAiDialog(false);
      toast({
        title: "CSV Gerado com IA",
        description: "Checklist criado com sucesso usando inteligência artificial"
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na Geração",
        description: error.message || "Falha ao gerar CSV com IA",
        variant: "destructive"
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/checklist-templates/import-csv', 'POST', {
        name: templateName,
        category,
        csvData,
        fields: preview
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Importação Concluída",
        description: `Template "${data.name}" importado com sucesso`
      });
      navigate(`/checklists/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erro na Importação",
        description: error.message || "Falha ao importar checklist",
        variant: "destructive"
      });
    }
  });

  const handleImport = () => {
    if (!templateName || !category || preview.length === 0) {
      toast({
        title: "Dados Incompletos",
        description: "Preencha todos os campos e processe um CSV válido",
        variant: "destructive"
      });
      return;
    }
    importMutation.mutate();
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
            <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
              <Upload className="h-6 w-6 text-white" />
            </div>
            Importar Checklist via CSV
          </h1>
          <p className="text-muted-foreground mt-1">
            Importe checklists de arquivos CSV ou use IA para criar o formato
          </p>
        </div>
      </div>

      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Como Importar seu Checklist</AlertTitle>
        <AlertDescription className="mt-2 space-y-1">
          <p>1. Baixe o modelo CSV ou use a IA para gerar um formato personalizado</p>
          <p>2. Preencha o arquivo com seus campos de checklist</p>
          <p>3. Faça upload do arquivo ou cole o conteúdo na área de texto</p>
          <p>4. Revise a prévia e clique em "Importar Template"</p>
        </AlertDescription>
      </Alert>

      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Template</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Template *</Label>
            <Input
              id="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Checklist de Segurança Importado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Segurança, Equipamentos, Higiene"
            />
          </div>
        </CardContent>
      </Card>

      {/* CSV Import Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Checklist</CardTitle>
          <CardDescription>
            Escolha como você deseja criar ou importar seu checklist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload CSV</TabsTrigger>
              <TabsTrigger value="paste">Colar CSV</TabsTrigger>
              <TabsTrigger value="ai">Gerar com IA</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="mb-4">Arraste e solte seu arquivo CSV aqui ou clique para selecionar</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar Arquivo
                    </span>
                  </Button>
                </label>
                <div className="mt-4">
                  <Button variant="outline" onClick={downloadSample}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Modelo CSV
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-paste">Cole os dados CSV aqui</Label>
                <Textarea
                  id="csv-paste"
                  rows={10}
                  value={csvData}
                  onChange={(e) => {
                    setCsvData(e.target.value);
                    if (e.target.value.trim()) parseCSV(e.target.value);
                  }}
                  className="font-mono text-sm"
                  placeholder="campo,tipo,obrigatorio,opcoes,descricao
Nome,text,sim,,Nome do responsável
Data,date,sim,,Data da inspeção
..."
                />
              </div>
              <Button variant="outline" onClick={downloadSample}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Modelo CSV
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertTitle>Assistente IA para CSV</AlertTitle>
                <AlertDescription>
                  Descreva o checklist que você precisa e a IA irá gerar o formato CSV automaticamente
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">Descreva seu checklist</Label>
                <Textarea
                  id="ai-prompt"
                  rows={6}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Preciso de um checklist para inspeção de segurança em canteiro de obras, incluindo verificação de EPIs, condições do local, equipamentos de proteção coletiva, sinalização, e riscos específicos como trabalho em altura e eletricidade..."
                />
              </div>

              <Button 
                onClick={() => aiGenerateMutation.mutate()}
                disabled={!aiPrompt || aiGenerateMutation.isPending}
              >
                {aiGenerateMutation.isPending ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Gerando CSV...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar CSV com IA
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              CSV Processado ({preview.length} campos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {preview.slice(0, 5).map((field, index) => (
                <div key={index} className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {field.name}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tipo: {fieldTypeMap[field.type] || field.type}
                      </p>
                      {field.description && (
                        <p className="text-sm mt-1">{field.description}</p>
                      )}
                      {field.options && field.options.length > 0 && (
                        <p className="text-sm mt-1">
                          Opções: {field.options.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {preview.length > 5 && (
                <p className="text-center text-muted-foreground">
                  ... e mais {preview.length - 5} campos
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCsvData('');
                  setPreview([]);
                }}
              >
                Limpar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!templateName || !category || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Importar Template
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field Types Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Campo Suportados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {Object.entries(fieldTypeMap).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <code className="px-2 py-1 bg-secondary rounded text-xs">{key}</code>
                <span className="text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Para campos com opções (select, radio, multiselect), separe as opções com pipe (|).
              Exemplo: "Bom|Regular|Ruim"
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}