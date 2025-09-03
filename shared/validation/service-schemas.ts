import { z } from 'zod';
import { ServiceStatus } from '@prisma/client';

/**
 * Schema de validação compartilhado para Serviços
 * FONTE ÚNICA DA VERDADE para validações de serviços
 * Usado tanto no frontend (formulários) quanto no backend (APIs)
 */
export const ServiceValidationSchema = z.object({
  companyId: z.string().uuid('ID da empresa deve ser um UUID válido'),
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(255, 'O nome deve ter no máximo 255 caracteres')
    .trim(),
  description: z.string().optional(),
  duration: z.number()
    .int('A duração deve ser um número inteiro')
    .min(1, 'A duração mínima é de 1 minuto')
    .max(480, 'A duração máxima é de 480 minutos (8 horas)'),
  price: z.number()
    .positive('O preço deve ser um valor positivo')
    .multipleOf(0.01, 'O preço deve ter no máximo 2 casas decimais'),
  category: z.string()
    .max(100, 'A categoria deve ter no máximo 100 caracteres')
    .optional(),
  requirements: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * Schema para atualização de serviços (todos os campos opcionais)
 */
export const ServiceUpdateSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(255, 'O nome deve ter no máximo 255 caracteres')
    .trim()
    .optional(),
  description: z.string().optional(),
  duration: z.number()
    .int('A duração deve ser um número inteiro')
    .min(1, 'A duração mínima é de 1 minuto')
    .max(480, 'A duração máxima é de 480 minutos (8 horas)')
    .optional(),
  price: z.number()
    .positive('O preço deve ser um valor positivo')
    .multipleOf(0.01, 'O preço deve ter no máximo 2 casas decimais')
    .optional(),
  category: z.string()
    .max(100, 'A categoria deve ter no máximo 100 caracteres')
    .optional(),
  status: z.nativeEnum(ServiceStatus, {
    errorMap: () => ({ message: 'Status deve ser ACTIVE, INACTIVE ou MAINTENANCE' })
  }).optional(),
  requirements: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * Schema específico para formulário frontend (sem companyId que vem do contexto)
 */
export const ServiceFormSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(255, 'O nome deve ter no máximo 255 caracteres')
    .trim(),
  description: z.string().optional(),
  duration: z.number()
    .int('A duração deve ser um número inteiro')
    .min(1, 'A duração mínima é de 1 minuto')
    .max(480, 'A duração máxima é de 480 minutos (8 horas)'),
  price: z.number()
    .positive('O preço deve ser um valor positivo')
    .multipleOf(0.01, 'O preço deve ter no máximo 2 casas decimais'),
  category: z.string()
    .max(100, 'A categoria deve ter no máximo 100 caracteres')
    .optional(),
  requirements: z.string().optional(),
});

// Tipos TypeScript inferidos dos schemas
export type ServiceCreateData = z.infer<typeof ServiceValidationSchema>;
export type ServiceUpdateData = z.infer<typeof ServiceUpdateSchema>;
export type ServiceFormData = z.infer<typeof ServiceFormSchema>;

// Constantes para facilitar o uso
export const SERVICE_VALIDATION_RULES = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 255,
  DURATION_MIN: 1,
  DURATION_MAX: 480, // 8 horas em minutos
  CATEGORY_MAX_LENGTH: 100,
  PRICE_DECIMAL_PLACES: 2,
} as const;