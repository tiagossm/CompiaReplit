import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, Save, Search } from "lucide-react";
import type { Company, Organization } from "@shared/schema";

const companyFormSchema = z.object({
  name: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  
  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2, "Estado deve ter 2 caracteres").optional().or(z.literal("")),
  zipCode: z.string().optional(),
  
  // Responsible person
  responsibleName: z.string().optional(),
  responsibleRole: z.string().optional(),
  responsibleEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  responsiblePhone: z.string().optional(),
  
  // Technical responsible
  technicalResponsibleName: z.string().optional(),
  technicalResponsibleRole: z.string().optional(),
  technicalResponsibleEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  technicalResponsiblePhone: z.string().optional(),
  technicalResponsibleCertification: z.string().optional(),
  
  // Meta
  organizationId: z.string().min(1, "Organização é obrigatória"),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function CompanyForm() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/companies/:id/edit");
  const isEdit = !!match && params?.id;
  const { toast } = useToast();
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: company, isLoading: isLoadingCompany } = useQuery<Company>({
    queryKey: ["/api/companies", params?.id],
    enabled: isEdit,
  });

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      responsibleName: "",
      responsibleRole: "",
      responsibleEmail: "",
      responsiblePhone: "",
      technicalResponsibleName: "",
      technicalResponsibleRole: "",
      technicalResponsibleEmail: "",
      technicalResponsiblePhone: "",
      technicalResponsibleCertification: "",
      organizationId: "",
      isActive: true,
      notes: "",
    },
  });

  useEffect(() => {
    if (company && isEdit) {
      form.reset({
        name: company.name || "",
        cnpj: company.cnpj || "",
        email: company.email || "",
        phone: company.phone || "",
        website: company.website || "",
        address: company.address || "",
        city: company.city || "",
        state: company.state || "",
        zipCode: company.zipCode || "",
        responsibleName: company.responsibleName || "",
        responsibleRole: company.responsibleRole || "",
        responsibleEmail: company.responsibleEmail || "",
        responsiblePhone: company.responsiblePhone || "",
        technicalResponsibleName: company.technicalResponsibleName || "",
        technicalResponsibleRole: company.technicalResponsibleRole || "",
        technicalResponsibleEmail: company.technicalResponsibleEmail || "",
        technicalResponsiblePhone: company.technicalResponsiblePhone || "",
        technicalResponsibleCertification: company.technicalResponsibleCertification || "",
        organizationId: company.organizationId || "",
        isActive: company.isActive ?? true,
        notes: company.notes || "",
      });
    }
  }, [company, isEdit, form]);

  // Função para limpar formatação do CNPJ
  const cleanCNPJ = (cnpj: string) => {
    return cnpj.replace(/\D/g, '');
  };

  // Função para buscar dados da empresa pelo CNPJ
  const searchCompanyByCNPJ = async () => {
    const cnpj = cleanCNPJ(form.getValues('cnpj') || '');
    
    if (cnpj.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "CNPJ deve ter 14 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingCNPJ(true);

    try {
      // Usando API pública da ReceitaWS
      const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
      const data = await response.json();

      if (data.status === 'ERROR') {
        toast({
          title: "CNPJ não encontrado",
          description: data.message || "CNPJ não foi encontrado na Receita Federal",
          variant: "destructive",
        });
        return;
      }

      // Preencher os campos automaticamente
      form.setValue('name', data.nome || '');
      form.setValue('email', data.email || '');
      form.setValue('phone', data.telefone || '');
      form.setValue('address', `${data.logradouro || ''}, ${data.numero || ''} ${data.complemento || ''}`.trim());
      form.setValue('city', data.municipio || '');
      form.setValue('state', data.uf || '');
      form.setValue('zipCode', data.cep?.replace(/\D/g, '') || '');

      toast({
        title: "Dados encontrados!",
        description: "Os dados da empresa foram preenchidos automaticamente",
      });

    } catch (error) {
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível consultar os dados do CNPJ. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      if (isEdit && params?.id) {
        return await apiRequest(`/api/companies/${params.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        return await apiRequest("/api/companies", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: isEdit ? "Empresa atualizada" : "Empresa criada",
        description: isEdit 
          ? "As informações da empresa foram atualizadas com sucesso."
          : "A empresa foi cadastrada com sucesso.",
      });
      setLocation("/companies");
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar empresa",
        description: error.message || "Ocorreu um erro ao salvar a empresa.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    saveMutation.mutate(data);
  };

  if (isEdit && isLoadingCompany) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Carregando empresa...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/companies">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            {isEdit ? "Editar Empresa" : "Nova Empresa"}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEdit ? "Atualize as informações da empresa" : "Cadastre uma nova empresa"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input {...field} placeholder="00.000.000/0001-00" data-testid="input-cnpj" />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={searchCompanyByCNPJ}
                            disabled={isSearchingCNPJ || !field.value}
                            data-testid="button-search-cnpj"
                          >
                            {isSearchingCNPJ ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organização *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-organization">
                          <SelectValue placeholder="Selecione a organização" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SP" maxLength={2} data-testid="input-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00000-000" data-testid="input-zipcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Responsible Person */}
          <Card>
            <CardHeader>
              <CardTitle>Responsável pela Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsibleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-responsible-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="responsibleRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-responsible-role" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsibleEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-responsible-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="responsiblePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone do Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-responsible-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Technical Responsible */}
          <Card>
            <CardHeader>
              <CardTitle>Responsável Técnico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="technicalResponsibleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Responsável Técnico</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-tech-responsible-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="technicalResponsibleRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo Técnico</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-tech-responsible-role" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="technicalResponsibleEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Responsável Técnico</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-tech-responsible-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="technicalResponsiblePhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone do Responsável Técnico</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-tech-responsible-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="technicalResponsibleCertification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificações/Qualificações</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Engenheiro de Segurança do Trabalho - CREA SP 123456" data-testid="input-tech-certification" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Empresa Ativa</FormLabel>
                      <div className="text-sm text-gray-600">
                        Empresas inativas não aparecerão nas opções de inspeção
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={saveMutation.isPending}
              className="gap-2"
              data-testid="button-save-company"
            >
              <Save size={20} />
              {saveMutation.isPending 
                ? (isEdit ? "Salvando..." : "Criando...") 
                : (isEdit ? "Salvar Alterações" : "Criar Empresa")
              }
            </Button>
            <Link href="/companies">
              <Button variant="outline" data-testid="button-cancel">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}