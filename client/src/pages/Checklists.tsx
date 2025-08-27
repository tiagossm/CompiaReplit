import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckSquare, Plus, Edit, Trash2, Copy, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  organizationId: string;
  items: ChecklistItem[];
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItem {
  id: string;
  item: string;
  standard?: string;
  category?: string;
  description?: string;
  isRequired: boolean;
}

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "nr-06", label: "NR-06 - EPI" },
  { value: "nr-10", label: "NR-10 - Elétrica" },
  { value: "nr-12", label: "NR-12 - Máquinas" },
  { value: "nr-17", label: "NR-17 - Ergonomia" },
  { value: "nr-23", label: "NR-23 - Incêndio" },
  { value: "nr-26", label: "NR-26 - Sinalização" },
  { value: "nr-33", label: "NR-33 - Espaços Confinados" }
];

export default function Checklists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);

  const { data: templates, isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ['/api/checklist-templates', selectedCategory === "todos" ? {} : { category: selectedCategory }],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/checklist-templates', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checklist-templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast({
        title: "Sucesso",
        description: "Template criado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar template",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/checklist-templates/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checklist-templates'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      toast({
        title: "Sucesso",
        description: "Template atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar template",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/checklist-templates/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checklist-templates'] });
      toast({
        title: "Sucesso",
        description: "Template excluído com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir template",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates?.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const canCreateTemplates = hasPermission(user, 'create_inspection');
  const canManageTemplates = hasPermission(user, 'manage_organization');

  return (
    <div className="p-6 space-y-6" data-testid="checklists-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates de Checklist</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie templates reutilizáveis para suas inspeções de segurança
          </p>
        </div>
        {canCreateTemplates && (
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-compia-blue hover:bg-compia-blue/90" data-testid="create-template">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <ChecklistTemplateDialog
                template={editingTemplate}
                onSubmit={(data) => {
                  if (editingTemplate) {
                    updateMutation.mutate({ id: editingTemplate.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
              />
            </Dialog>
            <a href="/checklists/import">
              <Button variant="outline" data-testid="import-csv">
                Importar CSV
              </Button>
            </a>
            <a href="/checklists/ai-generate">
              <Button variant="outline" data-testid="ai-generate">
                Gerar com IA
              </Button>
            </a>
            <a href="/checklists/new">
              <Button variant="outline" data-testid="builder">
                Construtor Manual
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-templates"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48" data-testid="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as categorias</SelectItem>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded mb-4 w-2/3" />
                <div className="h-6 bg-muted rounded mb-3 w-1/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm 
                ? "Nenhum template corresponde aos seus critérios de busca."
                : "Crie seu primeiro template de checklist para começar."
              }
            </p>
            {canCreateTemplates && !searchTerm && (
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="bg-compia-blue hover:bg-compia-blue/90"
                data-testid="create-first-template"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow" data-testid={`template-card-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`template-name-${template.id}`}>
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`template-description-${template.id}`}>
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge 
                      className="bg-compia-blue/10 text-compia-blue text-xs"
                      data-testid={`template-category-${template.id}`}
                    >
                      {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                    </Badge>
                    {template.isDefault && (
                      <Badge className="bg-compia-green/10 text-compia-green text-xs">
                        Padrão
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground" data-testid={`template-items-count-${template.id}`}>
                    <strong>{template.items.length}</strong> itens de verificação
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {template.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                        data-testid={`template-item-preview-${item.id}`}
                      >
                        <CheckSquare className="w-3 h-3" />
                        {item.item.length > 25 ? `${item.item.slice(0, 25)}...` : item.item}
                      </div>
                    ))}
                    {template.items.length > 3 && (
                      <div className="text-xs text-muted-foreground px-2 py-1">
                        +{template.items.length - 3} mais
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTemplate(template);
                          setIsDialogOpen(true);
                        }}
                        data-testid={`edit-template-${template.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const copy = {
                            ...template,
                            name: `${template.name} (Cópia)`,
                            isDefault: false
                          };
                          delete (copy as any).id;
                          createMutation.mutate(copy);
                        }}
                        data-testid={`copy-template-${template.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    {canManageTemplates && !template.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Confirma a exclusão do template "${template.name}"?`)) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-template-${template.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChecklistTemplateDialogProps {
  template?: ChecklistTemplate | null;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

function ChecklistTemplateDialog({ template, onSubmit, isSubmitting }: ChecklistTemplateDialogProps) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [category, setCategory] = useState(template?.category || "geral");
  const [items, setItems] = useState<ChecklistItem[]>(template?.items || [
    { id: "1", item: "", standard: "", category: "", isRequired: false }
  ]);

  const addItem = () => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      item: "",
      standard: "",
      category: "",
      isRequired: false
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ChecklistItem>) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    const validItems = items.filter(item => item.item.trim());
    if (validItems.length === 0) {
      alert("Adicione pelo menos um item ao checklist");
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category,
      items: validItems
    });
  };

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {template ? "Editar Template" : "Novo Template de Checklist"}
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Template *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Checklist NR-06 - EPIs"
              data-testid="template-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="template-category-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o propósito deste template..."
            rows={3}
            data-testid="template-description-input"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Itens do Checklist</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              data-testid="add-checklist-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3" data-testid={`checklist-item-${index}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      placeholder="Item de verificação *"
                      value={item.item}
                      onChange={(e) => updateItem(item.id, { item: e.target.value })}
                      data-testid={`item-text-${index}`}
                    />
                    <Input
                      placeholder="NR aplicável (ex: NR-06)"
                      value={item.standard || ""}
                      onChange={(e) => updateItem(item.id, { standard: e.target.value })}
                      data-testid={`item-standard-${index}`}
                    />
                    <Input
                      placeholder="Categoria"
                      value={item.category || ""}
                      onChange={(e) => updateItem(item.id, { category: e.target.value })}
                      data-testid={`item-category-${index}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    data-testid={`remove-item-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`required-${item.id}`}
                    checked={item.isRequired}
                    onChange={(e) => updateItem(item.id, { isRequired: e.target.checked })}
                    data-testid={`item-required-${index}`}
                  />
                  <Label htmlFor={`required-${item.id}`} className="text-sm">
                    Item obrigatório
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setName("");
              setDescription("");
              setCategory("geral");
              setItems([{ id: "1", item: "", standard: "", category: "", isRequired: false }]);
            }}
            data-testid="cancel-template"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-compia-blue hover:bg-compia-blue/90"
            data-testid="save-template"
          >
            {isSubmitting ? "Salvando..." : template ? "Atualizar" : "Criar Template"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}