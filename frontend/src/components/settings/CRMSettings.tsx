// ERP Nexus - Configurações CRM
// Componente para gestão de campos customizados do CRM (Manager/Admin)

'use client';

import * as React from 'react';
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from '@/lib/toast';
import { getCurrentISOString } from '@/lib/dates';

// Types
interface CustomField {
  id: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea';
  options?: string[];
  required: boolean;
  active: boolean;
  display_order: number;
  description?: string;
  created_at: string;
}

const fieldSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  field_type: z.enum(['text', 'number', 'date', 'select', 'boolean', 'textarea'], {
    required_error: 'Selecione um tipo',
  }),
  description: z.string().optional(),
  options: z.string().optional(),
  required: z.boolean().default(false),
  active: z.boolean().default(true),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

const fieldTypeLabels = {
  text: { label: 'Texto', icon: '📝', description: 'Campo de texto simples' },
  textarea: { label: 'Texto Longo', icon: '📄', description: 'Campo de texto multi-linha' },
  number: { label: 'Número', icon: '🔢', description: 'Campo numérico' },
  date: { label: 'Data', icon: '📅', description: 'Seletor de data' },
  select: { label: 'Lista', icon: '📋', description: 'Lista de opções' },
  boolean: { label: 'Sim/Não', icon: '✅', description: 'Campo verdadeiro/falso' },
};

