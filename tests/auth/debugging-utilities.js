// ERP Nexus - Authentication Debugging Utilities
// Browser console utilities for debugging authentication flow issues

/**
 * USAGE: Copy and paste these functions into browser console for debugging
 * 
 * Quick Start:
 * 1. Open DevTools Console
 * 2. Copy this entire file content and paste into console
 * 3. Run: startAuthDebugging()
 * 4. Navigate through the app to see real-time auth state
 */

// =============================================================================
// AUTH STATE MONITORING
// =============================================================================

/**
 * Real-time auth state monitor
 * Shows current authentication state every 2 seconds
 */
function startAuthStateMonitor() {
  console.log('🔍 Starting Auth State Monitor...');
  
  const monitor = setInterval(() => {
    try {
      // Get Zustand store state directly if available
      let storeState = {};
      if (window.__authStore) {
        storeState = window.__authStore.getState();
      } else if (window.useAuthStore) {
        storeState = window.useAuthStore.getState();
      }
      
      // Get localStorage data
      const token = localStorage.getItem('erp_nexus_token');
      const refreshToken = localStorage.getItem('erp_nexus_refresh_token');
      const persistedAuth = localStorage.getItem('erp-nexus-auth');
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      
      // Parse persisted auth data
      let persistedData = {};
      try {
        if (persistedAuth) {
          persistedData = JSON.parse(persistedAuth);
        }
      } catch (e) {
        persistedData = { error: 'Invalid JSON in erp-nexus-auth' };
      }
      
      // Validate token format
      let tokenInfo = { valid: false };
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const now = Math.floor(Date.now() / 1000);
            tokenInfo = {
              valid: true,
              exp: payload.exp,
              expired: payload.exp < now,
              expiresIn: payload.exp > now ? Math.floor((payload.exp - now) / 60) + ' minutes' : 'expired',
              subject: payload.sub,
              email: payload.email
            };
          }
        } catch (e) {
          tokenInfo = { valid: false, error: 'Invalid token format' };
        }
      }
      
      console.group('🔍 Auth State Monitor - ' + new Date().toLocaleTimeString());
      
      console.table({
        'Current URL': window.location.pathname,
        'Is Initialized': storeState.isInitialized || 'Unknown',
        'Is Loading': storeState.isLoading || 'Unknown',
        'Is Authenticated': storeState.isAuthenticated || 'Unknown',
        'Status': storeState.status || 'Unknown',
        'User Email': storeState.user?.email || 'None',
        'Has Token': !!token,
        'Has Refresh': !!refreshToken,
        'Token Valid': tokenInfo.valid,
        'Token Expired': tokenInfo.expired || 'N/A',
        'Token Expires In': tokenInfo.expiresIn || 'N/A',
        'Redirect After Login': redirectPath || 'None'
      });
      
      if (tokenInfo.error) {
        console.warn('Token Error:', tokenInfo.error);
      }
      
      if (persistedData.error) {
        console.warn('Persisted Data Error:', persistedData.error);
      }
      
      console.groupEnd();
      
    } catch (error) {
      console.error('Auth Monitor Error:', error);
    }
  }, 2000);
  
  // Store reference to stop monitoring
  window.__authMonitorInterval = monitor;
  
  console.log('✅ Auth State Monitor started. Run stopAuthStateMonitor() to stop.');
  return monitor;
}

/**
 * Stop the auth state monitor
 */
function stopAuthStateMonitor() {
  if (window.__authMonitorInterval) {
    clearInterval(window.__authMonitorInterval);
    window.__authMonitorInterval = null;
    console.log('🛑 Auth State Monitor stopped.');
  } else {
    console.log('⚠️ No active Auth State Monitor found.');
  }
}

// =============================================================================
// STORAGE INSPECTION
// =============================================================================

/**
 * Comprehensive storage inspection
 * Shows all authentication-related data in storage
 */
function inspectAuthStorage() {
  console.group('🔍 Authentication Storage Inspection');
  
  // LocalStorage inspection
  console.group('📦 LocalStorage');
  const authKeys = [
    'erp_nexus_token',
    'erp_nexus_refresh_token',
    'erp_nexus_token_timestamp',
    'erp-nexus-auth'
  ];
  
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      if (key === 'erp-nexus-auth') {
        try {
          const parsed = JSON.parse(value);
          console.log(`${key}:`, parsed);
        } catch (e) {
          console.error(`${key} (Invalid JSON):`, value);
        }
      } else if (key.includes('token') && value.includes('.')) {
        console.log(`${key}:`, value.substring(0, 50) + '...');
      } else {
        console.log(`${key}:`, value);
      }
    } else {
      console.log(`${key}:`, '❌ Not found');
    }
  });
  console.groupEnd();
  
  // SessionStorage inspection
  console.group('📦 SessionStorage');
  const sessionKeys = [
    'redirectAfterLogin',
    'erp_nexus_token'
  ];
  
  sessionKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    console.log(`${key}:`, value || '❌ Not found');
  });
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * Clean all authentication storage
 */
