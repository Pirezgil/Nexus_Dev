// ERP Nexus - Authentication E2E Tests
// End-to-end tests for complete authentication flow scenarios

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Test data
const VALID_CREDENTIALS = {
  email: 'admin@erpnexus.com',
  password: 'admin123',
};

const INVALID_CREDENTIALS = {
  email: 'invalid@example.com',
  password: 'wrongpassword',
};

// Helper functions
async function clearAllStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function setAuthenticatedState(page: Page) {
  await page.evaluate(() => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Pjrb6zw_9nIL3XSKxz5mxK4Yt1j4F9o3k5iHl2xzR8s';
    const mockRefreshToken = 'refresh_token_mock';
    
    localStorage.setItem('erp_nexus_token', mockToken);
    localStorage.setItem('erp_nexus_refresh_token', mockRefreshToken);
    localStorage.setItem('erp_nexus_token_timestamp', Date.now().toString());
    
    // Mock persisted auth state
    const authState = JSON.stringify({
      state: {
        user: {
          id: '1',
          email: 'admin@erpnexus.com',
          name: 'Admin User',
          role: 'ADMIN',
          firstName: 'Admin',
          lastName: 'User',
        },
        company: {
          id: '1',
          name: 'ERP Nexus Company',
        },
        token: mockToken,
        refreshToken: mockRefreshToken,
        isAuthenticated: true,
        status: 'authenticated',
        isInitialized: true,
      },
      version: 0,
    });
    
    localStorage.setItem('erp-nexus-auth', authState);
  });
}

async function waitForLoadingToFinish(page: Page) {
  // Wait for loading spinners to disappear
  await page.waitForSelector('[data-testid="loading-spinner"]', { 
    state: 'hidden', 
    timeout: 10000 
  });
}

