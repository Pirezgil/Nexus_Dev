'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCustomer, useCustomerTags } from '@/hooks/api/use-customers';
import { useDocumentValidation } from '@/hooks/useDocumentValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { TagInput } from '@/components/modules/crm/TagInput';
import { withAuth } from '@/components/auth/withAuth';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Address } from '@/types';
import { createEmptyAddress, validateAddress, normalizeCEP } from '@/utils/address';
import { formatDocument } from '@/utils';
import { transformCustomerFormToApi } from '@/utils/customerDataTransform';

// Schema Zod atualizado para usar estrutura de endereço
const addressSchema = z.object({
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres (ex: SP)'),
  zipcode: z.string().min(8, 'CEP deve ter 8 dígitos').max(9, 'CEP inválido'),
});

const customerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 caracteres'),
  document: z.string().optional(),
  address: addressSchema.optional(),
  status: z.enum(['ACTIVE', 'PROSPECT', 'INACTIVE', 'BLOCKED']),
  tags: z.array(z.string()).default([]),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// Document Input Component - Moved outside to prevent re-renders
const DocumentInput = ({ 
  field, 
  documentValidation,
  onChange 
}: { 
  field: any; 
  documentValidation: any;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-2">
    <div className="relative">
      <FormControl>
        <Input
          placeholder="000.000.000-00"
          {...field}
          onChange={(e) => onChange(e.target.value)}
          className={`
            ${documentValidation.isDuplicate ? 'border-red-500 pr-10' : ''}
            ${documentValidation.isValid ? 'border-green-500 pr-10' : ''}
            ${documentValidation.isLoading ? 'border-blue-500 pr-10' : ''}
          `}
        />
      </FormControl>
      
      {/* Validation status icon */}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
        {documentValidation.isLoading && (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        {documentValidation.isValid && !documentValidation.isLoading && (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {documentValidation.isDuplicate && !documentValidation.isLoading && (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        {documentValidation.error && !documentValidation.isLoading && !documentValidation.isDuplicate && (
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        )}
      </div>
    </div>
    
    {/* Validation message */}
    {documentValidation.error && (
      <div className="text-sm text-red-600 flex items-center gap-1">
        <AlertCircle className="h-4 w-4" />
        {documentValidation.error}
      </div>
    )}
    
    {documentValidation.isDuplicate && (
      <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
        <strong>Atenção:</strong> Já existe um cliente cadastrado com este documento.
        <br />
        <span className="text-xs">Verifique se o cliente já está no sistema antes de continuar.</span>
      </div>
    )}
    
    <FormMessage />
  </div>
);

function NovoClientePage() {
  const router = useRouter();
  const createCustomerMutation = useCreateCustomer();
  const { data: availableTags } = useCustomerTags();
  const documentValidation = useDocumentValidation();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      document: '',
      address: createEmptyAddress(),
      status: 'PROSPECT',
      tags: [],
    },
  });

  // Handle document validation with debounce - using useCallback to prevent re-renders
  const handleDocumentChange = useCallback((value: string) => {
    const formatted = formatDocument(value);
    form.setValue('document', formatted);
    
    // Validate document after formatting
    if (formatted.replace(/\D/g, '').length >= 11) {
      documentValidation.validateDocument(formatted);
    } else {
      documentValidation.resetValidation();
    }
  }, [form, documentValidation]);

  const onSubmit = async (data: CustomerFormData) => {
    // Prevent submission if document is invalid or duplicate
    if (documentValidation.isDuplicate || documentValidation.error) {
      return;
    }

    try {
      // Transform form data to API format
      const apiData = transformCustomerFormToApi(data);
      await createCustomerMutation.mutateAsync(apiData);
      router.push('/crm');
    } catch (error) {
      // Error handled by mutation
    }
  };

  
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Novo Cliente
          </h1>
          <p className="text-slate-600">
            Cadastre um novo cliente no sistema
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
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
                          <Input placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
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
                        <DocumentInput field={field} documentValidation={documentValidation} onChange={handleDocumentChange} />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Endereço Estruturado */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Endereço</h3>
                  
                  {/* Rua e Número */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="address.street"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Rua/Avenida *</FormLabel>
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
                          <FormLabel>Número *</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Complemento e Bairro */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address.complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Apto 45, Sala 101" {...field} />
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
                          <FormLabel>Bairro *</FormLabel>
                          <FormControl>
                            <Input placeholder="Centro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Cidade, Estado e CEP */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade *</FormLabel>
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
                          <FormLabel>Estado *</FormLabel>
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
                          <FormLabel>CEP *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="00000-000" 
                              {...field}
                              onChange={(e) => {
                                const normalizedCEP = normalizeCEP(e.target.value);
                                field.onChange(normalizedCEP);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Status and Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PROSPECT">Prospect</SelectItem>
                            <SelectItem value="ACTIVE">Ativo</SelectItem>
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

                {/* Actions */}
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={createCustomerMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createCustomerMutation.isPending ||
                      documentValidation.isDuplicate ||
                      documentValidation.isLoading ||
                      !!documentValidation.error
                    }
                  >
                    {createCustomerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Cliente'
                    )}
                  </Button>
                </div>
                
                {/* Status message when document is duplicate */}
                {documentValidation.isDuplicate && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Não é possível salvar o cliente</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      O documento informado já está cadastrado para outro cliente.
                      Verifique os dados ou utilize outro documento.
                    </p>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(NovoClientePage);