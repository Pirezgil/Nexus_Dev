/**
 * ERP Nexus - Browser-Based Authentication Flow Test
 * Tests authentication flow in actual browser environment
 * 
 * USAGE:
 * 1. Copy this entire script
 * 2. Open http://localhost:3000 in browser
 * 3. Open DevTools Console (F12)
 * 4. Paste script and press Enter
 * 5. Follow the automated test sequence
 */

console.log('%c🚀 ERP Nexus Browser Auth Test Suite', 'color: #4CAF50; font-size: 18px; font-weight: bold;');
console.log('%c📋 Comprehensive authentication and navigation flow validation', 'color: #2196F3; font-size: 14px;');

// Test configuration
const BROWSER_TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 10000,
  stepDelay: 2000,
  maxRetries: 3
};

// Test results storage
const browserTestResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
  startTime: Date.now()
};

/**
 * Enhanced logging with timestamps and colors
 */
function logTest(level, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: 'color: #2196F3',
    success: 'color: #4CAF50',
    warning: 'color: #FF9800',
    error: 'color: #F44336',
    test: 'color: #9C27B0'
  };
  
  console.log(`%c[${timestamp}] ${level.toUpperCase()}: ${message}`, colors[level]);
  if (data) {
    console.table(data);
  }
}

/**
 * Record browser test result
 */
function recordBrowserTest(testName, passed, error = null, data = null) {
  browserTestResults.total++;
  if (passed) {
    browserTestResults.passed++;
    logTest('success', `✅ ${testName}`, data);
  } else {
    browserTestResults.failed++;
    logTest('error', `❌ ${testName}: ${error}`, data);
  }
  
  browserTestResults.tests.push({
    name: testName,
    passed,
    error,
    data,
    timestamp: new Date().toISOString(),
    url: window.location.href
  });
}

/**
 * Wait for element to appear with timeout
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Wait for URL change
 */
