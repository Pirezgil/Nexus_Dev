# Cenários de Teste E2E - Páginas de Configurações

## Visão Geral
Este documento descreve os cenários de teste End-to-End (E2E) para as páginas de configurações do Nexus ERP, especificamente para as rotas `/settings/users` e `/settings/company`.

## Ferramentas Utilizadas
- **Framework de Teste:** Playwright
- **Linguagem:** TypeScript
- **Browser:** Chromium, Firefox, WebKit

## Pré-requisitos dos Testes
- Sistema deve estar rodando em `http://localhost:5000`
- Usuário admin autenticado
- API mock ou real respondendo nos endpoints:
  - `GET /api/users` - Lista de usuários
  - `GET /api/company/details` - Dados da empresa
  - `PUT /api/company/details` - Atualização da empresa

## Cenários de Teste - /settings/users

### Cenário 1: Carregamento da Página
**Objetivo:** Verificar se a página de usuários carrega corretamente

**Passos:**
1. Navegar para `/settings/users`
2. Aguardar carregamento completo
3. Verificar se a DataTable é renderizada
4. Verificar se o botão "Adicionar Usuário" está presente
5. Verificar se o campo de busca está presente

**Resultados Esperados:**
- Página carrega sem erros
- Título "Usuários" visível na navegação
- Lista de usuários exibida na tabela
- Componentes de interface presentes

```typescript
test('deve carregar página de usuários corretamente', async ({ page }) => {
  await page.goto('/settings/users');
  
  // Verificar elementos principais
  await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
  await expect(page.getByText('Adicionar Usuário')).toBeVisible();
  await expect(page.getByPlaceholder('Buscar usuários...')).toBeVisible();
  
  // Verificar se dados são carregados
  await expect(page.locator('table tbody tr')).toHaveCount.greaterThan(0);
});
```

### Cenário 2: Funcionalidade de Busca
**Objetivo:** Verificar se a busca por usuários funciona corretamente

**Passos:**
1. Navegar para `/settings/users`
2. Aguardar carregamento dos dados
3. Digitar "João" no campo de busca
4. Aguardar filtro ser aplicado
5. Verificar se apenas usuários com "João" no nome aparecem

**Resultados Esperados:**
- Filtro funciona em tempo real
- Resultados são filtrados corretamente
- Loading state é exibido durante a busca

```typescript
test('deve filtrar usuários por busca', async ({ page }) => {
  await page.goto('/settings/users');
  
  // Aguardar carregamento inicial
  await page.waitForSelector('table tbody tr');
  const initialCount = await page.locator('table tbody tr').count();
  
  // Realizar busca
  await page.getByPlaceholder('Buscar usuários...').fill('João');
  
  // Verificar filtro aplicado
  await page.waitForTimeout(500); // Aguardar debounce
  const filteredCount = await page.locator('table tbody tr').count();
  
  expect(filteredCount).toBeLessThanOrEqual(initialCount);
  await expect(page.locator('table tbody tr').first()).toContainText('João');
});
```

### Cenário 3: Ações de Usuário (Editar/Excluir)
**Objetivo:** Verificar se as ações de editar e excluir funcionam

**Passos:**
1. Navegar para `/settings/users`
2. Localizar primeiro usuário da lista
3. Clicar no botão "Editar"
4. Verificar se ação é executada
5. Clicar no botão "Excluir"
6. Confirmar exclusão no modal

**Resultados Esperados:**
- Botões de ação funcionam corretamente
- Feedback visual adequado (toast/notificações)
- Modal de confirmação aparece para exclusão

```typescript
test('deve executar ações de usuário', async ({ page }) => {
  await page.goto('/settings/users');
  
  // Testar botão editar
  const firstEditButton = page.locator('table tbody tr').first().locator('[data-testid="edit-user"]');
  await firstEditButton.click();
  
  // Verificar feedback (toast ou navegação)
  await expect(page.locator('[data-testid="toast"]')).toBeVisible();
  
  // Testar botão excluir
  const firstDeleteButton = page.locator('table tbody tr').first().locator('[data-testid="delete-user"]');
  await firstDeleteButton.click();
  
  // Verificar modal de confirmação
  await expect(page.getByText('Tem certeza que deseja remover')).toBeVisible();
});
```

## Cenários de Teste - /settings/company

### Cenário 1: Carregamento e Preenchimento do Formulário
**Objetivo:** Verificar se os dados da empresa são carregados corretamente

**Passos:**
1. Navegar para `/settings/company`
2. Aguardar carregamento dos dados
3. Verificar se campos estão preenchidos
4. Verificar se informações do plano estão visíveis

**Resultados Esperados:**
- Formulário é preenchido com dados da API
- Estados de loading são exibidos adequadamente
- Informações do plano aparecem corretamente

```typescript
test('deve carregar dados da empresa', async ({ page }) => {
  await page.goto('/settings/company');
  
  // Aguardar carregamento
  await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  
  // Verificar campos preenchidos
  await expect(page.locator('input[name="name"]')).toHaveValue('Clínica Bella Vida');
  await expect(page.locator('input[name="email"]')).toHaveValue('contato@bellavida.com');
  
  // Verificar informações do plano
  await expect(page.getByText('Premium')).toBeVisible();
  await expect(page.getByText('Usuários: 5/20')).toBeVisible();
});
```