function cleanAuthStorage() {
  console.log('🧹 Cleaning authentication storage...');
  
  // Clear localStorage
  const lsKeys = [
    'erp_nexus_token',
    'erp_nexus_refresh_token',
    'erp_nexus_token_timestamp',
    'erp-nexus-auth'
  ];
  
  lsKeys.forEach(key => {
    const existed = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    console.log(`localStorage.${key}:`, existed ? '✅ Removed' : '⚠️ Was not present');
  });
  
  // Clear sessionStorage
  const ssKeys = [
    'redirectAfterLogin',
    'erp_nexus_token'
  ];
  
  ssKeys.forEach(key => {
    const existed = sessionStorage.getItem(key) !== null;
    sessionStorage.removeItem(key);
    console.log(`sessionStorage.${key}:`, existed ? '✅ Removed' : '⚠️ Was not present');
  });
  
  console.log('✅ Authentication storage cleaned. Refresh page to see effects.');
}

// =============================================================================
// AUTH FLOW SIMULATION
// =============================================================================

/**
 * Simulate authenticated user state
 */
function simulateAuthenticatedUser() {
  console.log('🎭 Simulating authenticated user state...');
  
  // Create a valid-looking JWT token (expires far in future)
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJlbWFpbCI6ImFkbWluQGVycG5leHVzLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwNjcwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.mock_signature';
  const mockRefreshToken = 'mock_refresh_token_' + Date.now();
  
  // Set tokens in localStorage
  localStorage.setItem('erp_nexus_token', mockToken);
  localStorage.setItem('erp_nexus_refresh_token', mockRefreshToken);
  localStorage.setItem('erp_nexus_token_timestamp', Date.now().toString());
  
  // Set complete auth state
  const authState = {
    state: {
      user: {
        id: '1',
        email: 'admin@erpnexus.com',
        name: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      },
      company: {
        id: '1',
        name: 'ERP Nexus Test Company',
        slug: 'test-company'
      },
      token: mockToken,
      refreshToken: mockRefreshToken,
      isAuthenticated: true,
      status: 'authenticated',
      isInitialized: true,
      isLoading: false
    },
    version: 0
  };
  
  localStorage.setItem('erp-nexus-auth', JSON.stringify(authState));
  
  console.log('✅ Authenticated user state simulated. Refresh page to see effects.');
  console.log('👤 Mock User: admin@erpnexus.com (ADMIN)');
}

/**
 * Simulate unauthenticated user state
 */
function simulateUnauthenticatedUser() {
  console.log('🎭 Simulating unauthenticated user state...');
  
  // Clear all tokens
  cleanAuthStorage();
  
  // Set unauthenticated state
  const authState = {
    state: {
      user: null,
      company: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      status: 'unauthenticated',
      isInitialized: true,
      isLoading: false
    },
    version: 0
  };
  
  localStorage.setItem('erp-nexus-auth', JSON.stringify(authState));
  
  console.log('✅ Unauthenticated user state simulated. Refresh page to see effects.');
}

/**
 * Simulate expired token scenario
 */
function simulateExpiredToken() {
  console.log('🎭 Simulating expired token scenario...');
  
  // Create an expired JWT token
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJlbWFpbCI6ImFkbWluQGVycG5leHVzLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.expired_signature';
  const refreshToken = 'valid_refresh_token_' + Date.now();
  
  localStorage.setItem('erp_nexus_token', expiredToken);
  localStorage.setItem('erp_nexus_refresh_token', refreshToken);
  localStorage.setItem('erp_nexus_token_timestamp', Date.now().toString());
  
  console.log('✅ Expired token scenario simulated. Refresh page to see token refresh behavior.');
}

// =============================================================================
// PERFORMANCE TESTING
// =============================================================================

/**
 * Test page load performance
 */
function testPageLoadPerformance() {
  console.log('⏱️ Testing page load performance...');
  
  const startTime = performance.now();
  const startTimeStamp = Date.now();
  
  // Monitor for auth initialization completion
  const checkAuthReady = setInterval(() => {
    const token = localStorage.getItem('erp_nexus_token');
    const currentPath = window.location.pathname;
    
    if (currentPath === '/login' || (token && currentPath !== '/')) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      clearInterval(checkAuthReady);
      
      console.group('⏱️ Page Load Performance Results');
      console.log('Start Time:', new Date(startTimeStamp).toLocaleTimeString());
      console.log('End Time:', new Date().toLocaleTimeString());
      console.log('Total Duration:', Math.round(duration), 'ms');
      console.log('Final State:', {
        'URL': currentPath,
        'Has Token': !!token,
        'Performance Grade': duration < 2000 ? '✅ Excellent' : duration < 5000 ? '⚠️ Good' : '❌ Needs Improvement'
      });
      console.groupEnd();
    }
  }, 100);
  
  // Safety timeout
  setTimeout(() => {
    clearInterval(checkAuthReady);
    console.warn('⚠️ Performance test timeout after 10 seconds');
  }, 10000);
}

