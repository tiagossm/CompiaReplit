import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Send, Plus, Trash2, AlertTriangle, CheckCircle, Calendar, MapPin, User } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { INSPECTION_STATUS } from "@/lib/constants";
import type { ChecklistItem, Finding } from "@/lib/types";

const inspectionFormSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  location: z.string().min(1, "Local é obrigatório"),
  scheduledAt: z.string().optional(),
  checklist: z.array(z.object({
    id: z.string(),
    item: z.string(),
    standard: z.string().optional(),
    isCompliant: z.boolean().optional(),
    notes: z.string().optional()
  })).optional(),
  findings: z.array(z.object({
    item: z.string(),
    description: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    standard: z.string().optional(),
    evidence: z.array(z.string()).optional()
  })).optional()
});

type InspectionFormData = z.infer<typeof inspectionFormSchema>;

interface InspectionFormProps {
  inspectionId?: string;
  initialData?: Partial<InspectionFormData>;
  onSuccess?: (inspection: any) => void;
  mode?: 'create' | 'edit';
}

const defaultChecklistItems = [
  { id: "1", item: "Equipamentos de Proteção Individual (EPIs)", standard: "NR-06", isCompliant: undefined, notes: "" },
  { id: "2", item: "Sinalização de Segurança", standard: "NR-26", isCompliant: undefined, notes: "" },
  { id: "3", item: "Instalações Elétricas", standard: "NR-10", isCompliant: undefined, notes: "" },
  { id: "4", item: "Máquinas e Equipamentos", standard: "NR-12", isCompliant: undefined, notes: "" },
  { id: "5", item: "Prevenção de Incêndios", standard: "NR-23", isCompliant: undefined, notes: "" }
];