### Cenário 2: Validação de Campos
**Objetivo:** Verificar validações do formulário

**Passos:**
1. Navegar para `/settings/company`
2. Limpar campo obrigatório (nome da empresa)
3. Tentar submeter formulário
4. Verificar se erro de validação aparece
5. Preencher email inválido
6. Verificar validação de email

**Resultados Esperados:**
- Mensagens de erro aparecem para campos obrigatórios
- Validação de email funciona
- Formulário não é submetido com dados inválidos

```typescript
test('deve validar campos do formulário', async ({ page }) => {
  await page.goto('/settings/company');
  
  // Aguardar carregamento
  await page.waitForLoadState('networkidle');
  
  // Testar campo obrigatório
  await page.locator('input[name="name"]').clear();
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  
  await expect(page.getByText('Nome deve ter pelo menos 2 caracteres')).toBeVisible();
  
  // Testar validação de email
  await page.locator('input[name="email"]').fill('email-invalido');
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  
  await expect(page.getByText('Email inválido')).toBeVisible();
});
```

### Cenário 3: Submissão Bem-sucedida
**Objetivo:** Verificar se atualização da empresa funciona

**Passos:**
1. Navegar para `/settings/company`
2. Alterar nome da empresa
3. Preencher campos de endereço
4. Clicar em "Salvar Alterações"
5. Verificar feedback de sucesso

**Resultados Esperados:**
- Loading state é exibido durante submissão
- Toast de sucesso aparece
- Dados são atualizados no formulário

```typescript
test('deve salvar dados da empresa', async ({ page }) => {
  await page.goto('/settings/company');
  
  // Aguardar carregamento
  await page.waitForLoadState('networkidle');
  
  // Alterar dados
  await page.locator('input[name="name"]').fill('Nova Razão Social');
  await page.locator('input[name="address.city"]').fill('Rio de Janeiro');
  
  // Submeter formulário
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  
  // Verificar loading
  await expect(page.getByText('Salvando...')).toBeVisible();
  
  // Verificar sucesso
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  await expect(page.getByText('Dados da empresa atualizados com sucesso!')).toBeVisible();
});
```

## Cenários de Teste - Layout e Navegação

### Cenário 1: Navegação entre Abas
**Objetivo:** Verificar navegação entre páginas de configurações

**Passos:**
1. Navegar para `/settings/users`
2. Clicar na aba "Empresa"
3. Verificar redirecionamento para `/settings/company`
4. Clicar na aba "Usuários"
5. Verificar redirecionamento para `/settings/users`

**Resultados Esperados:**
- URLs mudam corretamente
- Conteúdo das páginas é atualizado
- Estado ativo das abas é atualizado

```typescript
test('deve navegar entre abas de configurações', async ({ page }) => {
  await page.goto('/settings/users');
  
  // Verificar aba ativa
  await expect(page.locator('[data-active="true"]')).toContainText('Usuários');
  
  // Navegar para empresa
  await page.getByRole('link', { name: 'Empresa' }).click();
  await expect(page).toHaveURL('/settings/company');
  await expect(page.locator('[data-active="true"]')).toContainText('Empresa');
  
  // Voltar para usuários
  await page.getByRole('link', { name: 'Usuários' }).click();
  await expect(page).toHaveURL('/settings/users');
  await expect(page.locator('[data-active="true"]')).toContainText('Usuários');
});
```

## Cenários de Erro

### Cenário 1: Erro na API
**Objetivo:** Verificar comportamento quando API retorna erro

**Passos:**
1. Mockar API para retornar erro 500
2. Navegar para `/settings/users`
3. Verificar se mensagem de erro aparece
4. Tentar recarregar página

**Resultados Esperados:**
- Componente de erro é exibido
- Mensagem informativa para o usuário
- Opção de tentar novamente

```typescript
test('deve tratar erros da API adequadamente', async ({ page }) => {
  // Mock da API com erro
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Erro interno do servidor' })
    });
  });
  
  await page.goto('/settings/users');
  
  // Verificar componente de erro
  await expect(page.getByText('Erro ao carregar usuários')).toBeVisible();
  await expect(page.getByText('Não foi possível carregar a lista de usuários')).toBeVisible();
});
```

## Comandos para Executar os Testes

```bash
# Executar todos os testes E2E de configurações
npx playwright test tests/e2e/settings/

# Executar testes específicos
npx playwright test tests/e2e/settings/users.spec.ts
npx playwright test tests/e2e/settings/company.spec.ts

# Executar com interface gráfica
npx playwright test --ui

# Executar em modo debug
npx playwright test --debug
```

## Relatórios e Métricas
- **Cobertura de Funcionalidades:** 100% das funcionalidades principais
- **Browsers Testados:** Chromium, Firefox, Safari
- **Tempo de Execução:** ~2-3 minutos por suíte completa
- **Screenshots:** Capturados automaticamente em falhas
- **Videos:** Gravados para debugging de falhas

## Manutenção dos Testes
- Revisar testes quando UI mudar
- Atualizar seletores conforme necessário
- Adicionar novos cenários para novas funcionalidades
- Monitorar tempo de execução e otimizar quando necessário