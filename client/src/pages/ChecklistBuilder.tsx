import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, 
  FileText, List, CheckSquare, Radio, Calendar, Clock,
  Hash, Star, Upload, MapPin, PenTool, ToggleLeft,
  Type, AlignLeft, ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ChecklistField {
  id: string;
  type: string;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  order: number;
}

const fieldTypes = [
  { value: 'text', label: 'Texto Curto', icon: Type },
  { value: 'textarea', label: 'Texto Longo', icon: AlignLeft },
  { value: 'select', label: 'Lista Suspensa', icon: List },
  { value: 'multiselect', label: 'Múltipla Escolha', icon: CheckSquare },
  { value: 'radio', label: 'Escolha Única', icon: Radio },
  { value: 'checkbox', label: 'Caixa de Seleção', icon: CheckSquare },
  { value: 'boolean', label: 'Sim/Não', icon: ToggleLeft },
  { value: 'date', label: 'Data', icon: Calendar },
  { value: 'time', label: 'Hora', icon: Clock },
  { value: 'datetime', label: 'Data e Hora', icon: Calendar },
  { value: 'number', label: 'Número', icon: Hash },
  { value: 'rating', label: 'Avaliação (1-5)', icon: Star },
  { value: 'file', label: 'Upload de Arquivo', icon: Upload },
  { value: 'signature', label: 'Assinatura Digital', icon: PenTool },
  { value: 'location', label: 'Localização GPS', icon: MapPin }
];