export default function InspectionForm({ inspectionId, initialData, onSuccess, mode = 'create' }: InspectionFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialData?.checklist || defaultChecklistItems);
  const [findings, setFindings] = useState<Finding[]>(initialData?.findings || []);

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      location: initialData?.location || "",
      scheduledAt: initialData?.scheduledAt || "",
      checklist: checklist,
      findings: findings
    }
  });

  const createInspectionMutation = useMutation({
    mutationFn: async (data: InspectionFormData) => {
      const endpoint = mode === 'edit' ? `/api/inspections/${inspectionId}` : '/api/inspections';
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onSuccess: (inspection) => {
      toast({
        title: mode === 'edit' ? "Inspeção atualizada!" : "Inspeção criada!",
        description: `Inspeção "${inspection.title}" ${mode === 'edit' ? 'atualizada' : 'criada'} com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inspections'] });
      onSuccess?.(inspection);
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar inspeção",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const addChecklistItem = () => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      item: "",
      standard: "",
      isCompliant: undefined,
      notes: ""
    };
    setChecklist([...checklist, newItem]);
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const addFinding = () => {
    const newFinding: Finding = {
      item: "",
      description: "",
      severity: "medium",
      standard: "",
      evidence: []
    };
    setFindings([...findings, newFinding]);
  };

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const updateFinding = (index: number, updates: Partial<Finding>) => {
    setFindings(findings.map((finding, i) => 
      i === index ? { ...finding, ...updates } : finding
    ));
  };

  const handleSubmit = (data: InspectionFormData) => {
    const submissionData = {
      ...data,
      checklist,
      findings
    };
    createInspectionMutation.mutate(submissionData);
  };

  const saveDraft = () => {
    const data = form.getValues();
    handleSubmit({ ...data, checklist, findings });
  };

  const submitForReview = () => {
    const data = form.getValues();
    handleSubmit({ ...data, checklist, findings });
  };

  const nonCompliantItems = checklist.filter(item => item.isCompliant === false).length;
  const compliantItems = checklist.filter(item => item.isCompliant === true).length;
  const complianceRate = checklist.length > 0 ? Math.round((compliantItems / checklist.length) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="inspection-form">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card data-testid="basic-info-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-compia-blue" />
                <span>Informações Básicas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título da Inspeção</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Inspeção de Segurança - Unidade Industrial A"
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: São Paulo - SP, Setor de Produção"
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data/Hora Programada</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="datetime-local"
                        data-testid="input-scheduled"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descreva o objetivo e escopo da inspeção..."
                        rows={3}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card data-testid="checklist-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-compia-green" />
                  <span>Checklist de Verificação</span>
                </CardTitle>
                <div className="flex items-center space-x-4">
                  <Badge className="bg-compia-green/10 text-compia-green" data-testid="compliance-rate">
                    {complianceRate}% Conformidade
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addChecklistItem}
                    data-testid="add-checklist-item"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="checklist-items">
                {checklist.map((item, index) => (
                  <div 
                    key={item.id}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`checklist-item-${index}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            placeholder="Item de verificação"
                            value={item.item}
                            onChange={(e) => updateChecklistItem(item.id, { item: e.target.value })}
                            data-testid={`checklist-item-text-${index}`}
                          />
                          <Input
                            placeholder="NR aplicável (ex: NR-06)"
                            value={item.standard || ""}
                            onChange={(e) => updateChecklistItem(item.id, { standard: e.target.value })}
                            data-testid={`checklist-standard-${index}`}
                          />
                          <Select
                            value={item.isCompliant === undefined ? "pending" : item.isCompliant ? "compliant" : "non-compliant"}
                            onValueChange={(value) => {
                              const isCompliant = value === "compliant" ? true : value === "non-compliant" ? false : undefined;
                              updateChecklistItem(item.id, { isCompliant });
                            }}
                          >
                            <SelectTrigger data-testid={`checklist-compliance-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="compliant">Conforme</SelectItem>
                              <SelectItem value="non-compliant">Não Conforme</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Observações..."
                          value={item.notes || ""}
                          onChange={(e) => updateChecklistItem(item.id, { notes: e.target.value })}
                          rows={2}
                          data-testid={`checklist-notes-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChecklistItem(item.id)}
                        className="text-destructive hover:text-destructive/80 ml-2"
                        data-testid={`remove-checklist-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Non-Conformities/Findings */}
          <Card data-testid="findings-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-compia-purple" />
                  <span>Não Conformidades</span>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFinding}
                  data-testid="add-finding"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Não Conformidade
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="no-findings">
                  Nenhuma não conformidade registrada
                </div>
              ) : (
                <div className="space-y-4" data-testid="findings-list">
                  {findings.map((finding, index) => (
                    <div 
                      key={index}
                      className="border rounded-lg p-4 space-y-3"
                      data-testid={`finding-${index}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input
                              placeholder="Item não conforme"
                              value={finding.item}
                              onChange={(e) => updateFinding(index, { item: e.target.value })}
                              data-testid={`finding-item-${index}`}
                            />
                            <Input
                              placeholder="NR violada (ex: NR-10)"
                              value={finding.standard || ""}
                              onChange={(e) => updateFinding(index, { standard: e.target.value })}
                              data-testid={`finding-standard-${index}`}
                            />
                            <Select
                              value={finding.severity}
                              onValueChange={(value) => updateFinding(index, { severity: value as Finding['severity'] })}
                            >
                              <SelectTrigger data-testid={`finding-severity-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                                <SelectItem value="critical">Crítica</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Textarea
                            placeholder="Descrição detalhada da não conformidade..."
                            value={finding.description}
                            onChange={(e) => updateFinding(index, { description: e.target.value })}
                            rows={2}
                            data-testid={`finding-description-${index}`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFinding(index)}
                          className="text-destructive hover:text-destructive/80 ml-2"
                          data-testid={`remove-finding-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-4" data-testid="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={createInspectionMutation.isPending}
              data-testid="save-draft"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button
              type="submit"
              disabled={createInspectionMutation.isPending}
              className="bg-compia-blue hover:bg-compia-blue/90"
              data-testid="submit-inspection"
            >
              <Send className="w-4 h-4 mr-2" />
              {createInspectionMutation.isPending 
                ? "Salvando..." 
                : mode === 'edit' 
                  ? "Atualizar Inspeção" 
                  : "Criar Inspeção"
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
