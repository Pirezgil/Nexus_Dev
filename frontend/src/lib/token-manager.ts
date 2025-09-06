// ERP Nexus - Unified Token Manager
// Single source of truth for JWT token state with reactive updates

/**
 * Centralized token management system that solves the race condition
 * and synchronization issues in the JWT authentication flow.
 * 
 * Key Features:
 * - Single source of truth for token state
 * - Reactive updates to all subscribers
 * - Automatic localStorage synchronization
 * - Thread-safe operations
 * - Memory and persistence layer coordination
 */
export class TokenManager {
  private static instance: TokenManager | null = null;
  private currentToken: string | null = null;
  private refreshToken: string | null = null;
  private listeners: Set<(token: string | null) => void> = new Set();
  private isInitialized = false;

  // Singleton pattern for global token state
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  private constructor() {
    this.loadFromStorage();
    this.isInitialized = true;
  }

  /**
   * Get current token - always returns the most up-to-date value
   * This fixes the race condition where getAuthToken() returned stale values
   */
  getToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get refresh token for token renewal operations
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Update token and notify all subscribers
   * This ensures all parts of the app (interceptors, stores, hooks) get updated simultaneously
   * 
   * @param token - New access token
   * @param refresh - New refresh token (optional)
   */
  setToken(token: string | null, refresh?: string | null): void {
    const tokenChanged = this.currentToken !== token;
    const refreshChanged = refresh !== undefined && this.refreshToken !== refresh;

    // Update in-memory state
    this.currentToken = token;
    if (refresh !== undefined) {
      this.refreshToken = refresh;
    }

    // Sync to persistent storage
    this.syncToStorage();

    // Notify all subscribers if token actually changed
    if (tokenChanged) {
      this.notifyListeners(token);
    }

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 TokenManager: Token ${token ? 'set' : 'cleared'}`, {
        hasToken: !!token,
        hasRefresh: !!this.refreshToken,
        listenerCount: this.listeners.size,
        tokenPreview: token ? token.substring(0, 20) + '...' : null
      });
    }
  }

  /**
   * Subscribe to token changes - enables reactive updates
   * Returns unsubscribe function
   */
  subscribe(listener: (token: string | null) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current token for initial sync
    if (this.isInitialized) {
      listener(this.currentToken);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear all tokens and notify subscribers
   * Used during logout or when refresh fails
   */
  clear(): void {
    this.setToken(null, null);
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return !!this.currentToken;
  }

  /**
   * Load tokens from localStorage on initialization
   * Handles SSR safety
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      this.currentToken = localStorage.getItem('erp_nexus_token');
      this.refreshToken = localStorage.getItem('erp_nexus_refresh_token');

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 TokenManager: Loaded from storage', {
          hasToken: !!this.currentToken,
          hasRefresh: !!this.refreshToken
        });
      }
    } catch (error) {
      console.warn('⚠️ TokenManager: Failed to load from storage:', error);
      this.currentToken = null;
      this.refreshToken = null;
    }
  }

  /**
   * Sync current state to localStorage
   * Handles storage errors gracefully
   */
  private syncToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // Handle access token
      if (this.currentToken) {
        localStorage.setItem('erp_nexus_token', this.currentToken);
      } else {
        localStorage.removeItem('erp_nexus_token');
        // Also clear session storage as fallback cleanup
        sessionStorage.removeItem('erp_nexus_token');
      }

      // Handle refresh token
      if (this.refreshToken) {
        localStorage.setItem('erp_nexus_refresh_token', this.refreshToken);
      } else {
        localStorage.removeItem('erp_nexus_refresh_token');
      }
    } catch (error) {
      console.warn('⚠️ TokenManager: Failed to sync to storage:', error);
    }
  }

  /**
   * Notify all subscribers of token changes
   * Used for reactive updates across the app
   */
  private notifyListeners(token: string | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(token);
      } catch (error) {
        console.error('❌ TokenManager: Listener error:', error);
        // Remove faulty listener to prevent future errors
        this.listeners.delete(listener);
      }
    });
  }

  /**
   * Get current token statistics for debugging
   */
  getDebugInfo(): {
    hasToken: boolean;
    hasRefresh: boolean;
    listenerCount: number;
    tokenPreview: string | null;
    isInitialized: boolean;
  } {
    return {
      hasToken: !!this.currentToken,
      hasRefresh: !!this.refreshToken,
      listenerCount: this.listeners.size,
      tokenPreview: this.currentToken ? this.currentToken.substring(0, 20) + '...' : null,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Force reload tokens from storage
   * Useful for testing or manual synchronization
   */
  reloadFromStorage(): void {
    this.loadFromStorage();
    this.notifyListeners(this.currentToken);
  }
}

// Export singleton instance for direct use
export const tokenManager = TokenManager.getInstance();

// Export hooks for React components
export const useTokenManager = () => {
  const [token, setToken] = React.useState<string | null>(tokenManager.getToken());

  React.useEffect(() => {
    const unsubscribe = tokenManager.subscribe(setToken);
    return unsubscribe;
  }, []);

  return {
    token,
    refreshToken: tokenManager.getRefreshToken(),
    isAuthenticated: !!token,
    setToken: (newToken: string | null, refreshToken?: string | null) => 
      tokenManager.setToken(newToken, refreshToken),
    clear: () => tokenManager.clear(),
    debugInfo: tokenManager.getDebugInfo()
  };
};

// Type definitions for better TypeScript support
export interface TokenState {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface TokenManagerHook extends TokenState {
  setToken: (token: string | null, refreshToken?: string | null) => void;
  clear: () => void;
  debugInfo: ReturnType<TokenManager['getDebugInfo']>;
}

// React import for hooks (will be available in React components)
declare const React: typeof import('react');