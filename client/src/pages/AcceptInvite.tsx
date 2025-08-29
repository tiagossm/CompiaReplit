import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, CheckCircle, AlertTriangle, Shield, Users, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const acceptInviteSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
});

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

export default function AcceptInvite() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [invitationDetails, setInvitationDetails] = useState<any>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const form = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      name: "",
      email: "",
    }
  });

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam) {
      setToken(tokenParam);
      validateToken(tokenParam);
    } else {
      setIsValidToken(false);
    }
  }, [location]);

  const validateToken = async (tokenValue: string) => {
    try {
      const response = await fetch(`/api/invitations/validate?token=${tokenValue}`);
      
      if (response.ok) {
        const invitation = await response.json();
        setInvitationDetails(invitation);
        setIsValidToken(true);
        
        // Pre-fill email if available
        if (invitation.email) {
          form.setValue('email', invitation.email);
        }
      } else {
        setIsValidToken(false);
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setIsValidToken(false);
    }
  };

  const acceptInviteMutation = useMutation({
    mutationFn: async (data: AcceptInviteFormData) => {
      const res = await apiRequest('/api/invitations/accept', 'POST', {
        token,
        userInfo: data
      });
      return res;
    },
    onSuccess: (result) => {
      toast({
        title: "Convite aceito com sucesso!",
        description: `Bem-vindo ao COMPIA, ${result.user.name}!`,
      });
      
      // Redirect to dashboard after successful acceptance
      setTimeout(() => {
        setLocation('/dashboard');
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Erro ao aceitar convite",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: AcceptInviteFormData) => {
    acceptInviteMutation.mutate(data);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'org_admin':
        return 'Administrador da Organização';
      case 'manager':
        return 'Gerente';
      case 'inspector':
        return 'Técnico/Inspetor';
      case 'client':
        return 'Cliente';
      default:
        return role;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'org_admin':
        return 'Gerenciar organização, usuários e configurações';
      case 'manager':
        return 'Supervisionar inspeções e planos de ação';
      case 'inspector':
        return 'Realizar inspeções de segurança e criar relatórios';
      case 'client':
        return 'Visualizar relatórios e dados de conformidade';
      default:
        return 'Acesso ao sistema COMPIA';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'org_admin':
        return <Shield className="w-6 h-6 text-compia-blue" />;
      case 'manager':
        return <Users className="w-6 h-6 text-compia-purple" />;
      case 'inspector':
        return <CheckCircle className="w-6 h-6 text-compia-green" />;
      default:
        return <Mail className="w-6 h-6 text-muted-foreground" />;
    }
  };

  // Loading state while validating token
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="accept-invite-loading">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="animate-pulse text-center">
              <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4"></div>
              <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="accept-invite-invalid">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-4">Convite Inválido</h1>
            <p className="text-muted-foreground mb-6">
              Este link de convite é inválido ou expirou. Entre em contato com o administrador 
              da sua organização para solicitar um novo convite.
            </p>
            <Button 
              onClick={() => setLocation('/')}
              className="bg-compia-blue hover:bg-compia-blue/90"
              data-testid="go-home-button"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state after accepting invitation
  if (acceptInviteMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="accept-invite-success">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-compia-green mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-4">Bem-vindo ao COMPIA!</h1>
            <p className="text-muted-foreground mb-6">
              Seu convite foi aceito com sucesso. Você será redirecionado para o dashboard em instantes.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <span>Redirecionando</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main accept invitation form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="accept-invite-page">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-compia-blue to-compia-purple rounded-lg flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">COMPIA</h1>
          <p className="text-muted-foreground">Inteligência em Segurança do Trabalho</p>
        </div>

        {/* Invitation Details */}
        {invitationDetails && (
          <Card data-testid="invitation-details">
            <CardHeader>
              <CardTitle className="text-center">Você foi convidado!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-r from-compia-blue/10 to-compia-purple/10 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  {getRoleIcon(invitationDetails.role)}
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {getRoleLabel(invitationDetails.role)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getRoleDescription(invitationDetails.role)}
                    </p>
                  </div>
                </div>
                
                {invitationDetails.organization && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-sm text-muted-foreground">Organização:</p>
                    <p className="font-medium text-foreground">{invitationDetails.organization.name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accept Invitation Form */}
        <Card data-testid="accept-invite-form">
          <CardHeader>
            <CardTitle>Complete seu cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" data-testid="user-info-form">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Digite seu nome completo"
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
                          readOnly={!!invitationDetails?.email}
                          className={invitationDetails?.email ? "bg-muted" : ""}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={acceptInviteMutation.isPending}
                    className="w-full bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground"
                    data-testid="accept-invitation-button"
                  >
                    {acceptInviteMutation.isPending ? (
                      "Processando..."
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aceitar Convite
                      </>
                    )}
                  </Button>
                </div>

                <div className="text-center text-xs text-muted-foreground pt-4">
                  Ao aceitar este convite, você concorda em usar o sistema COMPIA 
                  conforme as políticas da sua organização.
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>© 2024 COMPIA - Inteligência em Segurança do Trabalho</p>
        </div>
      </div>
    </div>
  );
}
