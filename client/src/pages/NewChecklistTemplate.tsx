import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
  ChevronDown,
  Folder,
  FolderPlus
} from 'lucide-react';

interface ChecklistField {
  field_name: string;
  field_type: string;
  is_required: boolean;
  options: string;
  order_index: number;
}

export default function NewChecklistTemplate() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    category: '',
    is_public: false,
    parent_folder_id: ''
  });
  
  const [folders, setFolders] = useState<any[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [fields, setFields] = useState<ChecklistField[]>([
    {
      field_name: '',
      field_type: 'text',
      is_required: false,
      options: '',
      order_index: 0
    }
  ]);

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
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/checklist-templates');
      if (response.ok) {
        const data = await response.json();
        const foldersList = data.filter((t: any) => t.is_category_folder);
        setFolders(foldersList);
      }
    } catch (error) {
      console.error('Erro ao buscar pastas:', error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const response = await fetch('/api/checklist-templates/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName,
          icon: 'folder',
          color: 'blue'
        })
      });
      
      if (response.ok) {
        await fetchFolders();
        setNewFolderName('');
        setShowCreateFolder(false);
      }
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create template with fields
      const response = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          fields: fields.filter(f => f.field_name), // Only include fields with names
          parent_folder_id: template.parent_folder_id || null
        })
      });

      if (!response.ok) throw new Error('Erro ao criar checklist');
      
      const result = await response.json();
      alert(`Checklist "${result.name}" criado com sucesso!`);
      setLocation('/checklists');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao criar template. Tente novamente.');
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="new-checklist-template-page">
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
            Novo Checklist de Inspeção
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie um checklist personalizado para suas inspeções
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Checklist *</Label>
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

            {/* Folder Selection */}
            <div>
              <Label htmlFor="folder">Pasta (Opcional)</Label>
              <div className="flex gap-2">
                <Select 
                  value={template.parent_folder_id} 
                  onValueChange={(value) => setTemplate({...template, parent_folder_id: value})}
                >
                  <SelectTrigger id="folder" data-testid="template-folder" className="flex-1">
                    <SelectValue placeholder="Selecione uma pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem pasta</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4" />
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateFolder(!showCreateFolder)}
                  data-testid="create-folder-btn"
                >
                  <FolderPlus className="w-4 h-4" />
                </Button>
              </div>
              
              {showCreateFolder && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Nome da nova pasta"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    data-testid="new-folder-name"
                    className="flex-1"
                  />
                  <Button type="button" size="sm" onClick={createFolder}>
                    Criar
                  </Button>
                  <Button 
                    type="button" 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
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
                Checklist público (visível para todas as organizações)
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
            {loading ? 'Salvando...' : 'Salvar Template'}
          </Button>
        </div>
      </form>
    </div>
  );
}