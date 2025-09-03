'use client';

import * as React from 'react';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  useCustomerComplete, 
  useUpdateCustomer, 
  useCreateCustomerNote,
  useCreateCustomerInteraction,
  Customer 
} from '@/hooks/api/use-customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  MapPin, 
  Calendar, 
  Tag, 
  MessageSquare,
  Plus,
  Clock,
  Users
} from 'lucide-react';
import { formatAddress, formatAddressCompact, createEmptyAddress, addressFromAPIResponse } from '@/utils/address';
import { InteractionTimeline } from '@/components/modules/crm/InteractionTimeline';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Textarea } from '@/components/ui/textarea';

// Schema atualizado para endereço estruturado
const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
});

const editCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 caracteres'),
  document: z.string().optional(),
  address: addressSchema.optional(),
  status: z.enum(['ACTIVE', 'PROSPECT', 'INACTIVE', 'BLOCKED']),
});

type EditCustomerFormData = z.infer<typeof editCustomerSchema>;

function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');

  // React Query hooks
  const { customer, notes, interactions, appointments, isLoading, error } = useCustomerComplete(customerId);
  const updateCustomerMutation = useUpdateCustomer();
  const createNoteMutation = useCreateCustomerNote();
  const createInteractionMutation = useCreateCustomerInteraction();

  // Form for editing customer
  const form = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      name: customer?.data?.name || '',
      email: customer?.data?.email || '',
      phone: customer?.data?.phone || '',
      document: customer?.data?.document || '',
      address: customer?.data?.address || createEmptyAddress(),
      status: customer?.data?.status || 'ACTIVE',
    },
  });

  // Update form when customer data loads
  React.useEffect(() => {
    if (customer?.data) {
      form.reset({
        name: customer.data.name,
        email: customer.data.email || '',
        phone: customer.data.phone,
        document: customer.data.document || '',
        address: customer.data.address || createEmptyAddress(),
        status: customer.data.status,
      });
    }
  }, [customer?.data, form]);

  const onSubmitEdit = async (data: EditCustomerFormData) => {
    try {
      await updateCustomerMutation.mutateAsync({ id: customerId, data });
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await createNoteMutation.mutateAsync({
        customerId,
        data: {
          content: newNote,
          type: 'GENERAL',
          isPrivate: false,
        },
      });
      setNewNote('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '-';
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <DashboardLayout
        title="Carregando..."
        subtitle="Buscando dados do cliente"
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !customer?.data) {
    return (
      <DashboardLayout
        title="Cliente não encontrado"
        subtitle="O cliente solicitado não foi localizado"
      >
        <div className="text-center">
          <div className="text-gray-500">
            <User size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Cliente não encontrado</p>
            <Button onClick={() => router.push('/crm')} className="mt-4">
              Voltar para Lista
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const customerData = customer.data;

  return (
    <DashboardLayout
      title={customerData.name}
      subtitle="Detalhes do cliente"
    >
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/crm')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <Badge 
            className={
              customerData.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              customerData.status === 'PROSPECT' ? 'bg-blue-100 text-blue-800' :
              customerData.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }
          >
            {customerData.status === 'ACTIVE' ? 'Ativo' :
             customerData.status === 'PROSPECT' ? 'Prospect' :
             customerData.status === 'INACTIVE' ? 'Inativo' : 'Bloqueado'}
          </Badge>

          {isEditing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={updateCustomerMutation.isPending}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmitEdit)}
                disabled={updateCustomerMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateCustomerMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Form {...form}>
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                              <Input {...field} />
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
                            <FormLabel>Telefone *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="document"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF/CNPJ</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Endereço Estruturado - Rua e Número */}
                      <FormField
                        control={form.control}
                        name="address.street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua/Avenida</FormLabel>
                            <FormControl>
                              <Input placeholder="Rua das Flores" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="123" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.complement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input placeholder="Apto 45" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input placeholder="Centro" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input placeholder="São Paulo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="SP" 
                                maxLength={2}
                                style={{ textTransform: 'uppercase' }}
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address.zipcode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input placeholder="00000-000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Ativo</SelectItem>
                                <SelectItem value="PROSPECT">Prospect</SelectItem>
                                <SelectItem value="INACTIVE">Inativo</SelectItem>
                                <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <p className="text-gray-900">{customerData.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{customerData.email || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <p className="text-gray-900">{formatPhone(customerData.phone)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                    <p className="text-gray-900">{customerData.document || '-'}</p>
                  </div>
                  {customerData.address && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                      <p className="text-gray-900">{formatAddress(customerData.address)}</p>
                    </div>
                  )}
                  {customerData.tags && customerData.tags.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                      <div className="flex flex-wrap gap-1">
                        {customerData.tags.map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <InteractionTimeline 
            customerId={customerId}
            interactions={interactions?.data || []}
            notes={notes?.data || []}
            loading={interactions?.isLoading || notes?.isLoading}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Anotações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* New Note Form */}
              <div className="mb-6">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Adicione uma nova anotação..."
                  rows={3}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                  size="sm"
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createNoteMutation.isPending ? 'Adicionando...' : 'Adicionar Anotação'}
                </Button>
              </div>

              {/* Notes List */}
              <div className="space-y-4">
                {!notes?.data?.length ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhuma anotação ainda</p>
                  </div>
                ) : (
                  notes.data.map((note) => (
                    <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
                      <p className="text-gray-900 mb-2">{note.content}</p>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{note.user.name}</span>
                        <span>{formatDate(note.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Anotações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{notes?.data?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{interactions?.data?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cliente há</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor((Date.now() - new Date(customerData.createdAt).getTime()) / (1000 * 60 * 60 * 24))} dias
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

export default withAuth(ClienteDetalhePage);