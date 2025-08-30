// ERP Nexus - Login Form Component (CORRIGIDO)
// Sistema de autenticação integrado com User Management API
// ✅ CONFORMIDADE: Design System + Nova Biblioteca Modular

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

// ✅ CORRIGIDO: Importações da nova biblioteca modular
import { Button, Input, Alert, customColors } from '@shared/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/stores/ui';
import { cn } from '@/utils';

// Schema de validação
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ className }) => {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { success, error } = useToast();
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string>(''); // ✅ ADICIONADO: Estado para Alert

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setGeneralError(''); // ✅ CORRIGIDO: Limpar erro geral
      await login(data);
      success('Login realizado', 'Bem-vindo ao ERP Nexus!');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      const message = err.message || 'Erro no login';
      
      // Tratar erros específicos
      if (message.includes('email')) {
        setError('email', { message: 'Email não encontrado' });
      } else if (message.includes('password') || message.includes('senha')) {
        setError('password', { message: 'Senha incorreta' });
      } else {
        // ✅ CORRIGIDO: Usar Alert em vez de toast para erros gerais
        setGeneralError(message);
      }
    }
  };

  return (
    <div className={cn('w-full max-w-md space-y-6', className)}>
      {/* ✅ CORRIGIDO: Títulos usando cores do Design System */}
      <div className="text-center">
        <h2 
          className="text-3xl font-bold tracking-tight"
          style={{ color: customColors.textPrimary }}
        >
          Entrar no Sistema
        </h2>
        <p 
          className="mt-2 text-sm"
          style={{ color: customColors.textSecondary }}
        >
          Acesse sua conta do ERP Nexus
        </p>
      </div>

      {/* ✅ ADICIONADO: Alert para erros gerais conforme Design System */}
      {generalError && (
        <Alert type="error" title="Erro no Login" dismissible onDismiss={() => setGeneralError('')}>
          {generalError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('email')}
          label="Email"
          type="email"
          icon={Mail}
          placeholder="seu@email.com"
          error={errors.email?.message}
          autoComplete="email"
          required
        />

        <div className="relative">
          <Input
            {...register('password')}
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            placeholder="Sua senha"
            error={errors.password?.message}
            autoComplete="current-password"
            required
          />
          {/* ✅ CORRIGIDO: Botão de toggle usando cores do Design System */}
          <button
            type="button"
            className="absolute right-3 top-8 focus:outline-none transition-colors"
            style={{ 
              color: customColors.textSecondary,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = customColors.textPrimary}
            onMouseLeave={(e) => e.currentTarget.style.color = customColors.textSecondary}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* ✅ CORRIGIDO: Button com variant e size conforme Design System */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </Button>

        {/* ✅ CORRIGIDO: Link usando cores do Design System */}
        <div className="text-center">
          <a
            href="/forgot-password"
            className="text-sm transition-colors"
            style={{ color: customColors.primary }}
            onMouseEnter={(e) => e.currentTarget.style.color = customColors.accent}
            onMouseLeave={(e) => e.currentTarget.style.color = customColors.primary}
          >
            Esqueceu sua senha?
          </a>
        </div>
      </form>

      {/* ✅ CORRIGIDO: Demo credentials usando cores do Design System */}
      {process.env.NODE_ENV === 'development' && (
        <div 
          className="rounded-lg border p-4"
          style={{ 
            borderColor: '#E2E8F0',
            backgroundColor: customColors.bgLight
          }}
        >
          <p 
            className="text-xs mb-2 font-medium"
            style={{ color: customColors.textSecondary }}
          >
            💡 Credenciais de Teste:
          </p>
          <div 
            className="text-xs space-y-1"
            style={{ color: customColors.textPrimary }}
          >
            <div>
              <strong>Admin:</strong> admin@demo.com / 123456789
            </div>
            <div>
              <strong>Manager:</strong> manager@demo.com / 123456789
            </div>
            <div>
              <strong>User:</strong> usuario1@demo.com / 123456789
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;