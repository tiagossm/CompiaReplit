import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  GripVertical,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface ChecklistField {
  field_name: string;
  field_type: string;
  is_required: boolean;
  options: string;
  order_index: number;
}

export default function ChecklistEdit() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    category: '',
    is_public: false
  });
  
  const [fields, setFields] = useState<ChecklistField[]>([]);

  const fieldTypes = [
    { value: 'text', label: 'Texto Curto' },
    { value: 'textarea', label: 'Texto Longo' },
    { value: 'select', label: 'Lista Suspensa' },
    { value: 'multiselect', label: 'Múltipla Escolha' },
    { value: 'radio', label: 'Escolha Única' },
    { value: 'checkbox', label: 'Caixa de Seleção' },
    { value: 'boolean', label: 'Conforme/Não Conforme' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Data' },
    { value: 'time', label: 'Hora' },
    { value: 'rating', label: 'Avaliação (1-5)' },
    { value: 'file', label: 'Anexo de Arquivo' },
    { value: 'photo', label: 'Foto' },
    { value: 'signature', label: 'Assinatura' }
  ];

  const categories = [
    'NR-01 - Disposições Gerais',
    'NR-05 - CIPA',
    'NR-06 - EPIs',
    'NR-07 - PCMSO',
    'NR-09 - Riscos Ambientais',
    'NR-10 - Elétrica',
    'NR-11 - Movimentação de Cargas',
    'NR-12 - Máquinas e Equipamentos',
    'NR-15 - Insalubridade',
    'NR-16 - Periculosidade',
    'NR-17 - Ergonomia',
    'NR-18 - Construção Civil',
    'NR-23 - Proteção Contra Incêndios',
    'NR-24 - Condições Sanitárias',
    'NR-35 - Trabalho em Altura',
    'Geral - Segurança',
    'Ambiental',
    'Qualidade',
    'Outro'
  ];

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/checklist-templates/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate({
          name: data.name,
          description: data.description || '',
          category: data.category || '',
          is_public: data.is_public || false
        });
        
        // Convert items to fields format
        if (data.items && Array.isArray(data.items)) {
          const convertedFields = data.items.map((item: any, index: number) => ({
            field_name: item.label,
            field_type: item.type === 'checkbox' ? 'boolean' : item.type,
            is_required: item.required || false,
            options: item.options ? item.options.join(', ') : '',
            order_index: index
          }));
          setFields(convertedFields);
        } else {
          setFields([{
            field_name: '',
            field_type: 'text',
            is_required: false,
            options: '',
            order_index: 0
          }]);
        }
      } else {
        console.error('Template não encontrado');
        setLocation('/checklists');
      }
    } catch (error) {
      console.error('Erro ao carregar template:', error);
      setLocation('/checklists');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert fields to items format
      const items = fields.filter(f => f.field_name).map(field => ({
        type: field.field_type === 'boolean' ? 'checkbox' : field.field_type,
        label: field.field_name,
        required: field.is_required || false,
        options: field.options ? field.options.split(',').map(o => o.trim()) : undefined
      }));

      const response = await fetch(`/api/checklist-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          items
        })
      });

      if (!response.ok) throw new Error('Erro ao atualizar template');
      
      alert('Template atualizado com sucesso!');
      setLocation('/checklists');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao atualizar template. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([...fields, {
      field_name: '',
      field_type: 'text',
      is_required: false,
      options: '',
      order_index: fields.length
    }]);
  };

  const removeField = (index: number) => {
    if (fields.length === 1) {
      alert('Você precisa ter pelo menos um campo no checklist');
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<ChecklistField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < fields.length) {
      [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
      
      // Update order indices
      newFields.forEach((field, i) => {
        field.order_index = i;
      });
      
      setFields(newFields);
    }
  };

  const needsOptions = (fieldType: string) => {
    return ['select', 'multiselect', 'radio'].includes(fieldType);
  };

  if (fetching) {
    return (
      <div className="p-6" data-testid="edit-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="edit-checklist-template-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => setLocation('/checklists')}
          data-testid="back-to-templates"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-heading font-bold text-compia-blue">
            Editar Template de Checklist
          </h1>
          <p className="text-muted-foreground mt-1">
            Atualize as configurações do template
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  required
                  value={template.name}
                  onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                  placeholder="Ex: Checklist de EPIs"
                  data-testid="template-name"
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select 
                  value={template.category} 
                  onValueChange={(value) => setTemplate({ ...template, category: value })}
                  required
                >
                  <SelectTrigger id="category" data-testid="template-category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={template.description}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                placeholder="Descreva o objetivo deste template..."
                rows={3}
                data-testid="template-description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="public"
                checked={template.is_public}
                onCheckedChange={(checked) => 
                  setTemplate({ ...template, is_public: checked as boolean })
                }
                data-testid="template-public"
              />
              <Label 
                htmlFor="public" 
                className="text-sm font-normal cursor-pointer"
              >
                Template público (visível para todas as organizações)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Fields Configuration */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Campos do Checklist</CardTitle>
              <Button
                type="button"
                onClick={addField}
                variant="outline"
                size="sm"
                data-testid="add-field"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Campo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Campo {index + 1}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveField(index, 'up')}
                        disabled={index === 0}
                        data-testid={`move-up-${index}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveField(index, 'down')}
                        disabled={index === fields.length - 1}
                        data-testid={`move-down-${index}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeField(index)}
                        data-testid={`remove-field-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome do Campo *</Label>
                      <Input
                        value={field.field_name}
                        onChange={(e) => updateField(index, { field_name: e.target.value })}
                        placeholder="Ex: Nome do EPI"
                        required
                        data-testid={`field-name-${index}`}
                      />
                    </div>

                    <div>
                      <Label>Tipo de Campo *</Label>
                      <Select
                        value={field.field_type}
                        onValueChange={(value) => updateField(index, { field_type: value })}
                      >
                        <SelectTrigger data-testid={`field-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`required-${index}`}
                          checked={field.is_required}
                          onCheckedChange={(checked) => 
                            updateField(index, { is_required: checked as boolean })
                          }
                          data-testid={`field-required-${index}`}
                        />
                        <Label 
                          htmlFor={`required-${index}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          Campo obrigatório
                        </Label>
                      </div>
                    </div>
                  </div>

                  {needsOptions(field.field_type) && (
                    <div>
                      <Label>Opções (separadas por vírgula) *</Label>
                      <Input
                        value={field.options}
                        onChange={(e) => updateField(index, { options: e.target.value })}
                        placeholder="Ex: Capacete, Óculos, Luvas, Botas"
                        required={needsOptions(field.field_type)}
                        data-testid={`field-options-${index}`}
                      />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/checklists')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || !template.name || !template.category}
            className="bg-compia-blue hover:bg-compia-blue/90"
            data-testid="save-template"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </div>
  );
}