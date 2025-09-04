// ERP Nexus - Dados da Empresa 
// Página para edição dos dados da empresa (rota: /settings/company)

'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/lib/toast';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe,
  FileText,
  AlertCircle,
  CheckCircle,
  Users
} from 'lucide-react';

// Schema de validação Zod
const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().max(2, 'Estado deve ter 2 caracteres').optional(),
    zip_code: z.string().optional()
  })
});

type CompanyFormData = z.infer<typeof companySchema>;

// Tipos de dados
interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  website?: string;
  address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip_code?: string;
  };
  plan: 'basic' | 'premium' | 'enterprise';
  enabled_modules: string[];
  max_users: number;
  current_users: number;
  created_at: string;
}

interface CompanyResponse {
  success: boolean;
  data: Company;
}

// Hook para buscar dados da empresa
const useCompany = () => {
  return useQuery<CompanyResponse>({
    queryKey: ['company'],
    queryFn: async () => {
      // Simular chamada à API - substituir pela API real
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockCompany: Company = {
        id: '1',
        name: 'Clínica Bella Vida',
        email: 'contato@bellavida.com',
        phone: '+55 11 99999-9999',
        cnpj: '12.345.678/0001-90',
        website: 'https://www.bellavida.com',
        address: {
          street: 'Rua das Flores',
          number: '123',
          complement: 'Sala 456',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zip_code: '01234-567'
        },
        plan: 'premium',
        enabled_modules: ['CRM', 'SERVICES', 'AGENDAMENTO', 'REPORTS'],
        max_users: 20,
        current_users: 5,
        created_at: '2024-01-15T10:00:00Z'
      };

      return {
        success: true,
        data: mockCompany
      };
    }
  });
};

// Hook para atualizar dados da empresa
const useUpdateCompany = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CompanyFormData) => {
      // Simular chamada à API
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Aqui seria: await api.put('/api/company/details', data)
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Dados da empresa atualizados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar dados da empresa');
    }
  });
};

// Labels para planos
const planLabels = {
  basic: { label: 'Básico', variant: 'secondary' as const },
  premium: { label: 'Premium', variant: 'default' as const },
  enterprise: { label: 'Empresarial', variant: 'destructive' as const }
};

// Labels para módulos
const moduleLabels: Record<string, { label: string; icon: any }> = {
  CRM: { label: 'CRM', icon: Users },
  SERVICES: { label: 'Serviços', icon: FileText },
  AGENDAMENTO: { label: 'Agendamento', icon: Building2 },
  REPORTS: { label: 'Relatórios', icon: FileText }
};

export default function CompanyPage() {
  const { data, isLoading, isError } = useCompany();
  const updateMutation = useUpdateCompany();

  // Configuração do formulário
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      cnpj: '',
      website: '',
      address: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zip_code: ''
      }
    }
  });

  // Preencher formulário quando dados chegam
  React.useEffect(() => {
    if (data?.data) {
      const company = data.data;
      form.reset({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '', 
        cnpj: company.cnpj || '',
        website: company.website || '',
        address: {
          street: company.address.street || '',
          number: company.address.number || '',
          complement: company.address.complement || '',
          neighborhood: company.address.neighborhood || '',
          city: company.address.city || '',
          state: company.address.state || '',
          zip_code: company.address.zip_code || ''
        }
      });
    }
  }, [data, form]);

  // Handler do formulário
  const onSubmit = (formData: CompanyFormData) => {
    updateMutation.mutate(formData);
  };

  // Estados de loading e error
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <span className="ml-2">Carregando dados da empresa...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <div>
          <h4>Erro ao carregar dados</h4>
          <p>Não foi possível carregar os dados da empresa. Tente novamente.</p>
        </div>
      </Alert>
    );
  }

  const company = data?.data;

  return (
    <div className="space-y-6">
      {/* Formulário de dados da empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Configure os dados básicos e informações de contato da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Dados Básicos</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Nome da Empresa <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    error={form.formState.errors.name?.message}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    {...form.register('cnpj')}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    error={form.formState.errors.email?.message}
                    icon={Mail}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+55 11 99999-9999"
                    icon={Phone}
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    {...form.register('website')}
                    placeholder="https://www.empresa.com"
                    error={form.formState.errors.website?.message}
                    icon={Globe}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address.street">Rua/Avenida</Label>
                  <Input
                    id="address.street"
                    {...form.register('address.street')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address.number">Número</Label>
                  <Input
                    id="address.number"
                    {...form.register('address.number')}
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address.complement">Complemento</Label>
                  <Input
                    id="address.complement"
                    {...form.register('address.complement')}
                    placeholder="Sala, Andar, etc."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address.neighborhood">Bairro</Label>
                  <Input
                    id="address.neighborhood"
                    {...form.register('address.neighborhood')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address.city">Cidade</Label>
                  <Input
                    id="address.city"
                    {...form.register('address.city')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address.state">Estado</Label>
                  <Input
                    id="address.state"
                    {...form.register('address.state')}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address.zip_code">CEP</Label>
                  <Input
                    id="address.zip_code"
                    {...form.register('address.zip_code')}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => form.reset()}
                disabled={updateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Informações do plano */}
      {company && (
        <Card>
          <CardHeader>
            <CardTitle>Plano e Módulos</CardTitle>
            <CardDescription>
              Informações sobre seu plano atual e módulos habilitados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plano atual */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Plano Atual</h4>
                <p className="text-sm text-gray-600">
                  Usuários: {company.current_users}/{company.max_users}
                </p>
              </div>
              <Badge variant={planLabels[company.plan].variant}>
                {planLabels[company.plan].label}
              </Badge>
            </div>

            {/* Módulos habilitados */}
            <div>
              <h4 className="font-medium mb-3">Módulos Habilitados</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.enabled_modules.map((moduleKey) => {
                  const module = moduleLabels[moduleKey];
                  if (!module) return null;
                  
                  const Icon = module.icon;
                  
                  return (
                    <div key={moduleKey} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-sm">{module.label}</div>
                        <div className="text-xs text-gray-600">Módulo ativo</div>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}