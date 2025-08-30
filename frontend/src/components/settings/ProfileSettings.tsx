// ERP Nexus - Configurações de Perfil
// Componente para edição do perfil pessoal do usuário

'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Lock, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { useCurrentUser } from '@/stores/auth';
import { useUpdateProfile, useChangePassword, useUploadAvatar } from '@/hooks/api/use-profile';
import { toast } from '@/hooks/use-toast';
import { AvatarCropModal } from '@/components/ui/AvatarCropModal';

const profileSchema = z.object({
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  email: z.string().refine((val) => !val || z.string().email().safeParse(val).success, {
    message: 'Email inválido'
  }),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Senha atual é obrigatória'),
  new_password: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
  confirm_password: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Senhas não coincidem',
  path: ['confirm_password'],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export const ProfileSettings: React.FC = () => {
  const { user } = useCurrentUser();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const uploadAvatarMutation = useUploadAvatar();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Estados para o editor de avatar
  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      avatar_url: user?.avatar || '',
    },
  });

  // Update form values when user data changes
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        avatar_url: user.avatar || '',
      });
    }
  }, [user, profileForm]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const handleProfileSubmit = async (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    changePasswordMutation.mutate(
      {
        current_password: data.current_password,
        new_password: data.new_password,
      },
      {
        onSuccess: () => {
          passwordForm.reset();
        },
      }
    );
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione apenas arquivos de imagem (JPG, PNG, WebP, GIF).",
          variant: "destructive",
        });
        return;
      }
      
      // Validar tamanho do arquivo
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB.",
          variant: "destructive",
        });
        return;
      }

      // Abrir modal de edição em vez de fazer upload direto
      setSelectedImageFile(file);
      setCropModalOpen(true);
    }
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleCroppedImageSave = (croppedImageBlob: Blob) => {
    // Converter Blob para File
    const croppedFile = new File([croppedImageBlob], 'avatar.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    
    // Fazer upload da imagem processada
    uploadAvatarMutation.mutate(croppedFile);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Informações do Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Atualize suas informações pessoais e dados de contato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="text-lg bg-blue-600 text-white">
                {user?.name ? getInitials(user.name) : 'UN'}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                onClick={handleAvatarClick}
                loading={uploadAvatarMutation.isPending}
                disabled={uploadAvatarMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadAvatarMutation.isPending ? 'Enviando...' : 'Alterar Foto'}
              </Button>
              <p className="text-sm text-gray-600 mt-2">
                JPG, PNG, WebP ou GIF. Máximo 5MB.
                <br />
                <span className="text-blue-600">✨ Editor com ajustes disponível!</span>
              </p>
            </div>
          </div>

          <Separator />

          {/* Profile Form */}
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  {...profileForm.register('firstName')}
                  error={profileForm.formState.errors.firstName?.message}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  {...profileForm.register('lastName')}
                  error={profileForm.formState.errors.lastName?.message}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...profileForm.register('email')}
                  error={profileForm.formState.errors.email?.message}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  {...profileForm.register('phone')}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                loading={updateProfileMutation.isPending}
                disabled={updateProfileMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Mantenha sua conta segura alterando sua senha regularmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Use uma senha forte com pelo menos 8 caracteres, incluindo letras maiúsculas, 
              minúsculas, números e símbolos.
            </AlertDescription>
          </Alert>

          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Senha Atual</Label>
              <Input
                id="current_password"
                type="password"
                {...passwordForm.register('current_password')}
                error={passwordForm.formState.errors.current_password?.message}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">Nova Senha</Label>
                <Input
                  id="new_password"
                  type="password"
                  {...passwordForm.register('new_password')}
                  error={passwordForm.formState.errors.new_password?.message}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  {...passwordForm.register('confirm_password')}
                  error={passwordForm.formState.errors.confirm_password?.message}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                variant="destructive" 
                loading={changePasswordMutation.isPending}
                disabled={changePasswordMutation.isPending}
              >
                <Lock className="w-4 h-4 mr-2" />
                Alterar Senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal de edição de avatar */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setSelectedImageFile(null);
        }}
        onSave={handleCroppedImageSave}
        imageFile={selectedImageFile}
      />
    </div>
  );
};