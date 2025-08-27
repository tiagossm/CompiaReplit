import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { 
  ArrowLeft, 
  Edit, 
  Copy, 
  Trash2, 
  Download,
  FileText,
  Calendar,
  User,
  Building,
  Tag,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  created_by?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  items: any[];
  tags?: string[];
  version?: number;
  usage_count?: number;
  field_count?: number;
}

export default function ChecklistDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTemplate();
    }
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/checklist-templates/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
      } else {
        console.error('Template não encontrado');
        navigate('/checklists');
      }
    } catch (error) {
      console.error('Erro ao carregar template:', error);
      navigate('/checklists');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/checklists/builder?edit=${id}`);
  };

  const handleDuplicate = async () => {
    if (!template) return;
    
    try {
      const response = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (Cópia)`,
          description: template.description,
          category: template.category,
          items: template.items,
          tags: template.tags
        })
      });
      
      if (response.ok) {
        const newTemplate = await response.json();
        navigate(`/checklists/view/${newTemplate.id}`);
      }
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
    }
  };

  const handleDelete = async () => {
    if (!template || !confirm('Tem certeza que deseja excluir este template?')) return;
    
    try {
      const response = await fetch(`/api/checklist-templates/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        navigate('/checklists');
      }
    } catch (error) {
      console.error('Erro ao excluir template:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getFieldTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      text: 'Texto',
      textarea: 'Área de Texto',
      select: 'Seleção',
      multiselect: 'Seleção Múltipla',
      radio: 'Opção Única',
      checkbox: 'Caixa de Seleção',
      number: 'Número',
      date: 'Data',
      time: 'Hora',
      boolean: 'Sim/Não',
      rating: 'Avaliação',
      file: 'Arquivo',
      photo: 'Foto'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Template não encontrado</h3>
          <p className="text-muted-foreground mb-6">O template solicitado não foi encontrado ou foi removido.</p>
          <Button onClick={() => navigate('/checklists')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar aos Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/checklists')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{template.name}</h1>
            <p className="text-muted-foreground mt-1">
              Visualização detalhada do template
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDuplicate}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicar
          </Button>
          
          <Button
            variant="outline"
            onClick={handleEdit}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          
          <Button
            variant="outline"
            onClick={handleDelete}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Informações do Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                <Badge variant="outline">{template.category}</Badge>
              </div>
              
              {template.description && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm text-foreground">{template.description}</p>
                </div>
              )}
              
              {template.tags && template.tags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Versão</p>
                  <p className="font-medium">{template.version || 1}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Campos</p>
                  <p className="font-medium">{template.items?.length || 0}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium">{formatDate(template.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Atualizado em</p>
                  <p className="font-medium">{formatDate(template.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Campos do Template ({template.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {template.items && template.items.length > 0 ? (
                <div className="space-y-4">
                  {template.items.map((item: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">
                            {item.label || item.item || `Campo ${index + 1}`}
                          </h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getFieldTypeLabel(item.type)}
                          </Badge>
                          {item.required && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Obrigatório
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {item.options && (
                        <div className="text-sm">
                          <p className="text-muted-foreground mb-1">Opções:</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(item.options) ? item.options : item.options.split(',')).map((option: string, optIndex: number) => (
                              <Badge key={optIndex} variant="secondary" className="text-xs">
                                {option.trim()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Este template não possui campos configurados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}