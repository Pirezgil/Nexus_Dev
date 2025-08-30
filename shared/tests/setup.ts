/**
 * Setup para testes unitários
 * Configurações globais e mocks compartilhados
 */

import { jest, expect, beforeEach, afterEach } from '@jest/globals';

// Mock do winston logger para evitar logs desnecessários durante testes
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock do path para compatibilidade cross-platform
const actualPath = jest.requireActual('path') as typeof import('path');
jest.mock('path', () => ({
  ...actualPath,
  join: jest.fn((...args) => args.join('/'))
}));

// Configurações globais para testes
beforeEach(() => {
  // Limpar console.log/warn/error durante testes
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restaurar console após cada teste
  jest.restoreAllMocks();
});

// Configuração global de timeout
jest.setTimeout(10000);

// Mock de variáveis de ambiente
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduzir logs durante testes

// Estender expect com matchers customizados
expect.extend({
  toBeValidResult(received: { valid: boolean; error?: string }) {
    const pass = received.valid === true && !received.error;
    return {
      message: () => `expected validation result to be valid, but got: ${JSON.stringify(received)}`,
      pass
    };
  },
  
  toBeInvalidResult(received: { valid: boolean; error?: string }) {
    const pass = received.valid === false && Boolean(received.error);
    return {
      message: () => `expected validation result to be invalid with error, but got: ${JSON.stringify(received)}`,
      pass
    };
  },
  
  toHaveValidationError(received: { valid: boolean; error?: string }, expectedError: string) {
    const pass = received.valid === false && received.error === expectedError;
    return {
      message: () => `expected validation error "${expectedError}", but got: "${received.error}"`,
      pass
    };
  }
});

// Declarar tipos para os matchers customizados
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidResult(): R;
      toBeInvalidResult(): R;
      toHaveValidationError(expectedError: string): R;
    }
  }
}

export {};