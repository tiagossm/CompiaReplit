import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Brain,
  Upload,
  Download,
  Copy,
  Edit,
  Trash2,
  Eye,
  Users,
  Lock,
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  Shield,
  BookOpen,
  Settings,
  Leaf,
  Award,
  Cog,
  HardHat,
  Mountain,
  ShieldCheck,
  UserCheck,
  ArrowLeft,
  FolderPlus
} from 'lucide-react';

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_public: boolean;
  is_category_folder?: boolean;
  folder_icon?: string;
  folder_color?: string;
  parent_folder_id?: string;
  created_at: string;
  updated_at: string;
  fields_count?: number;
}

interface CategoryFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export default function ChecklistTemplates() {
  const [, setLocation] = useLocation();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<CategoryFolder[]>([]);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    icon: 'folder',
    color: 'blue'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      console.log('[TEMPLATES] [REACT] Buscando templates...');
      const response = await fetch('/api/checklist-templates');
      if (response.ok) {
        const data = await response.json();
        console.log('[TEMPLATES] [REACT] Templates recebidos:', data.length || 0);
        setTemplates(data || []);
      } else {
        console.error('[TEMPLATES] [REACT] Erro na resposta:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[TEMPLATES] [REACT] Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este checklist?')) return;
    
    try {
      const response = await fetch(`/api/checklist-templates/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Erro ao excluir template:', error);
    }
  };

  const duplicateTemplate = async (template: ChecklistTemplate) => {
    try {
      const response = await fetch(`/api/checklist-templates/${template.id}/duplicate`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchTemplates();
        alert(`Checklist "${template.name}" duplicado com sucesso!`);
      }
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
    }
  };

  const handleExportTemplates = async () => {
    setCsvLoading(true);
    try {
      const csvData = templates.filter(t => !t.is_category_folder).map(template => ({
        nome: template.name,
        categoria: template.category || '',
        descricao: template.description || '',
        publico: template.is_public ? 'Sim' : 'Não',
        campos: template.fields_count || 0,
        criado_em: new Date(template.created_at).toLocaleDateString('pt-BR')
      }));

      const headers = 'nome,categoria,descricao,publico,campos,criado_em';
      const csvContent = [
        headers,
        ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `checklists_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao exportar templates:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    setCategoryLoading(true);
    try {
      const response = await fetch('/api/checklist-templates/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategoryData,
          is_category_folder: true,
          parent_folder_id: currentFolder
        })
      });

