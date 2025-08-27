import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Filter, Plus, Eye, Edit, Download, Play, QrCode, 
  Calendar, MapPin, User, AlertTriangle, CheckCircle, Clock
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, hasPermission } from "@/hooks/useAuth";
import type { Inspection } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS, INSPECTION_STATUS } from "@/lib/constants";
import InspectionForm from "@/components/Inspections/InspectionForm";
import QRCodeGenerator from "@/components/Inspections/QRCodeGenerator";

export default function Inspections() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState<Inspection | null>(null);

  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['/api/inspections'],
  });

  const canCreateInspection = hasPermission(user, 'create_inspection');
  const canEditInspection = hasPermission(user, 'edit_inspection');

  const filteredInspections = (inspections || []).filter(inspection => {
    const matchesSearch = inspection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inspection.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inspection.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case INSPECTION_STATUS.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-compia-green" />;
      case INSPECTION_STATUS.IN_PROGRESS:
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case INSPECTION_STATUS.DRAFT:
        return <Edit className="w-4 h-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-compia-purple" />;
    }
  };

  const getActionButton = (inspection: Inspection) => {
    if (inspection.status === INSPECTION_STATUS.COMPLETED) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-compia-blue hover:text-compia-blue/80"
          data-testid={`view-inspection-${inspection.id}`}
        >
          <Eye className="w-4 h-4" />
        </Button>
      );
    }

    if (inspection.status === INSPECTION_STATUS.DRAFT) {
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-compia-green hover:text-compia-green/80"
          onClick={() => setSelectedInspection(inspection)}
          data-testid={`start-inspection-${inspection.id}`}
        >
          <Play className="w-4 h-4" />
        </Button>
      );
    }

    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-compia-blue hover:text-compia-blue/80"
        onClick={() => setSelectedInspection(inspection)}
        data-testid={`edit-inspection-${inspection.id}`}
      >
        <Edit className="w-4 h-4" />
      </Button>
    );
  };

  if (isLoading) {
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
      {/* Header with Search and Filters */}
      <Card data-testid="inspections-header">
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
                <SelectTrigger className="w-[180px]" data-testid="filter-status">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value={INSPECTION_STATUS.DRAFT}>Rascunho</SelectItem>
                  <SelectItem value={INSPECTION_STATUS.IN_PROGRESS}>Em Andamento</SelectItem>
                  <SelectItem value={INSPECTION_STATUS.COMPLETED}>Concluída</SelectItem>
                  <SelectItem value={INSPECTION_STATUS.APPROVED}>Aprovada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {canCreateInspection && (
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground"
                data-testid="new-inspection-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Inspeção
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inspections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="inspections-grid">
        {filteredInspections.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3" data-testid="no-inspections">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm || statusFilter !== "all" 
                  ? "Nenhuma inspeção encontrada" 
                  : "Nenhuma inspeção cadastrada"
                }
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros de pesquisa"
                  : "Comece criando sua primeira inspeção de segurança"
                }
              </p>
              {canCreateInspection && !searchTerm && statusFilter === "all" && (
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-compia-blue hover:bg-compia-blue/90"
                  data-testid="create-first-inspection"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Inspeção
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredInspections.map((inspection) => (
            <Card 
              key={inspection.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`inspection-card-${inspection.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2 mb-2" data-testid={`inspection-title-${inspection.id}`}>
                      {inspection.title}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(inspection.status)}
                      <Badge 
                        className={STATUS_COLORS[inspection.status as keyof typeof STATUS_COLORS]}
                        data-testid={`inspection-status-${inspection.id}`}
                      >
                        {STATUS_LABELS[inspection.status as keyof typeof STATUS_LABELS]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate" data-testid={`inspection-location-${inspection.id}`}>
                      {inspection.location}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <User className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Inspetor: {inspection.inspectorId.slice(0, 8)}...</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span data-testid={`inspection-date-${inspection.id}`}>
                      {inspection.completedAt 
                        ? `Concluída: ${new Date(inspection.completedAt).toLocaleDateString('pt-BR')}`
                        : inspection.scheduledAt
                        ? `Programada: ${new Date(inspection.scheduledAt).toLocaleDateString('pt-BR')}`
                        : `Criada: ${new Date(inspection.createdAt).toLocaleDateString('pt-BR')}`
                      }
                    </span>
                  </div>

                  {inspection.findings && Array.isArray(inspection.findings) && inspection.findings.length > 0 && (
                    <div className="flex items-center text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2 text-destructive flex-shrink-0" />
                      <span className="text-destructive font-medium">
                        {inspection.findings.length} não conformidade{inspection.findings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex space-x-2">
                    {getActionButton(inspection)}
                    
                    {inspection.status === INSPECTION_STATUS.COMPLETED && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-foreground"
                        data-testid={`download-inspection-${inspection.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    
                    {inspection.qrCode && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setShowQRGenerator(inspection)}
                        data-testid={`qr-inspection-${inspection.id}`}
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Inspection Dialog */}
      <Dialog open={showCreateForm || !!selectedInspection} onOpenChange={() => {
        setShowCreateForm(false);
        setSelectedInspection(null);
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="inspection-form-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedInspection ? "Editar Inspeção" : "Nova Inspeção"}
            </DialogTitle>
          </DialogHeader>
          
          <InspectionForm
            inspectionId={selectedInspection?.id}
            initialData={selectedInspection || undefined}
            mode={selectedInspection ? 'edit' : 'create'}
            onSuccess={() => {
              setShowCreateForm(false);
              setSelectedInspection(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* QR Code Generator Dialog */}
      <Dialog open={!!showQRGenerator} onOpenChange={() => setShowQRGenerator(null)}>
        <DialogContent className="max-w-md" data-testid="qr-generator-dialog">
          <DialogHeader>
            <DialogTitle>QR Code da Inspeção</DialogTitle>
          </DialogHeader>
          
          {showQRGenerator && (
            <QRCodeGenerator
              inspectionId={showQRGenerator.id}
              inspectionTitle={showQRGenerator.title}
              qrCode={showQRGenerator.qrCode || undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