// =============================================================================
// NETWORK DEBUGGING
// =============================================================================

/**
 * Monitor authentication-related API calls
 */
function monitorAuthAPICalls() {
  console.log('🌐 Starting API call monitoring...');
  
  // Override fetch to monitor API calls
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    const [url, options] = args;
    
    // Check if it's an auth-related API call
    const isAuthAPI = url.includes('/auth/') || url.includes('/api/auth');
    
    if (isAuthAPI) {
      console.group('🌐 Auth API Call');
      console.log('URL:', url);
      console.log('Method:', options?.method || 'GET');
      console.log('Headers:', options?.headers || {});
      console.log('Timestamp:', new Date().toLocaleTimeString());
    }
    
    return originalFetch.apply(this, args)
      .then(response => {
        if (isAuthAPI) {
          console.log('Status:', response.status);
          console.log('OK:', response.ok);
          console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
          console.groupEnd();
        }
        return response;
      })
      .catch(error => {
        if (isAuthAPI) {
          console.error('Error:', error);
          console.groupEnd();
        }
        throw error;
      });
  };
  
  console.log('✅ API monitoring started. Auth API calls will be logged.');
  
  // Store original to restore later
  window.__originalFetch = originalFetch;
}

/**
 * Stop API call monitoring
 */
function stopAuthAPIMonitoring() {
  if (window.__originalFetch) {
    window.fetch = window.__originalFetch;
    delete window.__originalFetch;
    console.log('🛑 API call monitoring stopped.');
  } else {
    console.log('⚠️ No active API monitoring found.');
  }
}

// =============================================================================
// QUICK DEBUGGING COMMANDS
// =============================================================================

/**
 * Quick status check - shows everything at once
 */
function quickAuthStatus() {
  console.group('⚡ Quick Auth Status Check');
  
  inspectAuthStorage();
  
  // Show current auth state
  if (window.useAuthStore) {
    try {
      const state = window.useAuthStore.getState();
      console.table({
        'Initialized': state.isInitialized,
        'Loading': state.isLoading,
        'Authenticated': state.isAuthenticated,
        'Status': state.status,
        'User': state.user?.email || 'None'
      });
    } catch (e) {
      console.warn('Could not access auth store state:', e);
    }
  }
  
  console.groupEnd();
}

/**
 * Complete authentication debugging setup
 */
function startAuthDebugging() {
  console.log('🚀 Starting comprehensive auth debugging...');
  
  // Start all monitors
  startAuthStateMonitor();
  monitorAuthAPICalls();
  
  // Show initial state
  quickAuthStatus();
  
  console.log('📋 Available debugging functions:');
  console.log('- quickAuthStatus() - Show current auth state');
  console.log('- inspectAuthStorage() - Examine storage contents');
  console.log('- cleanAuthStorage() - Clear all auth data');
  console.log('- simulateAuthenticatedUser() - Set up authenticated state');
  console.log('- simulateUnauthenticatedUser() - Set up unauthenticated state');
  console.log('- simulateExpiredToken() - Test token refresh');
  console.log('- testPageLoadPerformance() - Measure load times');
  console.log('- stopAuthDebugging() - Stop all monitoring');
  
  console.log('✅ Auth debugging tools ready!');
}

/**
 * Stop all debugging activities
 */
function stopAuthDebugging() {
  console.log('🛑 Stopping all auth debugging...');
  
  stopAuthStateMonitor();
  stopAuthAPIMonitoring();
  
  console.log('✅ All auth debugging stopped.');
}

// =============================================================================
// ERROR SIMULATION
// =============================================================================

/**
 * Test error handling by corrupting storage
 */
function testErrorHandling() {
  console.log('💥 Testing error handling with corrupted data...');
  
  // Corrupt localStorage data
  localStorage.setItem('erp_nexus_token', 'not-a-jwt-token');
  localStorage.setItem('erp-nexus-auth', 'invalid-json-{');
  localStorage.setItem('erp_nexus_token_timestamp', 'not-a-timestamp');
  
  console.log('✅ Storage corrupted. Refresh page to test error handling.');
  console.log('Expected: App should clear corrupted data and redirect to login');
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

// Make all functions available globally for console use
window.authDebugUtils = {
  startAuthDebugging,
  stopAuthDebugging,
  startAuthStateMonitor,
  stopAuthStateMonitor,
  inspectAuthStorage,
  cleanAuthStorage,
  simulateAuthenticatedUser,
  simulateUnauthenticatedUser,
  simulateExpiredToken,
  testPageLoadPerformance,
  monitorAuthAPICalls,
  stopAuthAPIMonitoring,
  quickAuthStatus,
  testErrorHandling
};

// Auto-start debugging in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('🔧 Auth debugging utilities loaded. Run startAuthDebugging() to begin.');
  
  // Quick help
  console.log('💡 Quick start: startAuthDebugging()');
  console.log('💡 Quick check: quickAuthStatus()');
  console.log('💡 Clean slate: cleanAuthStorage()');
}