      if (response.ok) {
        await fetchTemplates();
        setShowNewCategoryModal(false);
        setNewCategoryData({ name: '', icon: 'folder', color: 'blue' });
      } else {
        throw new Error('Failed to create category');
      }
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      alert('Erro ao criar categoria. Tente novamente.');
    } finally {
      setCategoryLoading(false);
    }
  };

  // Get folder icon component
  const getFolderIcon = (iconName: string, className: string = "w-5 h-5") => {
    const iconMap: Record<string, any> = {
      'shield': Shield,
      'book-open': BookOpen,
      'settings': Settings,
      'leaf': Leaf,
      'award': Award,
      'cog': Cog,
      'hard-hat': HardHat,
      'mountain': Mountain,
      'shield-check': ShieldCheck,
      'user-check': UserCheck,
      'folder': Folder,
      'folder-open': FolderOpen
    };
    
    const IconComponent = iconMap[iconName] || Folder;
    return <IconComponent className={className} />;
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFolder = currentFolder ? 
      template.parent_folder_id === currentFolder : 
      !template.parent_folder_id;
    
    return matchesSearch && matchesFolder;
  });

  const folders = filteredTemplates.filter(t => t.is_category_folder);
  const items = filteredTemplates.filter(t => !t.is_category_folder);

  if (loading) {
    return (
      <div className="p-6" data-testid="templates-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="checklist-templates-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-compia-blue">
            Checklists de Inspeção
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus checklists e modelos de inspeção
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleExportTemplates}
            disabled={csvLoading || templates.length === 0}
            data-testid="export-templates"
          >
            <Download className="w-4 h-4 mr-2" />
            {csvLoading ? 'Exportando...' : 'Exportar'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setLocation('/checklists/import')}
            data-testid="import-csv"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setLocation('/checklists/ai-generator')}
            data-testid="ai-generator"
          >
            <Brain className="w-4 h-4 mr-2" />
            Gerar com IA
          </Button>
          
          <Button
            onClick={() => setLocation('/checklists/new')}
            className="bg-compia-blue hover:bg-compia-blue/90"
            data-testid="new-template"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Checklist
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar checklists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-templates"
          />
        </div>
        
        <Button
          variant="outline"
          onClick={() => setShowNewCategoryModal(true)}
          data-testid="new-category"
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          Nova Pasta
        </Button>
      </div>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center space-x-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentFolder(null);
              setBreadcrumb([]);
            }}
          >
            <Folder className="w-4 h-4 mr-1" />
            Raiz
          </Button>
          {breadcrumb.map((folder, index) => (
            <div key={folder.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentFolder(folder.id);
                  setBreadcrumb(breadcrumb.slice(0, index + 1));
                }}
              >
                {getFolderIcon(folder.icon, "w-4 h-4 mr-1")}
                {folder.name}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Folders Grid */}
      {folders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <Card
              key={folder.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setCurrentFolder(folder.id);
                setBreadcrumb([...breadcrumb, {
                  id: folder.id,
                  name: folder.name,
                  icon: folder.folder_icon || 'folder',
                  color: folder.folder_color || 'blue'
                }]);
              }}
              data-testid={`folder-${folder.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  {getFolderIcon(folder.folder_icon || 'folder', "w-12 h-12 text-compia-blue")}
                  <h3 className="font-semibold">{folder.name}</h3>
                  {folder.description && (
                    <p className="text-sm text-muted-foreground">
                      {folder.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow" data-testid={`template-${template.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.category && (
                    <Badge variant="secondary" className="mt-2">
                      {template.category}
                    </Badge>
                  )}
                </div>
                <Badge variant={template.is_public ? "default" : "secondary"}>
                  {template.is_public ? (
                    <><Users className="w-3 h-3 mr-1" /> Público</>
                  ) : (
                    <><Lock className="w-3 h-3 mr-1" /> Privado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {template.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description}
                </p>
              )}
              
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span className="flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  {template.fields_count || 0} campos
                </span>
                <span>
                  {new Date(template.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/checklists/${template.id}`)}
                  data-testid={`view-template-${template.id}`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/checklists/${template.id}/edit`)}
                  data-testid={`edit-template-${template.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => duplicateTemplate(template)}
                  data-testid={`duplicate-template-${template.id}`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteTemplate(template.id)}
                  data-testid={`delete-template-${template.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhum checklist encontrado</h2>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 
              'Tente ajustar sua busca ou criar um novo checklist.' :
              'Comece criando seu primeiro checklist de inspeção.'
            }
          </p>
          <Button
            onClick={() => setLocation('/checklists/new')}
            className="bg-compia-blue hover:bg-compia-blue/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Checklist
          </Button>
        </div>
      )}

      {/* New Category Modal */}
      <Dialog open={showNewCategoryModal} onOpenChange={setShowNewCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Pasta de Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nome da Pasta
              </label>
              <Input
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                placeholder="Ex: NR-10 - Elétrica"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Ícone
              </label>
              <div className="grid grid-cols-6 gap-2">
                {['shield', 'book-open', 'settings', 'leaf', 'award', 'hard-hat'].map(icon => (
                  <Button
                    key={icon}
                    variant={newCategoryData.icon === icon ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewCategoryData({ ...newCategoryData, icon })}
                  >
                    {getFolderIcon(icon, "w-4 h-4")}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Cor
              </label>
              <div className="grid grid-cols-6 gap-2">
                {['blue', 'green', 'yellow', 'red', 'purple', 'gray'].map(color => (
                  <Button
                    key={color}
                    variant={newCategoryData.color === color ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewCategoryData({ ...newCategoryData, color })}
                    className={`bg-${color}-500 hover:bg-${color}-600`}
                  >
                    <div className={`w-4 h-4 bg-${color}-500 rounded`} />
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategoryModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCategory}
              disabled={!newCategoryData.name || categoryLoading}
              className="bg-compia-blue hover:bg-compia-blue/90"
            >
              {categoryLoading ? 'Criando...' : 'Criar Pasta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}