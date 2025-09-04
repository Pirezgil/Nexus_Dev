// ERP Nexus - Testes E2E para Fluxo de Autenticação
// Valida correção do loop de redirecionamento e fluxo completo

import { test, expect } from '@playwright/test';

test.describe('Fluxo de Autenticação - Correção de Loop', () => {
  
  test.beforeEach(async ({ page }) => {
    // Limpar localStorage antes de cada teste
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Usuário não autenticado: deve redirecionar para login sem loops', async ({ page }) => {
    // Interceptar requisições para simular API
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Token inválido' })
      });
    });

    // Navegar para página inicial
    await page.goto('/');
    
    // Aguardar carregamento e verificar se não está em loop
    await page.waitForLoadState('networkidle');
    
    // Verificar se foi redirecionado para login
    await expect(page).toHaveURL('/login');
    
    // Verificar se a página de login é renderizada corretamente
    await expect(page.locator('h1')).toContainText('ERP Nexus');
    await expect(page.locator('form')).toBeVisible();
    
    // Aguardar 3 segundos para garantir que não há redirecionamentos em loop
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/login');
  });

  test('Login bem-sucedido: deve redirecionar para dashboard sem loops', async ({ page }) => {
    // Mock da API de login
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tokens: {
              accessToken: 'mock_access_token',
              refreshToken: 'mock_refresh_token'
            },
            user: {
              id: 'user-1',
              firstName: 'Admin',
              lastName: 'Test',
              email: 'admin@teste.com',
              role: 'ADMIN',
              company: {
                id: 'company-1',
                name: 'Empresa Teste'
              }
            }
          }
        })
      });
    });

    // Mock da API de validação
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'user-1',
            email: 'admin@teste.com',
            role: 'ADMIN'
          },
          message: 'Token válido'
        })
      });
    });

    // Ir para página de login
    await page.goto('/login');
    
    // Preencher formulário e fazer login
    await page.fill('input[type="email"]', 'admin@teste.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
    await page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Verificar se está na página de dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Aguardar 3 segundos para garantir que não há loops
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/dashboard');
  });

  test('Usuário autenticado: não deve conseguir acessar login', async ({ page }) => {
    // Simular usuário já autenticado
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('erp_nexus_token', 'valid_token');
      localStorage.setItem('erp_nexus_refresh_token', 'valid_refresh_token');
      localStorage.setItem('erp-nexus-auth', JSON.stringify({
        state: {
          user: {
            id: 'user-1',
            firstName: 'Admin',
            lastName: 'Test',
            email: 'admin@teste.com',
            role: 'ADMIN'
          },
          company: {
            id: 'company-1',
            name: 'Empresa Teste'
          },
          isAuthenticated: true,
          status: 'authenticated',
          isInitialized: true
        },
        version: 0
      }));
    });

    // Mock da API de validação - usuário válido
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'user-1',
            email: 'admin@teste.com',
            role: 'ADMIN'
          },
          message: 'Token válido'
        })
      });
    });

    // Tentar acessar página de login
    await page.goto('/login');
    
    // Deve ser redirecionado para dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL('/dashboard');
    
    // Aguardar para verificar estabilidade
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/dashboard');
  });

  test('Rota protegida: usuário não autenticado deve ser redirecionado', async ({ page }) => {
    // Mock da API - token inválido
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Token inválido' })
      });
    });

    // Tentar acessar rota protegida diretamente
    await page.goto('/dashboard');
    
    // Deve ser redirecionado para login
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page).toHaveURL('/login');
    
    // Verificar estabilidade - sem loops
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/login');
  });

  test('Inicialização: tela de loading não deve persistir indefinidamente', async ({ page }) => {
    // Mock de API lenta mas que responde
    await page.route('**/api/auth/validate', async route => {
      // Simular delay de 2 segundos
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Token inválido' })
      });
    });

    const startTime = Date.now();
    
    // Navegar para página inicial
    await page.goto('/');
    
    // Aguardar que o redirecionamento aconteça
    await page.waitForURL('/login', { timeout: 15000 });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Verificar que o carregamento não demorou mais que 10 segundos
    expect(loadTime).toBeLessThan(10000);
    
    // Verificar que estamos na página de login
    await expect(page).toHaveURL('/login');
  });

  test('Console: não deve haver logs de erro excessivos', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    // Capturar erros do console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Mock da API
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Token inválido' })
      });
    });

    // Navegar e aguardar estabilização
    await page.goto('/');
    await page.waitForURL('/login');
    await page.waitForTimeout(2000);

    // Verificar que não há muitos erros no console
    // (alguns erros de CSS podem ser esperados durante o desenvolvimento)
    const significantErrors = consoleErrors.filter(error => 
      !error.includes('normalize.css') && 
      !error.includes('webkit-text-size-adjust') &&
      !error.includes('moz-focus-inner')
    );
    
    expect(significantErrors.length).toBeLessThanOrEqual(2);
  });
});