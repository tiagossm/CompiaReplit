import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Mail, Copy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/constants";

const inviteUserSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["org_admin", "manager", "inspector", "client"], {
    required_error: "Selecione um perfil"
  }),
  organizationId: z.string().min(1, "Organização é obrigatória")
});

type InviteUserData = z.infer<typeof inviteUserSchema>;

interface InviteUserDialogProps {
  organizationId?: string;
  trigger?: React.ReactNode;
}

export default function InviteUserDialog({ organizationId, trigger }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InviteUserData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      role: "inspector",
      organizationId: organizationId || user.organizationId || ""
    }
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserData) => {
      const response = await apiRequest('POST', '/api/invitations', data);
      return response.json();
    },
    onSuccess: (invitation) => {
      // Generate invite link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/accept-invite?token=${invitation.token}`;
      setInviteLink(link);
      
      toast({
        title: "Convite enviado!",
        description: `Convite enviado para ${invitation.email}`,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar convite",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: InviteUserData) => {
    inviteUserMutation.mutate(data);
  };

  const copyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        toast({
          title: "Link copiado!",
          description: "Link de convite copiado para a área de transferência",
        });
      } catch (error) {
        toast({
          title: "Erro ao copiar",
          description: "Não foi possível copiar o link",
          variant: "destructive"
        });
      }
    }
  };

  const availableRoles = user.role === 'system_admin' 
    ? ['org_admin', 'manager', 'inspector', 'client']
    : ['manager', 'inspector', 'client'];

  const defaultTrigger = (
    <Button className="bg-compia-blue hover:bg-compia-blue/90 text-primary-foreground">
      <UserPlus className="w-4 h-4 mr-2" />
      Convidar Usuário
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen} data-testid="invite-user-dialog">
      <DialogTrigger asChild data-testid="invite-trigger">
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="invite-dialog-content">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-compia-blue" />
            <span>Convidar Usuário</span>
          </DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4" data-testid="invite-success">
            <div className="text-center py-4">
              <Mail className="w-12 h-12 text-compia-green mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Convite Enviado!
              </h3>
              <p className="text-sm text-muted-foreground">
                O convite foi enviado. Você também pode compartilhar o link diretamente:
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-link">Link de Convite</Label>
              <div className="flex space-x-2">
                <Input
                  id="invite-link"
                  value={inviteLink}
                  readOnly
                  className="flex-1"
                  data-testid="invite-link-input"
                />
                <Button
                  onClick={copyInviteLink}
                  variant="outline"
                  size="sm"
                  data-testid="copy-invite-link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setInviteLink(null);
                  form.reset();
                }}
                data-testid="invite-another"
              >
                Convidar Outro
              </Button>
              <Button
                onClick={() => setOpen(false)}
                data-testid="close-invite-dialog"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" data-testid="invite-form">
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
                        placeholder="usuario@exemplo.com"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRoles.map(role => (
                          <SelectItem key={role} value={role} data-testid={`role-option-${role}`}>
                            {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organização</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        placeholder="Organização será definida automaticamente"
                        className="bg-muted"
                        data-testid="input-organization"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-testid="cancel-invite"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={inviteUserMutation.isPending}
                  className="bg-compia-blue hover:bg-compia-blue/90"
                  data-testid="send-invite"
                >
                  {inviteUserMutation.isPending ? "Enviando..." : "Enviar Convite"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
