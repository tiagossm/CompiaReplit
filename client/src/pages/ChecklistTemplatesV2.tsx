import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  created_by?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  parent_category_id?: string;
  category_path?: string;
  is_category_folder?: boolean;
  folder_color?: string;
  folder_icon?: string;
  display_order?: number;
  field_count?: number;
}

interface CategoryFolder extends ChecklistTemplate {
  children: (ChecklistTemplate | CategoryFolder)[];
  template_count: number;
  is_category_folder: true;
}

export default function ChecklistTemplatesV2() {
  const [, navigate] = useLocation();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<CategoryFolder[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/checklist-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get folder icon component
  const getFolderIcon = (iconName: string = 'folder', className: string = "w-5 h-5") => {
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
      'file-text': FileText
    };
    
    const IconComponent = iconMap[iconName] || Folder;
    return <IconComponent className={className} />;
  };

  // Build folder hierarchy
  const buildHierarchy = (): CategoryFolder[] => {
    const folders = templates.filter(t => t.is_category_folder).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const regularTemplates = templates.filter(t => !t.is_category_folder);
    
    const rootFolders: CategoryFolder[] = [];
    
    folders.forEach(folder => {
      const categoryFolder: CategoryFolder = {
        ...folder,
        children: [],
        template_count: 0,
        is_category_folder: true
      };
      
      if (!folder.parent_category_id) {
        rootFolders.push(categoryFolder);
      }
    });
    
    // Add subfolders to their parents
    folders.forEach(folder => {
      if (folder.parent_category_id) {
        const parentFolder = findFolderInHierarchy(rootFolders, folder.parent_category_id);
        if (parentFolder) {
          parentFolder.children.push({
            ...folder,
            children: [],
            template_count: 0,
            is_category_folder: true
          } as CategoryFolder);
        }
      }
    });
    
    // Add templates to their folders
    regularTemplates.forEach(template => {
      if (template.parent_category_id) {
        const parentFolder = findFolderInHierarchy(rootFolders, template.parent_category_id);
        if (parentFolder) {
          parentFolder.children.push(template);
          parentFolder.template_count++;
        }
      }
    });
    
    return rootFolders;
  };

  const findFolderInHierarchy = (folders: CategoryFolder[], id: string): CategoryFolder | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolderInHierarchy(folder.children.filter(c => 'children' in c) as CategoryFolder[], id);
      if (found) return found;
    }
    return null;
  };

  const enterFolder = (folder: CategoryFolder) => {
    setCurrentFolder(folder.id);
    setBreadcrumb([...breadcrumb, folder]);
  };

  const goBack = () => {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = [...breadcrumb];
      newBreadcrumb.pop();
      setBreadcrumb(newBreadcrumb);
      setCurrentFolder(newBreadcrumb.length > 0 ? newBreadcrumb[newBreadcrumb.length - 1].id : null);
    } else {
      setCurrentFolder(null);
    }
  };

  const hierarchy = buildHierarchy();
  
  // Filter templates based on current folder and search
  const getDisplayItems = () => {
    if (currentFolder) {
      const folder = findFolderInHierarchy(hierarchy, currentFolder);
      if (folder) {
        return folder.children.filter(item => {
          if ('is_category_folder' in item && item.is_category_folder) {
            return item.name.toLowerCase().includes(searchTerm.toLowerCase());
          } else {
            return item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   item.category.toLowerCase().includes(searchTerm.toLowerCase());
          }
        });
      }
      return [];
    }
    
    // Root level - show both folders and ungrouped templates
    const rootItems = [
      ...hierarchy.filter(folder => 
        folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        folder.description?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
      ...templates.filter(t => !t.is_category_folder && !t.parent_category_id && (
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    ];
    
    return rootItems;
  };

  const displayItems = getDisplayItems();

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {currentFolder && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Templates de Checklist</h1>
            <p className="text-muted-foreground mt-1">
              Organize seus templates em pastas hierárquicas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/checklists/csv-import')}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate('/checklists/ai-generator')}
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <Brain className="w-4 h-4 mr-2" />
            Gerar com IA
          </Button>
          
          <Button
            onClick={() => navigate('/checklists/builder')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBreadcrumb([]);
              setCurrentFolder(null);
            }}
            className="h-6 px-2 text-xs"
          >
            Início
          </Button>
          {breadcrumb.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newBreadcrumb = breadcrumb.slice(0, index + 1);
                  setBreadcrumb(newBreadcrumb);
                  setCurrentFolder(folder.id);
                }}
                className="h-6 px-2 text-xs hover:text-foreground"
              >
                {folder.name}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayItems.map((item) => (
          <Card 
            key={item.id} 
            className="group hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={() => {
              if ('is_category_folder' in item && item.is_category_folder) {
                enterFolder(item as CategoryFolder);
              } else {
                navigate(`/checklists/view/${item.id}`);
              }
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {('is_category_folder' in item && item.is_category_folder) ? (
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${item.folder_color}20`, color: item.folder_color }}
                    >
                      {getFolderIcon(item.folder_icon)}
                    </div>
                  ) : (
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {('is_category_folder' in item && item.is_category_folder) ? (
                    <Badge variant="secondary" className="text-xs">
                      {(item as CategoryFolder).template_count} templates
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      {item.field_count && (
                        <Badge variant="secondary" className="text-xs">
                          {item.field_count} campos
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                
                {!('is_category_folder' in item && item.is_category_folder) && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/checklists/view/${item.id}`);
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/checklists/builder?edit=${item.id}`);
                      }}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {displayItems.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchTerm ? 'Nenhum template encontrado' : 'Nenhum template criado'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchTerm 
              ? 'Tente ajustar sua pesquisa ou explore outras categorias'
              : 'Comece criando seu primeiro template de checklist'
            }
          </p>
          {!searchTerm && (
            <Button 
              onClick={() => navigate('/checklists/builder')}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Template
            </Button>
          )}
        </div>
      )}
    </div>
  );
}