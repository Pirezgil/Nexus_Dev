/**
 * Configuração do Jest para testes de validadores compartilhados
 */

module.exports = {
  // Ambiente de teste
  testEnvironment: 'node',
  
  // Extensões de arquivo a serem consideradas
  moduleFileExtensions: ['js', 'ts', 'json'],
  
  // Padrões de arquivos de teste
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  
  // Transformação de arquivos TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        lib: ['es2020'],
        allowJs: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true
      }
    }]
  },
  
  // Configuração do ts-jest
  preset: 'ts-jest',
  
  // Diretório raiz dos testes
  rootDir: '../',
  
  // Diretórios de teste
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Coleta de cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'validators/**/*.ts',
    'middleware/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**'
  ],
  
  // Formato de relatório de cobertura
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Diretório para saída de cobertura
  coverageDirectory: './coverage',
  
  // Limites de cobertura
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Configurações de timeout
  testTimeout: 10000,
  
  // Setup de testes
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  
  // Mocks automáticos
  clearMocks: true,
  restoreMocks: true,
  
  // Configuração de módulos
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@validators/(.*)$': '<rootDir>/validators/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1'
  },
  
  // Ignorar warnings específicos
  verbose: true,
  
};