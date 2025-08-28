import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  User,
  MapPin,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Inspection } from "@shared/schema";

export default function Inspections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = () => {
    console.log('[INSPECTIONS] [REACT] Buscando inspeções de: /api/inspections');
    
    fetch('/api/inspections')
      .then(res => res.json())
      .then(data => {
        console.log('[INSPECTIONS] [REACT] Inspeções recebidas:', data.length || 0);
        setInspections(data || []);
        setLoading(false);
      })
      .catch(error => {
        console.error('[INSPECTIONS] [REACT] Erro ao carregar inspeções:', error);
        setLoading(false);
      });
  };

  const handleDeleteInspection = async (id: string) => {
    try {
      const response = await fetch(`/api/inspections/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setInspections(prev => prev.filter(inspection => inspection.id !== id));
        setShowDeleteModal(null);
        alert('Inspeção excluída com sucesso!');
      } else {
        throw new Error('Erro ao excluir inspeção');
      }
    } catch (error) {
      console.error('Erro ao excluir inspeção:', error);
      alert('Erro ao excluir inspeção. Tente novamente.');
    }
  };

  const handleCloneInspection = async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/inspections/${id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await response.json();
        await fetchInspections();
        alert(`Inspeção "${title}" duplicada com sucesso! Apenas os dados básicos foram copiados.`);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao clonar inspeção');
      }
    } catch (error) {
      console.error('Erro ao clonar inspeção:', error);
      alert(`Erro ao clonar inspeção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleExportInspections = async () => {
    setCsvLoading(true);
    try {
      const csvData = filteredInspections.map(inspection => ({
        titulo: inspection.title,
        descricao: inspection.description || '',
        local: inspection.location,
        status: getStatusLabel(inspection.status),
        data_agendada: inspection.scheduledAt ? new Date(inspection.scheduledAt).toLocaleDateString('pt-BR') : '',
        data_criacao: new Date(inspection.createdAt!).toLocaleDateString('pt-BR'),
      }));

      const headers = 'titulo,descricao,local,status,data_agendada,data_criacao';
      const csvContent = [
        headers,
        ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inspecoes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao exportar inspeções:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setCsvLoading(false);
    }
  };

  const filteredInspections = (inspections || []).filter(inspection => {
    const matchesSearch = inspection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inspection.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inspection.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-compia-green" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Rascunho';
      case 'in_progress':
        return 'Em Andamento';
      case 'completed':
        return 'Concluída';
      case 'approved':
        return 'Aprovada';
      case 'rejected':
        return 'Rejeitada';
      default:
        return 'Desconhecido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-compia-green/20 text-compia-green';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6" data-testid="inspections-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="inspections-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-heading font-bold text-compia-blue">Inspeções</h1>
        <div className="flex space-x-2">
          <Button
            onClick={handleExportInspections}
            variant="outline"
            disabled={csvLoading}
            data-testid="export-inspections"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Link href="/inspections/new">
            <Button className="bg-compia-blue hover:bg-compia-blue/90" data-testid="create-inspection">
              <Plus className="w-4 h-4 mr-2" />
              Nova Inspeção
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 flex space-x-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar inspeções..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-inspections"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="filter-status">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInspections.map((inspection) => (
          <Card key={inspection.id} className="hover:shadow-md transition-shadow" data-testid={`inspection-card-${inspection.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg font-semibold text-compia-blue line-clamp-2">
                  {inspection.title}
                </CardTitle>
                <Badge className={`ml-2 ${getStatusColor(inspection.status)}`}>
                  {getStatusIcon(inspection.status)}
                  <span className="ml-1">{getStatusLabel(inspection.status)}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {inspection.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {inspection.description}
                </p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="truncate">{inspection.location}</span>
                </div>
                
                {inspection.scheduledAt && (
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{new Date(inspection.scheduledAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex space-x-1">
                  <Link href={`/inspections/${inspection.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`view-inspection-${inspection.id}`}>
                      <Play className="w-4 h-4" />
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCloneInspection(inspection.id, inspection.title)}
                    data-testid={`clone-inspection-${inspection.id}`}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowDeleteModal(inspection.id)}
                    className="text-red-500 hover:text-red-700"
                    data-testid={`delete-inspection-${inspection.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <span className="text-xs text-muted-foreground">
                  {new Date(inspection.createdAt!).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredInspections.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma inspeção encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Não foram encontradas inspeções com os filtros selecionados.
            </p>
            <Link href="/inspections/new">
              <Button className="bg-compia-blue hover:bg-compia-blue/90">
                <Plus className="w-4 h-4 mr-2" />
                Criar primeira inspeção
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Dialog open={!!showDeleteModal} onOpenChange={() => setShowDeleteModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Tem certeza que deseja excluir esta inspeção? Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteInspection(showDeleteModal)}
                disabled={deleteMutation.isPending}
              >
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}