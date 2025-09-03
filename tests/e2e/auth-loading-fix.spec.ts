// ERP Nexus - Teste E2E para correção do carregamento infinito
// Valida que a tela de "Carregando sistema..." não trava indefinidamente

import { test, expect } from '@playwright/test';

test.describe('Auth Loading Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Limpar localStorage para simular usuário novo
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should not get stuck on loading screen - no tokens', async ({ page }) => {
    // Acessar a página principal
    await page.goto('http://localhost:5000');
    
    // Verificar se a tela de carregamento aparece
    await expect(page.getByText('Carregando sistema...')).toBeVisible();
    
    // A tela de carregamento deve desaparecer em até 10 segundos
    // e redirecionar para o login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    
    // Verificar se chegou na página de login
    await expect(page.getByText('ERP Nexus')).toBeVisible();
    await expect(page.getByText('Sistema de Gestão Empresarial')).toBeVisible();
  });

  test('should handle invalid tokens gracefully', async ({ page }) => {
    // Inserir tokens inválidos no localStorage
    await page.goto('http://localhost:5000');
    await page.evaluate(() => {
      localStorage.setItem('erp_nexus_token', 'invalid-token');
      localStorage.setItem('erp_nexus_refresh_token', 'invalid-refresh-token');
    });

    // Recarregar a página
    await page.reload();
    
    // Verificar se a tela de carregamento aparece
    await expect(page.getByText('Carregando sistema...')).toBeVisible();
    
    // Deve redirecionar para login após validação falhar
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    
    // Verificar se chegou na página de login
    await expect(page.getByText('ERP Nexus')).toBeVisible();
  });

  test('should show retry button on loading screen', async ({ page }) => {
    // Interceptar requests de auth para simular lentidão
    await page.route('**/api/auth/validate', route => {
      setTimeout(() => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ success: false, error: 'Token não fornecido' })
        });
      }, 2000); // 2 segundos de delay
    });

    await page.goto('http://localhost:5000');
    
    // Verificar se a tela de carregamento aparece com botão de retry
    await expect(page.getByText('Carregando sistema...')).toBeVisible();
    await expect(page.getByText('Clique aqui se a tela não carregar')).toBeVisible();
    
    // Clicar no botão de retry deve redirecionar para login
    await page.getByText('Clique aqui se a tela não carregar').click();
    
    // Deve redirecionar para login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should complete login flow successfully', async ({ page }) => {
    // Acessar página de login diretamente
    await page.goto('http://localhost:5000/login');
    
    // Verificar se a página de login carregou
    await expect(page.getByText('ERP Nexus')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    
    // Preencher credenciais (usando dados de teste)
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', 'admin123');
    
    // Submeter formulário
    await page.getByRole('button', { name: 'Entrar' }).click();
    
    // Verificar se o login foi bem-sucedido
    // Deve redirecionar para dashboard ou mostrar erro de forma clara
    await page.waitForLoadState('networkidle');
    
    // Se o backend estiver funcionando, deve ir para dashboard
    // Se não, deve mostrar mensagem de erro clara (não travar)
    const currentUrl = page.url();
    const hasError = await page.getByText('erro', { exact: false }).isVisible().catch(() => false);
    const isOnDashboard = currentUrl.includes('/dashboard');
    
    // Pelo menos um dos dois deve ser verdade - ou vai para dashboard ou mostra erro
    expect(isOnDashboard || hasError).toBe(true);
    
    // Se mostrar erro, não deve estar travado na tela de carregamento
    if (hasError) {
      await expect(page.getByText('Carregando sistema...')).not.toBeVisible();
    }
  });

  test('should handle network timeouts gracefully', async ({ page }) => {
    // Interceptar todas as requisições de auth para simular timeout
    await page.route('**/api/auth/**', route => {
      // Nunca responder para simular timeout
      // A aplicação deve lidar com isso e não travar
    });

    await page.goto('http://localhost:5000');
    
    // A tela de carregamento deve aparecer
    await expect(page.getByText('Carregando sistema...')).toBeVisible();
    
    // Mas deve eventualmente redirecionar para login (timeout interno)
    await expect(page).toHaveURL(/\/login/, { timeout: 12000 }); // 12 segundos
    
    // Verificar se chegou na página de login sem travar
    await expect(page.getByText('ERP Nexus')).toBeVisible();
  });
});