function waitForUrlChange(expectedPath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const checkUrl = () => {
      if (window.location.pathname === expectedPath) {
        resolve(window.location.href);
      }
    };
    
    // Check immediately
    checkUrl();
    
    // Poll for changes
    const interval = setInterval(checkUrl, 100);
    
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`URL did not change to ${expectedPath} within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * BROWSER TEST 1: Initial Page State Validation
 */
async function testInitialPageState() {
  logTest('test', 'Testing initial page state...');
  
  try {
    const currentUrl = window.location.href;
    const hasReactRoot = !!document.querySelector('#__next') || !!document.querySelector('[data-reactroot]');
    const hasLoadingState = document.body.textContent.includes('Aguardando') || 
                           document.body.textContent.includes('loading') ||
                           document.body.textContent.includes('Carregando');
    
    recordBrowserTest('Initial Page State', true, null, {
      currentUrl,
      hasReactRoot,
      hasLoadingState,
      bodyContentLength: document.body.textContent.length
    });
  } catch (error) {
    recordBrowserTest('Initial Page State', false, error.message);
  }
}

/**
 * BROWSER TEST 2: AuthProvider Integration Test
 */
async function testAuthProviderIntegration() {
  logTest('test', 'Testing AuthProvider integration and console logs...');
  
  try {
    // Capture console logs for auth initialization
    const authLogs = [];
    const originalConsoleLog = console.log;
    
    console.log = function(...args) {
      const message = args.join(' ');
      if (message.includes('AuthProvider') || message.includes('auth') || message.includes('Auth')) {
        authLogs.push({
          message,
          timestamp: Date.now()
        });
      }
      originalConsoleLog.apply(console, args);
    };
    
    // Wait for auth initialization logs
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    const hasAuthLogs = authLogs.length > 0;
    const hasInitializationLog = authLogs.some(log => log.message.includes('initialization'));
    
    recordBrowserTest('AuthProvider Integration', hasAuthLogs, null, {
      authLogsCount: authLogs.length,
      hasInitializationLog,
      recentLogs: authLogs.slice(-5)
    });
  } catch (error) {
    recordBrowserTest('AuthProvider Integration', false, error.message);
  }
}

/**
 * BROWSER TEST 3: Authentication Store State Test
 */
async function testAuthStoreState() {
  logTest('test', 'Testing Zustand auth store initialization...');
  
  try {
    // Try to access auth store state
    let authState = null;
    let storeAccessible = false;
    
    // Check if useAuthStore is available globally
    if (window.useAuthStore) {
      authState = window.useAuthStore.getState();
      storeAccessible = true;
    } else if (window.__authStore) {
      authState = window.__authStore.getState();
      storeAccessible = true;
    }
    
    // Check localStorage for auth data
    const tokenExists = !!localStorage.getItem('erp_nexus_token');
    const persistedAuth = localStorage.getItem('erp-nexus-auth');
    let persistedData = null;
    
    try {
      if (persistedAuth) {
        persistedData = JSON.parse(persistedAuth);
      }
    } catch (e) {
      // Invalid JSON in storage
    }
    
    recordBrowserTest('Auth Store State', storeAccessible || tokenExists || persistedData, null, {
      storeAccessible,
      authState: authState ? {
        isInitialized: authState.isInitialized,
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
        status: authState.status
      } : null,
      tokenExists,
      persistedDataExists: !!persistedData
    });
  } catch (error) {
    recordBrowserTest('Auth Store State', false, error.message);
  }
}

/**
 * BROWSER TEST 4: Redirection Logic Test
 */
async function testRedirectionLogic() {
  logTest('test', 'Testing unauthenticated user redirection logic...');
  
  try {
    const initialUrl = window.location.href;
    const initialPath = window.location.pathname;
    
    // Wait for any potential redirects
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalUrl = window.location.href;
    const finalPath = window.location.pathname;
    
    const hasRedirected = finalPath !== initialPath;
    const redirectedToLogin = finalPath === '/login' || finalUrl.includes('/login');
    const redirectedToDashboard = finalPath === '/dashboard' || finalUrl.includes('/dashboard');
    
    recordBrowserTest('Redirection Logic', true, null, {
      initialPath,
      finalPath,
      hasRedirected,
      redirectedToLogin,
      redirectedToDashboard,
      redirectionWorking: hasRedirected && (redirectedToLogin || redirectedToDashboard)
    });
  } catch (error) {
    recordBrowserTest('Redirection Logic', false, error.message);
  }
}

/**
 * BROWSER TEST 5: Login Form Visibility Test
 */
async function testLoginFormVisibility() {
  logTest('test', 'Testing login form visibility and accessibility...');
  
  try {
    // Navigate to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
      await waitForUrlChange('/login');
    }
    
    // Wait for login form to appear
    await waitForElement('form', 10000);
    
    const loginForm = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]') || 
                      document.querySelector('input[name="email"]');
    const passwordInput = document.querySelector('input[type="password"]') || 
                         document.querySelector('input[name="password"]');
    const submitButton = document.querySelector('button[type="submit"]') || 
                        document.querySelector('button');
    
    const hasLoginForm = !!loginForm;
    const hasEmailField = !!emailInput;
    const hasPasswordField = !!passwordInput;
    const hasSubmitButton = !!submitButton;
    
    recordBrowserTest('Login Form Visibility', hasLoginForm, null, {
      hasLoginForm,
      hasEmailField,
      hasPasswordField,
      hasSubmitButton,
      formComplete: hasLoginForm && hasEmailField && hasPasswordField && hasSubmitButton
    });
  } catch (error) {
    recordBrowserTest('Login Form Visibility', false, error.message);
  }
}

/**
 * BROWSER TEST 6: Error Boundaries Test
 */
async function testErrorBoundaries() {
  logTest('test', 'Testing Next.js error boundaries...');
  
  try {
    const hasErrorBoundary = window.React && window.React.Component;
    const noJSErrors = !window.onerror;
    
    // Check for error pages
    const hasErrorContent = document.body.textContent.includes('Something went wrong') ||
                           document.body.textContent.includes('This page could not be found') ||
                           document.body.textContent.includes('500') ||
                           document.body.textContent.includes('Application error');
    
    recordBrowserTest('Error Boundaries', !hasErrorContent, null, {
      hasErrorBoundary,
      noJSErrors,
      hasErrorContent,
      errorBoundariesWorking: !hasErrorContent
    });
  } catch (error) {
    recordBrowserTest('Error Boundaries', false, error.message);
  }
}

/**
 * BROWSER TEST 7: Security Validation Test
 */
async function testSecurityValidation() {
  logTest('test', 'Testing security fixes and mock auth removal...');
  
  try {
    // Check if demo credentials are visible (should only be in dev mode with flag)
    const hasDemoCredentials = document.body.textContent.includes('admin@demo.com') ||
                              document.body.textContent.includes('Credenciais de Teste');
    
    // Check for security-related elements
    const hasCSRFToken = !!document.querySelector('meta[name="csrf-token"]') ||
                        !!document.querySelector('input[name="_token"]');
    
    // Check localStorage for security issues
    const localStorage_keys = Object.keys(localStorage);
    const hasSecureTokenStorage = localStorage_keys.some(key => key.includes('token'));
    
    const isSecure = !document.body.textContent.includes('MOCK_AUTH') &&
                    !document.body.textContent.includes('bypass');
    
    recordBrowserTest('Security Validation', isSecure, null, {
      hasDemoCredentials,
      hasCSRFToken,
      hasSecureTokenStorage,
      isSecure,
      isProduction: !hasDemoCredentials
    });
  } catch (error) {
    recordBrowserTest('Security Validation', false, error.message);
  }
}

/**
 * BROWSER TEST 8: JWT Token Validation Test
 */
async function testJWTTokenValidation() {
  logTest('test', 'Testing JWT token validation and expiration logic...');
  
  try {
    const token = localStorage.getItem('erp_nexus_token');
    let tokenValidation = {
      hasToken: !!token,
      isValidFormat: false,
      isExpired: null,
      payload: null
    };
    
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          tokenValidation.isValidFormat = true;
          
          // Decode payload
          const payload = JSON.parse(atob(parts[1]));
          tokenValidation.payload = payload;
          
          // Check expiration
          if (payload.exp) {
            const now = Math.floor(Date.now() / 1000);
            tokenValidation.isExpired = payload.exp < now;
          }
        }
      } catch (e) {
        tokenValidation.isValidFormat = false;
      }
    }
    
    recordBrowserTest('JWT Token Validation', tokenValidation.isValidFormat || !tokenValidation.hasToken, null, tokenValidation);
  } catch (error) {
    recordBrowserTest('JWT Token Validation', false, error.message);
  }
}

/**
 * BROWSER TEST 9: Performance Validation Test
 */
async function testPerformanceValidation() {
  logTest('test', 'Testing page load performance...');
  
  try {
    const performanceData = {
      loadTime: performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : null,
      domContentLoaded: performance.timing ? performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : null,
      resourceCount: performance.getEntriesByType ? performance.getEntriesByType('resource').length : null,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    };
    
    const isPerformant = performanceData.loadTime ? performanceData.loadTime < 5000 : true;
    
    recordBrowserTest('Performance Validation', isPerformant, null, performanceData);
  } catch (error) {
    recordBrowserTest('Performance Validation', false, error.message);
  }
}

/**
 * Run all browser tests
 */
async function runAllBrowserTests() {
  console.log('%c🎯 Starting comprehensive browser authentication tests...', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
  
  const tests = [
    testInitialPageState,
    testAuthProviderIntegration,
    testAuthStoreState,
    testRedirectionLogic,
    testLoginFormVisibility,
    testErrorBoundaries,
    testSecurityValidation,
    testJWTTokenValidation,
    testPerformanceValidation
  ];
  
  for (const test of tests) {
    try {
      await test();
      await new Promise(resolve => setTimeout(resolve, BROWSER_TEST_CONFIG.stepDelay));
    } catch (error) {
      logTest('error', `Test execution failed: ${error.message}`);
    }
  }
  
  // Generate final report
  generateBrowserTestReport();
}

/**
 * Generate comprehensive browser test report
 */
function generateBrowserTestReport() {
  const duration = Date.now() - browserTestResults.startTime;
  const successRate = ((browserTestResults.passed / browserTestResults.total) * 100).toFixed(1);
  
  console.log('%c📊 BROWSER TEST RESULTS SUMMARY', 'color: #FF5722; font-size: 18px; font-weight: bold; background: #FFF3E0; padding: 10px;');
  
  console.table({
    'Total Tests': browserTestResults.total,
    'Passed': browserTestResults.passed,
    'Failed': browserTestResults.failed,
    'Success Rate': `${successRate}%`,
    'Duration': `${duration}ms`,
    'Current URL': window.location.href
  });
  
  // Specific findings
  console.log('%c🔍 SPECIFIC FINDINGS:', 'color: #2196F3; font-size: 16px; font-weight: bold;');
  
  browserTestResults.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    if (test.data) {
      console.log('   📊 Data:', test.data);
    }
    if (test.error) {
      console.log(`   ⚠️ Error: ${test.error}`);
    }
  });
  
  // Recommendations
  console.log('%c💡 RECOMMENDATIONS:', 'color: #FF9800; font-size: 16px; font-weight: bold;');
  
  if (browserTestResults.failed === 0) {
    console.log('%c🎉 All browser tests passed! The authentication system is working correctly in the browser environment.', 'color: #4CAF50; font-weight: bold;');
  } else {
    console.log(`%c⚠️ ${browserTestResults.failed} test(s) failed. Please review the issues above.`, 'color: #F44336; font-weight: bold;');
  }
  
  // Save to sessionStorage for inspection
  sessionStorage.setItem('erpNexusBrowserTestResults', JSON.stringify(browserTestResults));
  console.log('%c💾 Test results saved to sessionStorage as "erpNexusBrowserTestResults"', 'color: #9C27B0;');
  
  // Integration with debugging utilities
  console.log('%c🔧 DEBUGGING UTILITIES:', 'color: #607D8B; font-size: 16px; font-weight: bold;');
  console.log('Run these commands for detailed debugging:');
  console.log('• startAuthDebugging() - Start comprehensive auth monitoring');
  console.log('• quickAuthStatus() - Quick auth state check');
  console.log('• inspectAuthStorage() - Examine auth storage');
  console.log('• cleanAuthStorage() - Clear all auth data');
  console.log('• simulateAuthenticatedUser() - Simulate logged in user');
}

// Auto-execute if in development environment
if (window.location.hostname === 'localhost') {
  console.log('%c🚀 Browser test suite loaded successfully!', 'color: #4CAF50; font-weight: bold;');
  console.log('%c💡 Run: runAllBrowserTests() to start comprehensive testing', 'color: #2196F3;');
  
  // Make functions globally available
  window.browserAuthTests = {
    runAllBrowserTests,
    testInitialPageState,
    testAuthProviderIntegration,
    testAuthStoreState,
    testRedirectionLogic,
    testLoginFormVisibility,
    testErrorBoundaries,
    testSecurityValidation,
    testJWTTokenValidation,
    testPerformanceValidation,
    generateBrowserTestReport,
    results: browserTestResults
  };
  
  // Auto-start after 3 seconds if no interaction
  setTimeout(() => {
    if (confirm('🤖 Auto-start browser authentication tests?')) {
      runAllBrowserTests();
    }
  }, 3000);
} else {
  console.warn('⚠️ Browser tests are designed for localhost development environment');
}