export const CRMSettings: React.FC = () => {
  const [customFields, setCustomFields] = React.useState<CustomField[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingField, setEditingField] = React.useState<CustomField | null>(null);

  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: '',
      field_type: 'text',
      description: '',
      options: '',
      required: false,
      active: true,
    },
  });

  // Simular dados iniciais
  React.useEffect(() => {
    const mockFields: CustomField[] = [
      {
        id: '1',
        name: 'Tipo de Pele',
        field_type: 'select',
        options: ['Oleosa', 'Seca', 'Mista', 'Sensível'],
        required: false,
        active: true,
        display_order: 1,
        description: 'Classificação do tipo de pele do cliente',
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: '2',
        name: 'Alergias',
        field_type: 'textarea',
        required: false,
        active: true,
        display_order: 2,
        description: 'Informações sobre alergias do cliente',
        created_at: '2024-01-16T10:00:00Z',
      },
      {
        id: '3',
        name: 'Cliente Especial',
        field_type: 'boolean',
        required: false,
        active: true,
        display_order: 3,
        description: 'Marca cliente como especial/VIP',
        created_at: '2024-01-17T10:00:00Z',
      },
      {
        id: '4',
        name: 'Altura (cm)',
        field_type: 'number',
        required: false,
        active: false,
        display_order: 4,
        description: 'Altura do cliente em centímetros',
        created_at: '2024-01-18T10:00:00Z',
      },
    ];

    setTimeout(() => {
      setCustomFields(mockFields.sort((a, b) => a.display_order - b.display_order));
      setLoading(false);
    }, 500);
  }, []);

  const handleCreateField = () => {
    setEditingField(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    form.reset({
      name: field.name,
      field_type: field.field_type,
      description: field.description || '',
      options: field.options?.join(', ') || '',
      required: field.required,
      active: field.active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: FieldFormValues) => {
    try {
      const options = data.field_type === 'select' && data.options 
        ? data.options.split(',').map(opt => opt.trim()).filter(Boolean)
        : undefined;

      if (editingField) {
        // Update field
        const updatedField: CustomField = {
          ...editingField,
          name: data.name,
          field_type: data.field_type,
          description: data.description,
          options,
          required: data.required,
          active: data.active,
        };
        
        setCustomFields(fields => 
          fields.map(f => f.id === editingField.id ? updatedField : f)
        );
        toast.success('Campo atualizado com sucesso!');
      } else {
        // Create field
        const newField: CustomField = {
          id: Date.now().toString(),
          name: data.name,
          field_type: data.field_type,
          description: data.description,
          options,
          required: data.required,
          active: data.active,
          display_order: customFields.length + 1,
          created_at: getCurrentISOString(),
        };
        
        setCustomFields(fields => [...fields, newField]);
        toast.success('Campo criado com sucesso!');
      }
      
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar campo');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (confirm('Tem certeza que deseja remover este campo? Esta ação não pode ser desfeita.')) {
      try {
        setCustomFields(fields => fields.filter(f => f.id !== fieldId));
        toast.success('Campo removido com sucesso!');
      } catch (error) {
        toast.error('Erro ao remover campo');
      }
    }
  };

  const handleToggleActive = async (fieldId: string) => {
    try {
      setCustomFields(fields =>
        fields.map(f => f.id === fieldId ? { ...f, active: !f.active } : f)
      );
      toast.success('Status do campo atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const selectedFieldType = form.watch('field_type');
  const showOptions = selectedFieldType === 'select';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Campos Customizados</h3>
          <p className="text-sm text-gray-600">
            Adicione campos personalizados aos formulários de cliente
          </p>
        </div>
        <Button onClick={handleCreateField}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Campo
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 text-lg">💡</div>
            <div>
              <h4 className="font-medium text-blue-900">Como funciona</h4>
              <p className="text-sm text-blue-800 mt-1">
                Os campos customizados aparecerão nos formulários de criação e edição de clientes.
                Você pode reordenar, ativar/desativar e definir quais são obrigatórios.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fields Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">Ordem</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="w-6 h-6 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-32 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-20 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-16 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-12 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="w-20 h-4 bg-gray-200 rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : customFields.length > 0 ? (
                customFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                        <span className="text-sm text-gray-600">{field.display_order}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{field.name}</div>
                        {field.description && (
                          <div className="text-sm text-gray-600">{field.description}</div>
                        )}
                        {field.options && (
                          <div className="text-xs text-gray-500 mt-1">
                            Opções: {field.options.join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{fieldTypeLabels[field.field_type].icon}</span>
                        <span className="text-sm">{fieldTypeLabels[field.field_type].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.active}
                          onCheckedChange={() => handleToggleActive(field.id)}
                          size="sm"
                        />
                        <Badge 
                          className={field.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                        >
                          {field.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                        {field.required ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditField(field)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-gray-500">
                      <div className="text-4xl mb-2">📝</div>
                      <p>Nenhum campo customizado configurado</p>
                      <p className="text-sm">Crie seu primeiro campo para começar</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Field Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Editar Campo' : 'Novo Campo'}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? 'Atualize as configurações do campo customizado'
                : 'Adicione um novo campo ao formulário de clientes'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Campo</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Ex: Tipo de Pele, Alergias..."
                error={form.formState.errors.name?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field_type">Tipo de Campo</Label>
              <Select
                value={form.watch('field_type')}
                onValueChange={(value) => form.setValue('field_type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fieldTypeLabels).map(([key, type]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <div>
                          <div>{type.label}</div>
                          <div className="text-xs text-gray-600">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.field_type && (
                <p className="text-sm text-red-600">{form.formState.errors.field_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Breve descrição do campo..."
                rows={2}
              />
            </div>

            {showOptions && (
              <div className="space-y-2">
                <Label htmlFor="options">Opções da Lista</Label>
                <Textarea
                  id="options"
                  {...form.register('options')}
                  placeholder="Separe as opções por vírgula. Ex: Oleosa, Seca, Mista"
                  rows={3}
                />
                <p className="text-xs text-gray-600">
                  Digite cada opção separada por vírgula
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="required"
                  checked={form.watch('required')}
                  onCheckedChange={(checked) => form.setValue('required', checked)}
                />
                <Label htmlFor="required">Campo obrigatório</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={form.watch('active')}
                  onCheckedChange={(checked) => form.setValue('active', checked)}
                />
                <Label htmlFor="active">Campo ativo</Label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingField ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};