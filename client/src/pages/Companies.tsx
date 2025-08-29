import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Building2, MapPin, User, Phone, Mail, Plus, Edit, Trash2, Eye } from "lucide-react";
import type { Company } from "@shared/schema";

export default function Companies() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/companies/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Empresa excluída com sucesso",
        description: "A empresa foi removida do sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir empresa",
        description: "Não foi possível excluir a empresa.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (company: Company) => {
    if (window.confirm(`Tem certeza que deseja excluir a empresa ${company.name}?`)) {
      deleteMutation.mutate(company.id);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Carregando empresas...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Empresas Cadastradas</h1>
          <p className="text-gray-600 mt-2">Gerencie as empresas da organização</p>
        </div>
        <Link href="/companies/new">
          <Button className="gap-2">
            <Plus size={20} />
            Nova Empresa
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ ou cidade..."
          className="w-full px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-companies"
        />
      </div>

      {filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma empresa cadastrada</p>
            <Link href="/companies/new">
              <Button className="mt-4" data-testid="button-add-first-company">
                Cadastrar primeira empresa
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {company.name}
                    </CardTitle>
                    {company.cnpj && (
                      <p className="text-sm text-gray-600 mt-1">CNPJ: {company.cnpj}</p>
                    )}
                  </div>
                  <Badge variant={company.isActive ? "default" : "secondary"}>
                    {company.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {company.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p>{company.address}</p>
                        {company.city && company.state && (
                          <p>{company.city} - {company.state}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {company.responsibleName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{company.responsibleName}</span>
                      {company.responsibleRole && (
                        <span className="text-gray-500">({company.responsibleRole})</span>
                      )}
                    </div>
                  )}
                  
                  {company.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  
                  {company.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{company.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/companies/${company.id}/locations`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-locations-${company.id}`}>
                      <MapPin size={14} />
                      Locais
                    </Button>
                  </Link>
                  <Link href={`/companies/${company.id}`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-${company.id}`}>
                      <Eye size={14} />
                      Ver
                    </Button>
                  </Link>
                  <Link href={`/companies/${company.id}/edit`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-edit-${company.id}`}>
                      <Edit size={14} />
                      Editar
                    </Button>
                  </Link>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleDelete(company)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${company.id}`}
                  >
                    <Trash2 size={14} />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}