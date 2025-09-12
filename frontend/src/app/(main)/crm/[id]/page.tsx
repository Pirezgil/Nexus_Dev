'use client';

import * as React from 'react';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  useCustomerComplete, 
  useUpdateCustomer, 
  useCreateCustomerNote,
  useCreateCustomerInteraction,
  useCustomerTags,
  Customer 
} from '@/hooks/api/use-customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/modules/crm/TagInput';
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
  Users,
  AlertTriangle,
  RefreshCw,
  WhatsApp,
  ExternalLink
} from 'lucide-react';
import { formatAddress, formatAddressCompact, createEmptyAddress, addressFromAPIResponse } from '@/utils/address';
import { formatPhone, formatDate } from '@/lib/format';
import { EnhancedInteractionTimeline } from '@/components/modules/crm/EnhancedInteractionTimeline';
import { CustomerHeader } from '@/components/modules/crm/CustomerHeader';
import { CustomerStats } from '@/components/modules/crm/CustomerStats';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

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
  tags: z.array(z.string()).default([]),
});

type EditCustomerFormData = z.infer<typeof editCustomerSchema>;

function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // React Query hooks
  const { customer, notes, interactions, appointments, isLoading, error, refetch } = useCustomerComplete(customerId);
  
  // HOTFIX: Ignore 404 and 500 errors from sub-resources (notes, interactions, appointments)
  // Sub-resource errors shouldn't prevent displaying main customer data
  const isIgnorableError = (err: any) => {
    const status = err?.response?.status || err?.status;
    return status === 404 || status === 500;
  };
  
  const hasRealError = customer.error || 
    (notes.error && !isIgnorableError(notes.error)) ||
    (interactions.error && !isIgnorableError(interactions.error)) ||
    (appointments.error && !isIgnorableError(appointments.error));
    
  console.log('🔧 HOTFIX DEBUG:', { 
    originalError: error, 
    hasRealError, 
    customerData: customer?.data?.name,
    customerError: customer.error,
    notesError: notes.error?.response?.status,
    interactionsError: interactions.error?.response?.status,
    appointmentsError: appointments.error?.response?.status,
    notesIgnorable: notes.error ? isIgnorableError(notes.error) : false,
    interactionsIgnorable: interactions.error ? isIgnorableError(interactions.error) : false,
    appointmentsIgnorable: appointments.error ? isIgnorableError(appointments.error) : false
  });
  const updateCustomerMutation = useUpdateCustomer();
  const createNoteMutation = useCreateCustomerNote();
  const createInteractionMutation = useCreateCustomerInteraction();
  const { data: availableTags } = useCustomerTags();

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
      tags: customer?.data?.tags || [],
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
        tags: customer.data.tags || [],
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
      toast({
        title: "Anotação adicionada",
        description: "A anotação foi salva com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a anotação.",
        variant: "destructive",
      });
    }
  };

  // Contact handlers
  const handleContact = (type: 'whatsapp' | 'email' | 'phone') => {
    if (!customer?.data) return;

    const contactInfo = {
      whatsapp: customer.data.phone,
      email: customer.data.email,
      phone: customer.data.phone,
    };

    if (!contactInfo[type]) {
      toast({
        title: "Informação não disponível",
        description: `O cliente não possui ${type === 'whatsapp' ? 'WhatsApp' : type === 'email' ? 'e-mail' : 'telefone'} cadastrado.`,
        variant: "destructive",
      });
      return;
    }

    let url = '';
    switch (type) {
      case 'whatsapp':
        url = `https://wa.me/${contactInfo.whatsapp?.replace(/\D/g, '')}`;
        break;
      case 'email':
        url = `mailto:${contactInfo.email}`;
        break;
      case 'phone':
        url = `tel:${contactInfo.phone?.replace(/\D/g, '')}`;
        break;
    }

    window.open(url, '_blank');
  };

  const handleSchedule = () => {
    // Navigate to scheduling page
    router.push(`/agendamento/novo?cliente=${customerId}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Dados atualizados",
      description: "As informações do cliente foram atualizadas.",
    });
  };

  // Format functions are now imported from format.ts

  if (isLoading) {
    return (
      <DashboardLayout
        title="Carregando..."
        subtitle="Buscando dados do cliente"
      >
        <div className="space-y-6">
          {/* Enhanced Loading Skeleton */}
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            
            {/* Header Skeleton */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="w-24 h-24 bg-muted rounded-full border-4 border-background"></div>
                  <div className="space-y-3">
                    <div className="h-8 bg-muted rounded w-48"></div>
                    <div className="h-4 bg-muted rounded w-32"></div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 bg-muted rounded w-20"></div>
                  <div className="h-10 bg-muted rounded w-24"></div>
                </div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-20"></div>
                      <div className="h-8 bg-muted rounded w-16"></div>
                    </div>
                    <div className="w-12 h-12 bg-muted rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-64 bg-muted rounded-lg"></div>
                <div className="h-48 bg-muted rounded-lg"></div>
              </div>
              <div className="space-y-4">
                <div className="h-40 bg-muted rounded-lg"></div>
                <div className="h-40 bg-muted rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (hasRealError || !customer?.data) {
    // Determine error type for better user feedback
    const isNetworkError = hasRealError && !navigator.onLine;
    const isServerError = hasRealError && (
      (customer.error?.response?.status >= 500) ||
      (notes.error?.response?.status >= 500) ||
      (interactions.error?.response?.status >= 500) ||
      (appointments.error?.response?.status >= 500)
    );
    
    return (
      <DashboardLayout
        title="Erro ao carregar cliente"
        subtitle={isNetworkError ? "Verifique sua conexão com a internet" : 
                 isServerError ? "Erro interno do servidor" :
                 "O cliente solicitado não foi localizado"}
      >
        <div className="max-w-md mx-auto text-center">
          <div className="mb-6">
            {isNetworkError ? (
              <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-red-600" />
              </div>
            )}
            
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {isNetworkError ? "Sem conexão com a internet" :
               isServerError ? "Erro no servidor" :
               "Cliente não encontrado"}
            </h3>
            
            <p className="text-muted-foreground mb-6">
              {isNetworkError ? 
                "Verifique sua conexão e tente novamente." :
               isServerError ? 
                "Ocorreu um erro interno. Tente novamente em alguns instantes." :
                "O cliente que você está procurando não existe ou foi removido."}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isRefreshing ? "Atualizando..." : "Tentar novamente"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => router.push('/crm')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Lista
            </Button>
          </div>
          
          {/* Additional error details for debugging (hidden in production) */}
          {process.env.NODE_ENV === 'development' && hasRealError && (
            <div className="mt-6 p-4 bg-muted rounded-lg text-left">
              <p className="text-sm font-mono text-muted-foreground">
                Error details: {JSON.stringify({
                  customerError: customer.error?.response?.status,
                  notesError: notes.error?.response?.status,
                  interactionsError: interactions.error?.response?.status,
                  appointmentsError: appointments.error?.response?.status,
                }, null, 2)}
              </p>
            </div>
          )}
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
      {/* Skip Links for Accessibility */}
      <nav 
        className="sr-only" 
        aria-label="Navegação rápida"
      >
        <a 
          href="#customer-info" 
          className="block p-2 bg-primary text-primary-foreground"
        >
          Pular para informações do cliente
        </a>
        <a 
          href="#customer-timeline" 
          className="block p-2 bg-primary text-primary-foreground"
        >
          Pular para timeline
        </a>
        <a 
          href="#customer-notes" 
          className="block p-2 bg-primary text-primary-foreground"
        >
          Pular para anotações
        </a>
      </nav>

      {/* Enhanced Customer Header */}
      <CustomerHeader
        customer={customerData}
        loading={isLoading}
        onEdit={() => router.push(`/crm/${customerId}/edit`)}
        onBack={() => router.push('/crm')}
        onContact={handleContact}
        onSchedule={handleSchedule}
      />

      {/* Customer Statistics Dashboard */}
      <CustomerStats
        customer={customerData}
        interactions={Array.isArray(interactions?.data) ? interactions.data : []}
        notes={Array.isArray(notes?.data) ? notes.data : []}
        appointments={Array.isArray(appointments?.data) ? appointments.data : []}
        loading={isLoading}
      />

      {/* Main Information Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <Card id="customer-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" aria-hidden="true" />
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

                      <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags</FormLabel>
                            <FormControl>
                              <TagInput
                                value={field.value}
                                onChange={field.onChange}
                                suggestions={availableTags || []}
                                placeholder="Digite e pressione Enter"
                              />
                            </FormControl>
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

        <TabsContent value="timeline" className="mt-6">
          <div id="customer-timeline">
            <EnhancedInteractionTimeline
              customerId={customerId}
              interactions={Array.isArray(interactions?.data) ? interactions.data : []}
              notes={Array.isArray(notes?.data) ? notes.data : []}
              loading={interactions?.isLoading || notes?.isLoading}
              onAddInteraction={(data) => {
                // Handle interaction creation
                createInteractionMutation.mutateAsync({
                  customerId,
                  data,
                });
              }}
              onAddNote={handleAddNote}
            />
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card id="customer-notes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" aria-hidden="true" />
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
      </Tabs>
    </DashboardLayout>
  );
}

export default withAuth(ClienteDetalhePage);