export default function ChecklistBuilder() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [templateInfo, setTemplateInfo] = useState({
    name: '',
    description: '',
    category: '',
    tags: [] as string[]
  });
  
  const [fields, setFields] = useState<ChecklistField[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const addField = (type: string) => {
    const newField: ChecklistField = {
      id: Date.now().toString(),
      type,
      label: `Nova Pergunta`,
      required: false,
      options: type === 'select' || type === 'multiselect' || type === 'radio' ? ['Opção 1'] : undefined,
      order: fields.length
    };
    setFields([...fields, newField]);
    setEditingField(newField.id);
  };

  const updateField = (id: string, updates: Partial<ChecklistField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const duplicateField = (field: ChecklistField) => {
    const newField = {
      ...field,
      id: Date.now().toString(),
      label: `${field.label} (Cópia)`,
      order: fields.length
    };
    setFields([...fields, newField]);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < fields.length) {
      [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
      setFields(newFields.map((f, i) => ({ ...f, order: i })));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/checklist-templates', {
        method: 'POST',
        body: JSON.stringify({
          ...templateInfo,
          fields: fields.map(({ id, ...field }) => field)
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Checklist Criado!",
        description: `Template "${data.name}" salvo com sucesso.`
      });
      navigate(`/checklists/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erro ao Salvar",
        description: error.message || "Falha ao criar checklist",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    if (!templateInfo.name || !templateInfo.category || fields.length === 0) {
      toast({
        title: "Dados Incompletos",
        description: "Preencha as informações do template e adicione pelo menos um campo.",
        variant: "destructive"
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/checklists')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Criar Checklist Manual</h1>
            <p className="text-muted-foreground">
              Construa seu checklist personalizado com campos no estilo Google Forms
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreview(!preview)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {preview ? 'Editar' : 'Visualizar'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar Template
          </Button>
        </div>
      </div>

      {!preview ? (
        <>
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
                  value={templateInfo.name}
                  onChange={(e) => setTemplateInfo({ ...templateInfo, name: e.target.value })}
                  placeholder="Ex: Inspeção de Segurança Diária"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Input
                  id="category"
                  value={templateInfo.category}
                  onChange={(e) => setTemplateInfo({ ...templateInfo, category: e.target.value })}
                  placeholder="Ex: Segurança, EPIs, Equipamentos"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={templateInfo.description}
                  onChange={(e) => setTemplateInfo({ ...templateInfo, description: e.target.value })}
                  placeholder="Descreva o objetivo e uso deste checklist..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Field Builder */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Field Types Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Tipos de Campo</CardTitle>
                <CardDescription>
                  Clique para adicionar um novo campo
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {fieldTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      variant="outline"
                      className="justify-start"
                      onClick={() => addField(type.value)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span className="text-xs">{type.label}</span>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Fields List */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Campos do Checklist</CardTitle>
                <CardDescription>
                  {fields.length} {fields.length === 1 ? 'campo' : 'campos'} adicionados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum campo adicionado ainda</p>
                    <p className="text-sm">Selecione um tipo de campo à esquerda para começar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, index) => {
                      const fieldType = fieldTypes.find(t => t.value === field.type);
                      const Icon = fieldType?.icon || FileText;
                      const isEditing = editingField === field.id;

                      return (
                        <Card key={field.id} className={cn(
                          "transition-all",
                          isEditing && "ring-2 ring-blue-500"
                        )}>
                          <CardContent className="pt-4">
                            {/* Field Header */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-1">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {isEditing ? (
                                  <Input
                                    value={field.label}
                                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                                    className="flex-1"
                                    placeholder="Pergunta"
                                  />
                                ) : (
                                  <p className="flex-1 font-medium">
                                    {field.label}
                                    {field.required && <span className="text-destructive ml-1">*</span>}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {index > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => moveField(index, 'up')}
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                )}
                                {index < fields.length - 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => moveField(index, 'down')}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => duplicateField(field)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => deleteField(field.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Field Content */}
                            {isEditing ? (
                              <div className="space-y-3">
                                <div>
                                  <Label>Descrição</Label>
                                  <Input
                                    value={field.description || ''}
                                    onChange={(e) => updateField(field.id, { description: e.target.value })}
                                    placeholder="Descrição opcional do campo"
                                  />
                                </div>

                                {/* Options for select/radio/multiselect */}
                                {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && (
                                  <div>
                                    <Label>Opções</Label>
                                    {field.options?.map((option, i) => (
                                      <div key={i} className="flex gap-2 mt-2">
                                        <Input
                                          value={option}
                                          onChange={(e) => {
                                            const newOptions = [...(field.options || [])];
                                            newOptions[i] = e.target.value;
                                            updateField(field.id, { options: newOptions });
                                          }}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            const newOptions = field.options?.filter((_, idx) => idx !== i);
                                            updateField(field.id, { options: newOptions });
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2"
                                      onClick={() => {
                                        const newOptions = [...(field.options || []), `Opção ${(field.options?.length || 0) + 1}`];
                                        updateField(field.id, { options: newOptions });
                                      }}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Adicionar Opção
                                    </Button>
                                  </div>
                                )}

                                {/* Number range */}
                                {field.type === 'number' && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label>Mínimo</Label>
                                      <Input
                                        type="number"
                                        value={field.min || ''}
                                        onChange={(e) => updateField(field.id, { min: parseInt(e.target.value) })}
                                      />
                                    </div>
                                    <div>
                                      <Label>Máximo</Label>
                                      <Input
                                        type="number"
                                        value={field.max || ''}
                                        onChange={(e) => updateField(field.id, { max: parseInt(e.target.value) })}
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={field.required}
                                      onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                                    />
                                    <Label>Obrigatório</Label>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => setEditingField(null)}
                                  >
                                    Concluir
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer"
                                onClick={() => setEditingField(field.id)}
                              >
                                {field.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{field.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Tipo: {fieldType?.label} • Clique para editar
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* Preview Mode */
        <Card>
          <CardHeader>
            <CardTitle>{templateInfo.name || 'Preview do Checklist'}</CardTitle>
            <CardDescription>{templateInfo.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field) => {
                const fieldType = fieldTypes.find(t => t.value === field.type);
                const Icon = fieldType?.icon || FileText;

                return (
                  <div key={field.id} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    )}
                    
                    {/* Render field preview based on type */}
                    {field.type === 'text' && <Input placeholder={field.placeholder} disabled />}
                    {field.type === 'textarea' && <Textarea placeholder={field.placeholder} disabled />}
                    {field.type === 'select' && (
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === 'checkbox' && (
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" disabled className="h-4 w-4" />
                        <span className="text-sm">Marque para confirmar</span>
                      </div>
                    )}
                    {field.type === 'radio' && (
                      <div className="space-y-2">
                        {field.options?.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <input type="radio" name={field.id} disabled className="h-4 w-4" />
                            <span className="text-sm">{option}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {field.type === 'multiselect' && (
                      <div className="space-y-2">
                        {field.options?.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <input type="checkbox" disabled className="h-4 w-4" />
                            <span className="text-sm">{option}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {field.type === 'date' && <Input type="date" disabled />}
                    {field.type === 'time' && <Input type="time" disabled />}
                    {field.type === 'datetime' && <Input type="datetime-local" disabled />}
                    {field.type === 'number' && (
                      <Input 
                        type="number" 
                        min={field.min} 
                        max={field.max} 
                        disabled 
                      />
                    )}
                    {field.type === 'rating' && (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className="h-6 w-6 text-muted-foreground" />
                        ))}
                      </div>
                    )}
                    {field.type === 'boolean' && (
                      <div className="flex items-center space-x-2">
                        <Switch disabled />
                        <span className="text-sm">Sim/Não</span>
                      </div>
                    )}
                    {field.type === 'file' && (
                      <Button variant="outline" disabled>
                        <Upload className="mr-2 h-4 w-4" />
                        Selecionar Arquivo
                      </Button>
                    )}
                    {field.type === 'signature' && (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                        <PenTool className="h-8 w-8 mx-auto mb-2" />
                        Área de Assinatura
                      </div>
                    )}
                    {field.type === 'location' && (
                      <Button variant="outline" disabled>
                        <MapPin className="mr-2 h-4 w-4" />
                        Capturar Localização
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}