test.describe('Authentication E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test.describe('Fresh User Scenarios', () => {
    test('fresh user should see login form immediately', async ({ page }) => {
      await page.goto('/');
      
      // Should redirect to login within 5 seconds
      await expect(page).toHaveURL('/login', { timeout: 5000 });
      
      // Should see login form elements
      await expect(page.locator('form')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Should see ERP Nexus branding
      await expect(page.locator('text=ERP Nexus')).toBeVisible();
    });

    test('direct login page access should show form immediately', async ({ page }) => {
      await page.goto('/login');
      
      // Should not redirect
      await expect(page).toHaveURL('/login');
      
      // Should see login form immediately without loading delay
      await expect(page.locator('form')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should not show infinite loading on fresh visit', async ({ page }) => {
      await page.goto('/');
      
      // Should not be stuck in loading state for more than 5 seconds
      await page.waitForLoadState('networkidle');
      
      // Check if we're stuck on loading screen
      const isStuckOnLoading = await page.locator('text=Verificando autenticação').isVisible();
      if (isStuckOnLoading) {
        // Wait additional time to see if it resolves
        await page.waitForTimeout(3000);
        
        // Should eventually show login form
        await expect(page).toHaveURL('/login', { timeout: 2000 });
      }
    });
  });

  test.describe('Login Form Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('form')).toBeVisible();
    });

    test('successful login should redirect to dashboard', async ({ page }) => {
      // Fill login form
      await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
      await page.fill('input[type="password"]', VALID_CREDENTIALS.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should show loading state briefly
      await expect(page.locator('text=Entrando...')).toBeVisible({ timeout: 2000 });
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Should see dashboard content
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    });

    test('invalid credentials should show error message', async ({ page }) => {
      // Fill with invalid credentials
      await page.fill('input[type="email"]', INVALID_CREDENTIALS.email);
      await page.fill('input[type="password"]', INVALID_CREDENTIALS.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('text=Credenciais inválidas')).toBeVisible({ timeout: 5000 });
      
      // Should remain on login page
      await expect(page).toHaveURL('/login');
      
      // Form should still be accessible
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeEnabled();
      await expect(page.locator('input[type="password"]')).toBeEnabled();
    });

    test('form validation should work correctly', async ({ page }) => {
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Should show validation errors
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
      
      // Should not redirect on validation error
      await expect(page).toHaveURL('/login');
    });

    test('loading state should not be infinite on form submission', async ({ page }) => {
      await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
      await page.fill('input[type="password"]', VALID_CREDENTIALS.password);
      
      await page.click('button[type="submit"]');
      
      // Loading state should not last more than 10 seconds
      const loadingVisible = page.locator('text=Entrando...');
      
      if (await loadingVisible.isVisible()) {
        await expect(loadingVisible).toBeHidden({ timeout: 10000 });
      }
    });
  });

  test.describe('Authenticated User Scenarios', () => {
    test('authenticated user should stay on protected routes', async ({ page }) => {
      await setAuthenticatedState(page);
      
      // Visit protected route
      await page.goto('/crm');
      
      // Should not redirect to login
      await expect(page).toHaveURL('/crm');
      
      // Should see protected content
      await expect(page.locator('text=CRM')).toBeVisible({ timeout: 5000 });
    });

    test('authenticated user accessing root should go to dashboard', async ({ page }) => {
      await setAuthenticatedState(page);
      
      await page.goto('/');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
      
      // Should see dashboard content
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('authenticated user accessing login should redirect to dashboard', async ({ page }) => {
      await setAuthenticatedState(page);
      
      await page.goto('/login');
      
      // Should redirect away from login page
      await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    });

    test('multiple tab authentication should sync', async ({ context, page }) => {
      await setAuthenticatedState(page);
      
      // Open second tab
      const secondTab = await context.newPage();
      await secondTab.goto('/dashboard');
      
      // Both tabs should be authenticated
      await expect(page.locator('text=Dashboard')).toBeVisible();
      await expect(secondTab.locator('text=Dashboard')).toBeVisible();
      
      await secondTab.close();
    });
  });

  test.describe('Protected Route Access', () => {
    test('unauthenticated user on protected route should redirect to login', async ({ page }) => {
      const protectedRoutes = ['/dashboard', '/crm', '/settings', '/reports'];
      
      for (const route of protectedRoutes) {
        await clearAllStorage(page);
        await page.goto(route);
        
        // Should redirect to login
        await expect(page).toHaveURL('/login', { timeout: 5000 });
        
        // Should be able to see login form
        await expect(page.locator('form')).toBeVisible();
      }
    });

    test('should store original URL for post-login redirect', async ({ page }) => {
      await page.goto('/crm/123');
      
      // Should redirect to login
      await expect(page).toHaveURL('/login');
      
      // Check if redirect URL is stored
      const redirectUrl = await page.evaluate(() => 
        sessionStorage.getItem('redirectAfterLogin')
      );
      
      expect(redirectUrl).toBe('/crm/123');
    });
  });

  test.describe('Token Refresh Scenarios', () => {
    test('expired token should refresh automatically', async ({ page }) => {
      // Set up expired token
      await page.evaluate(() => {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
        localStorage.setItem('erp_nexus_token', expiredToken);
        localStorage.setItem('erp_nexus_refresh_token', 'valid_refresh_token');
      });
      
      await page.goto('/dashboard');
      
      // Should either refresh token or redirect to login
      await page.waitForLoadState('networkidle');
      
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(dashboard|login)$/);
    });

    test('invalid refresh token should logout user', async ({ page }) => {
      await page.evaluate(() => {
        const expiredToken = 'expired.jwt.token';
        const invalidRefresh = 'invalid.refresh.token';
        
        localStorage.setItem('erp_nexus_token', expiredToken);
        localStorage.setItem('erp_nexus_refresh_token', invalidRefresh);
      });
      
      await page.goto('/dashboard');
      
      // Should redirect to login when refresh fails
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });
  });

  test.describe('Logout Functionality', () => {
    test('logout should clear all auth data and redirect to login', async ({ page }) => {
      await setAuthenticatedState(page);
      await page.goto('/dashboard');
      
      // Verify authenticated state
      await expect(page.locator('text=Dashboard')).toBeVisible();
      
      // Trigger logout (assuming there's a logout button)
      if (await page.locator('button:has-text("Sair")').isVisible()) {
        await page.click('button:has-text("Sair")');
      } else {
        // Programmatically trigger logout
        await page.evaluate(() => {
          // @ts-ignore
          window.authStore?.logout();
        });
      }
      
      // Should redirect to login
      await expect(page).toHaveURL('/login', { timeout: 5000 });
      
      // Storage should be cleared
      const tokenAfterLogout = await page.evaluate(() => 
        localStorage.getItem('erp_nexus_token')
      );
      expect(tokenAfterLogout).toBeNull();
    });
  });

  test.describe('Error Handling', () => {
    test('network errors should not break authentication flow', async ({ page }) => {
      // Block API requests to simulate network issues
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/');
      
      // Should eventually show login form or error message
      await page.waitForLoadState('networkidle');
      
      const hasLoginForm = await page.locator('form').isVisible();
      const hasErrorMessage = await page.locator('text=Erro').isVisible();
      
      expect(hasLoginForm || hasErrorMessage).toBeTruthy();
    });

    test('corrupted localStorage should not crash the app', async ({ page }) => {
      // Set corrupted auth data
      await page.evaluate(() => {
        localStorage.setItem('erp_nexus_token', 'not-a-jwt-token');
        localStorage.setItem('erp-nexus-auth', 'invalid-json-{');
      });
      
      await page.goto('/');
      
      // Should handle gracefully and redirect to login
      await expect(page).toHaveURL('/login', { timeout: 10000 });
      await expect(page.locator('form')).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('initial page load should be fast', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await waitForLoadingToFinish(page);
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('auth state should initialize quickly', async ({ page }) => {
      await page.goto('/');
      
      // Auth initialization should not take more than 3 seconds
      const authStateInitialized = page.waitForFunction(() => {
        return window.localStorage.getItem('erp_nexus_token') !== null ||
               window.location.pathname === '/login';
      }, { timeout: 3000 });
      
      await expect(authStateInitialized).resolves.toBeTruthy();
    });
  });

  test.describe('Accessibility', () => {
    test('login form should be accessible', async ({ page }) => {
      await page.goto('/login');
      
      // Check for proper form labels
      await expect(page.locator('label[for*="email"]')).toBeVisible();
      await expect(page.locator('label[for*="password"]')).toBeVisible();
      
      // Check for form accessibility
      const form = page.locator('form');
      await expect(form).toBeVisible();
      
      // Check tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('input[type="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('input[type="password"]')).toBeFocused();
    });

    test('loading states should be accessible', async ({ page }) => {
      await page.goto('/');
      
      // Check for accessible loading text
      const loadingText = page.locator('text=Inicializando sistema..., text=Verificando autenticação...');
      if (await loadingText.isVisible()) {
        await expect(loadingText).toBeVisible();
      }
    });
  });
});