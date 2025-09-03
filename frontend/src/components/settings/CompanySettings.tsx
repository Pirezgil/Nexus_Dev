// ERP Nexus - Configurações da Empresa
// Componente para edição dos dados da empresa (Admin apenas)

'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, MapPin, Phone, Mail, FileText, Settings2, Package } from 'lucide-react';
import { useCurrentUser } from '@/stores/auth';
import { toast } from '@/lib/toast';
import { formatDate } from '@/lib/dates';

const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cnpj: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.string().optional(),
  }),
});

type CompanyFormValues = z.infer<typeof companySchema>;

// Mock data da empresa
const mockCompany = {
  id: '1',
  name: 'Clínica Bella Vida',
  cnpj: '12.345.678/0001-90',
  email: 'contato@bellavida.com',
  phone: '+55 11 99999-9999',
  website: 'https://www.bellavida.com',
  address: {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Sala 456',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zip_code: '01234-567',
  },
  plan: 'premium',
  enabled_modules: ['CRM', 'SERVICES', 'AGENDAMENTO', 'REPORTS'],
  created_at: '2024-01-15T10:00:00Z',
  max_users: 20,
  current_users: 5,
};

const moduleLabels = {
  CRM: { label: 'CRM', icon: Building2, description: 'Gestão de Clientes' },
  SERVICES: { label: 'Serviços', icon: Package, description: 'Gestão de Serviços' },
  AGENDAMENTO: { label: 'Agendamento', icon: Settings2, description: 'Sistema de Agendas' },
  REPORTS: { label: 'Relatórios', icon: FileText, description: 'Dashboards e Análises' },
};

const planLabels = {
  basic: { label: 'Básico', color: 'bg-gray-100 text-gray-800' },
  premium: { label: 'Premium', color: 'bg-blue-100 text-blue-800' },
  enterprise: { label: 'Empresarial', color: 'bg-purple-100 text-purple-800' },
};

export const CompanySettings: React.FC = () => {
  const { company } = useCurrentUser();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [companyData, setCompanyData] = React.useState(mockCompany);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: companyData.name,
      cnpj: companyData.cnpj,
      email: companyData.email,
      phone: companyData.phone,
      website: companyData.website,
      address: companyData.address,
    },
  });

  const handleSubmit = async (data: CompanyFormValues) => {
    setIsUpdating(true);
    try {
      // API call para atualizar empresa
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
      toast.success('Dados da empresa atualizados com sucesso!');
      setCompanyData({ ...companyData, ...data });
    } catch (error) {
      toast.error('Erro ao atualizar dados da empresa');
      console.error('Company update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informações da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Dados básicos e informações de contato da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Dados Básicos</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
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
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    {...form.register('website')}
                    placeholder="https://www.empresa.com"
                    error={form.formState.errors.website?.message}
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

            <div className="flex justify-end">
              <Button type="submit" loading={isUpdating}>
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Informações do Plano */}
      <Card>
        <CardHeader>
          <CardTitle>Plano e Módulos</CardTitle>
          <CardDescription>
            Informações sobre seu plano atual e módulos habilitados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plano Atual */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Plano Atual</h4>
              <p className="text-sm text-gray-600">
                Usuários: {companyData.current_users}/{companyData.max_users}
              </p>
            </div>
            <Badge className={planLabels[companyData.plan].color}>
              {planLabels[companyData.plan].label}
            </Badge>
          </div>

          {/* Módulos Habilitados */}
          <div>
            <h4 className="font-medium mb-3">Módulos Habilitados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyData.enabled_modules.map((moduleKey) => {
                const module = moduleLabels[moduleKey];
                if (!module) return null;
                
                const Icon = module.icon;
                
                return (
                  <div key={moduleKey} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Icon className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-sm">{module.label}</div>
                      <div className="text-xs text-gray-600">{module.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Precisa de mais recursos?</h4>
            <p className="text-sm text-blue-800 mb-3">
              Entre em contato conosco para fazer upgrade do seu plano ou habilitar novos módulos.
            </p>
            <Button variant="outline" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Falar com Vendas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Empresa ativa desde</p>
                <p className="text-lg font-medium">
                  {new Date(companyData.created_at).getFullYear()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Módulos ativos</p>
                <p className="text-lg font-medium">{companyData.enabled_modules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Usuários cadastrados</p>
                <p className="text-lg font-medium">
                  {companyData.current_users}/{companyData.max_users}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};