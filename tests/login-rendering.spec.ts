// ERP Nexus - Teste E2E de Renderização da Página de Login
// Valida se a página de login renderiza corretamente após a correção do erro SSR

import { test, expect, type Page } from '@playwright/test';

test.describe('Login Page Rendering', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Criar novo contexto e página para cada teste
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test('deve renderizar a página de login sem erros SSR', async () => {
    // Navegar para a página de login
    const response = await page.goto('http://localhost:3000/login');
    
    // Verificar se a resposta não é um erro 500
    expect(response?.status()).not.toBe(500);
    expect(response?.status()).toBe(200);
    
    // Verificar se não há erros de console relacionados ao carregamento de chunks
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Aguardar que a página seja totalmente renderizada
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Dar tempo para hydratação
    
    // Verificar se não há erros de chunks JavaScript
    const chunkErrors = consoleErrors.filter(error => 
      error.includes('_next/static/chunks') || 
      error.includes('main.js') ||
      error.includes('pages/_app.js') ||
      error.includes('react-refresh.js')
    );
    
    expect(chunkErrors).toHaveLength(0);
  });

  test('deve exibir elementos essenciais do formulário de login', async () => {
    await page.goto('http://localhost:3000/login');
    
    // Aguardar que os elementos sejam renderizados
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Verificar se o logo/título está presente
    await expect(page.getByText('ERP Nexus')).toBeVisible();
    
    // Verificar se o formulário de login está presente
    await expect(page.getByText('Entrar no Sistema')).toBeVisible();
    
    // Verificar se os campos de email e senha estão presentes
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('Sua senha')).toBeVisible();
    
    // Verificar se o botão de login está presente
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('deve permitir interação com os campos do formulário', async () => {
    await page.goto('http://localhost:3000/login');
    
    // Aguardar renderização completa
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Testar interação com campo de email
    const emailInput = page.getByPlaceholder('seu@email.com');
    await emailInput.fill('teste@exemplo.com');
    await expect(emailInput).toHaveValue('teste@exemplo.com');
    
    // Testar interação com campo de senha
    const passwordInput = page.getByPlaceholder('Sua senha');
    await passwordInput.fill('senha123');
    await expect(passwordInput).toHaveValue('senha123');
    
    // Verificar se o botão de toggle de senha funciona
    const toggleButton = page.locator('button[type="button"]').last();
    await toggleButton.click();
    
    // Verificar se o tipo do campo mudou para texto
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('deve carregar corretamente os chunks JavaScript', async () => {
    // Interceptar requisições para verificar se os chunks são carregados com sucesso
    const failedRequests: string[] = [];
    
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('_next/static')) {
        failedRequests.push(`${response.status()} - ${response.url()}`);
      }
    });
    
    await page.goto('http://localhost:3000/login');
    
    // Aguardar que todos os recursos sejam carregados
    await page.waitForLoadState('networkidle');
    
    // Verificar se não houve falhas no carregamento de chunks
    expect(failedRequests).toHaveLength(0);
  });

  test('deve funcionar corretamente após hidratação', async () => {
    await page.goto('http://localhost:3000/login');
    
    // Aguardar hidratação completa
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Verificar se os elementos são interativos após hidratação
    const loginButton = page.getByRole('button', { name: /entrar/i });
    
    // O botão deve estar habilitado e clicável
    await expect(loginButton).toBeEnabled();
    
    // Testar clique no botão (deve ser interativo)
    await loginButton.click();
    
    // Verificar se há validação de campos (indicando que o JavaScript está funcionando)
    await expect(page.getByText('Email é obrigatório')).toBeVisible();
  });

  test('deve exibir credenciais de teste em ambiente de desenvolvimento', async () => {
    await page.goto('http://localhost:3000/login');
    
    // Aguardar renderização
    await page.waitForLoadState('domcontentloaded');
    
    // Verificar se as credenciais de teste são exibidas
    await expect(page.getByText('💡 Credenciais de Teste:')).toBeVisible();
    await expect(page.getByText('admin@demo.com')).toBeVisible();
    await expect(page.getByText('manager@demo.com')).toBeVisible();
    await expect(page.getByText('usuario1@demo.com')).toBeVisible();
  });
});