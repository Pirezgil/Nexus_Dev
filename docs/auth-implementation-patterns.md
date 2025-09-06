# ERP Nexus - Authentication Implementation Patterns

## Core Implementation Components

### 1. Token Storage Layer

```typescript
// types/auth.ts
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

interface StorageAdapter {
  get(): Promise<TokenPair | null>;
  set(tokens: TokenPair): Promise<void>;
  remove(): Promise<void>;
  isAvailable(): boolean;
}

// storage/SecureTokenStorage.ts
class SecureTokenStorage {
  private adapters: StorageAdapter[] = [];
  private encryptionKey: CryptoKey | null = null;

  constructor() {
    this.initializeAdapters();
    this.initializeEncryption();
  }

  private async initializeAdapters(): Promise<void> {
    // Primary: Encrypted LocalStorage
    this.adapters.push(new EncryptedLocalStorageAdapter());
    
    // Backup: Encrypted SessionStorage  
    this.adapters.push(new EncryptedSessionStorageAdapter());
    
    // Fallback: Memory Storage
    this.adapters.push(new MemoryStorageAdapter());
    
    // Filter available adapters
    this.adapters = this.adapters.filter(adapter => adapter.isAvailable());
  }

  async setTokens(tokens: TokenPair): Promise<void> {
    const encryptedTokens = await this.encryptTokens(tokens);
    
    const promises = this.adapters.map(async (adapter) => {
      try {
        await adapter.set(encryptedTokens);
        return { success: true, adapter: adapter.constructor.name };
      } catch (error) {
        return { success: false, adapter: adapter.constructor.name, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    if (successful === 0) {
      throw new TokenStorageError('Failed to store tokens in any adapter');
    }

    console.log(`Tokens stored successfully in ${successful}/${this.adapters.length} adapters`);
  }

  async getTokens(): Promise<TokenPair | null> {
    for (const adapter of this.adapters) {
      try {
        const encryptedTokens = await adapter.get();
        if (encryptedTokens) {
          const tokens = await this.decryptTokens(encryptedTokens);
          if (this.validateTokens(tokens)) {
            return tokens;
          }
        }
      } catch (error) {
        console.warn(`Token retrieval failed from ${adapter.constructor.name}:`, error);
      }
    }
    return null;
  }

  private async encryptTokens(tokens: TokenPair): Promise<TokenPair> {
    if (!this.encryptionKey) return tokens;
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encryptString = async (text: string): Promise<string> => {
      const data = encoder.encode(text);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey!,
        data
      );

      return btoa(JSON.stringify({
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
      }));
    };

    return {
      ...tokens,
      accessToken: await encryptString(tokens.accessToken),
      refreshToken: await encryptString(tokens.refreshToken)
    };
  }
}

// storage/EncryptedLocalStorageAdapter.ts
class EncryptedLocalStorageAdapter implements StorageAdapter {
  private key = 'erp_nexus_tokens_v2';

  async get(): Promise<TokenPair | null> {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(tokens: TokenPair): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(tokens));
  }

  async remove(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  isAvailable(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. Mutex Implementation for Concurrency Control

```typescript
// utils/Mutex.ts
class Mutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  async acquire<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        try {
          const result = await operation();
          this.release();
          resolve(result);
        } catch (error) {
          this.release();
          reject(error);
        }
      };

      if (!this.locked) {
        this.locked = true;
        executeOperation();
      } else {
        this.waitQueue.push(executeOperation);
      }
    });
  }

  private release(): void {
    if (this.waitQueue.length > 0) {
      const nextOperation = this.waitQueue.shift()!;
      nextOperation();
    } else {
      this.locked = false;
    }
  }
}
```

### 3. Token Refresh Manager with Circuit Breaker

```typescript
// auth/TokenRefreshManager.ts
class TokenRefreshManager {
  private refreshMutex = new Mutex();
  private circuitBreaker = new CircuitBreaker();
  private storage: SecureTokenStorage;
  private apiClient: ApiClient;

  constructor(storage: SecureTokenStorage, apiClient: ApiClient) {
    this.storage = storage;
    this.apiClient = apiClient;
  }

  async refreshTokens(): Promise<TokenPair> {
    return this.refreshMutex.acquire(async () => {
      return this.circuitBreaker.execute(async () => {
        const currentTokens = await this.storage.getTokens();
        
        if (!currentTokens?.refreshToken) {
          throw new AuthError('No refresh token available', 'NO_REFRESH_TOKEN');
        }

        if (this.isTokenExpired(currentTokens.refreshToken)) {
          throw new AuthError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
        }

        // Use separate API instance to avoid interceptor loops
        const refreshClient = this.createRefreshClient();
        
        const response = await refreshClient.post('/auth/refresh', {
          refreshToken: currentTokens.refreshToken
        });

        if (!response.data.success || !response.data.data) {
          throw new AuthError('Token refresh failed', 'REFRESH_FAILED');
        }

        const newTokens: TokenPair = {
          accessToken: response.data.data.accessToken,
          refreshToken: response.data.data.refreshToken,
          expiresAt: Date.now() + (response.data.data.expiresIn * 1000),
          tokenType: 'Bearer'
        };

        // Atomic storage update
        await this.storage.setTokens(newTokens);

        return newTokens;
      });
    });
  }

  private createRefreshClient(): ApiClient {
    return new ApiClient({
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
      timeout: 10000,
      // No interceptors to avoid loops
    });
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
```

### 4. Circuit Breaker Implementation

```typescript
// utils/CircuitBreaker.ts
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeout;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN' || this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.successCount = 0;
    }
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
  }
}
```

### 5. Enhanced API Interceptor

```typescript
// api/EnhancedInterceptor.ts
interface QueuedRequest {
  config: RequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

class EnhancedAuthInterceptor {
  private failedQueue: QueuedRequest[] = [];
  private isRefreshing = false;
  private tokenRefreshManager: TokenRefreshManager;
  private storage: SecureTokenStorage;

  constructor(tokenRefreshManager: TokenRefreshManager, storage: SecureTokenStorage) {
    this.tokenRefreshManager = tokenRefreshManager;
    this.storage = storage;
  }

  setupInterceptors(apiClient: AxiosInstance): void {
    // Request interceptor
    apiClient.interceptors.request.use(
      async (config) => {
        const tokens = await this.storage.getTokens();
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor  
    apiClient.interceptors.response.use(
      (response) => response,
      async (error) => this.handleResponseError(error)
    );
  }

  private async handleResponseError(error: AxiosError): Promise<any> {
    const originalRequest = error.config as RequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (this.isRefreshing) {
        return this.queueRequest(originalRequest);
      }

      originalRequest._retry = true;
      this.isRefreshing = true;

      try {
        const newTokens = await this.tokenRefreshManager.refreshTokens();
        this.processQueue(null, newTokens.accessToken);
        
        // Update original request with new token
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return axios.request(originalRequest);
        
      } catch (refreshError) {
        this.processQueue(refreshError, null);
        
        // Clear authentication state
        await this.clearAuthState();
        
        // Redirect to login
        this.redirectToLogin();
        
        throw refreshError;
      } finally {
        this.isRefreshing = false;
      }
    }

    throw error;
  }

  private queueRequest(config: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.failedQueue.push({ config, resolve, reject });
    });
  }

  private processQueue(error: Error | null, token: string | null): void {
    this.failedQueue.forEach(({ config, resolve, reject }) => {
      if (error) {
        reject(error);
      } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        resolve(axios.request(config));
      }
    });

    this.failedQueue = [];
  }

  private async clearAuthState(): Promise<void> {
    await this.storage.clearTokens();
    // Clear other auth-related data
  }

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}
```

### 6. Authentication State Machine

```typescript
// auth/AuthStateMachine.ts
enum AuthState {
  INITIALIZING = 'initializing',
  UNAUTHENTICATED = 'unauthenticated', 
  AUTHENTICATED = 'authenticated',
  REFRESHING = 'refreshing',
  EXPIRED = 'expired',
  ERROR = 'error'
}

interface StateTransition {
  from: AuthState;
  to: AuthState;
  condition?: () => boolean;
}

class AuthStateMachine {
  private allowedTransitions: StateTransition[] = [
    { from: AuthState.INITIALIZING, to: AuthState.AUTHENTICATED },
    { from: AuthState.INITIALIZING, to: AuthState.UNAUTHENTICATED },
    { from: AuthState.INITIALIZING, to: AuthState.ERROR },
    
    { from: AuthState.UNAUTHENTICATED, to: AuthState.AUTHENTICATED },
    { from: AuthState.UNAUTHENTICATED, to: AuthState.INITIALIZING },
    
    { from: AuthState.AUTHENTICATED, to: AuthState.REFRESHING },
    { from: AuthState.AUTHENTICATED, to: AuthState.EXPIRED },
    { from: AuthState.AUTHENTICATED, to: AuthState.UNAUTHENTICATED },
    
    { from: AuthState.REFRESHING, to: AuthState.AUTHENTICATED },
    { from: AuthState.REFRESHING, to: AuthState.UNAUTHENTICATED },
    { from: AuthState.REFRESHING, to: AuthState.ERROR },
    
    { from: AuthState.EXPIRED, to: AuthState.REFRESHING },
    { from: AuthState.EXPIRED, to: AuthState.UNAUTHENTICATED },
    
    { from: AuthState.ERROR, to: AuthState.INITIALIZING },
    { from: AuthState.ERROR, to: AuthState.UNAUTHENTICATED },
  ];

  canTransition(from: AuthState, to: AuthState): boolean {
    return this.allowedTransitions.some(
      transition => transition.from === from && transition.to === to
    );
  }

  validateTransition(from: AuthState, to: AuthState): void {
    if (!this.canTransition(from, to)) {
      throw new StateTransitionError(`Invalid state transition: ${from} -> ${to}`);
    }
  }
}
```

### 7. Resilient Auth Store

```typescript
// stores/ResilientAuthStore.ts
class ResilientAuthStore {
  private state: AuthContext = this.getInitialState();
  private stateMachine = new AuthStateMachine();
  private eventEmitter = new EventEmitter();
  private storage: SecureTokenStorage;
  private tokenRefreshManager: TokenRefreshManager;
  private retryManager = new RetryManager();

  async initialize(): Promise<void> {
    this.setState({ state: AuthState.INITIALIZING });

    try {
      await this.retryManager.execute(async () => {
        const tokens = await this.storage.getTokens();
        
        if (!tokens) {
          this.setState({ state: AuthState.UNAUTHENTICATED });
          return;
        }

        // Validate tokens
        if (this.isTokenExpired(tokens.accessToken)) {
          await this.handleExpiredTokens(tokens);
        } else {
          await this.restoreAuthenticatedState(tokens);
        }
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.setState({ 
        state: AuthState.ERROR,
        error: error as AuthError
      });
    }
  }

  async login(credentials: LoginCredentials): Promise<void> {
    this.setState({ state: AuthState.INITIALIZING });

    try {
      const response = await this.apiClient.post('/auth/login', credentials);
      
      if (!response.data.success) {
        throw new AuthError(response.data.error, 'LOGIN_FAILED');
      }

      const { tokens, user } = response.data.data;
      
      // Atomic state update
      await this.atomicStateUpdate({
        state: AuthState.AUTHENTICATED,
        tokens,
        user,
        error: null,
        lastActivity: Date.now()
      });

      this.eventEmitter.emit('auth:login', user);
    } catch (error) {
      this.setState({
        state: AuthState.ERROR,
        error: error as AuthError
      });
      throw error;
    }
  }

  private async atomicStateUpdate(newState: Partial<AuthContext>): Promise<void> {
    // Validate state transition
    if (newState.state) {
      this.stateMachine.validateTransition(this.state.state, newState.state);
    }

    // Update storage first
    if (newState.tokens) {
      await this.storage.setTokens(newState.tokens);
    }

    // Update memory state
    this.state = { ...this.state, ...newState };

    // Emit change event
    this.eventEmitter.emit('auth:stateChange', this.state);
  }

  private async handleExpiredTokens(tokens: TokenPair): Promise<void> {
    try {
      this.setState({ state: AuthState.REFRESHING });
      const newTokens = await this.tokenRefreshManager.refreshTokens();
      await this.restoreAuthenticatedState(newTokens);
    } catch (error) {
      await this.clearAuthState();
      throw error;
    }
  }

  private async restoreAuthenticatedState(tokens: TokenPair): Promise<void> {
    try {
      // Verify tokens and get user data
      const userResponse = await this.apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });

      if (userResponse.data.success) {
        await this.atomicStateUpdate({
          state: AuthState.AUTHENTICATED,
          tokens,
          user: userResponse.data.data,
          error: null
        });
      } else {
        throw new AuthError('Failed to verify user data');
      }
    } catch (error) {
      await this.clearAuthState();
      throw error;
    }
  }
}
```

### 8. Retry Manager

```typescript
// utils/RetryManager.ts
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      ...config
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.maxAttempts) {
          break;
        }

        if (!this.shouldRetry(error as Error)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: Error): boolean {
    // Don't retry on authentication errors
    if (error instanceof AuthError) {
      return false;
    }

    // Retry on network errors
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Usage Examples

### Setting up the Enhanced Authentication System

```typescript
// auth/setup.ts
export function setupAuthSystem() {
  // Initialize storage
  const storage = new SecureTokenStorage();
  
  // Create API client
  const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeout: 30000
  });
  
  // Initialize token refresh manager
  const tokenRefreshManager = new TokenRefreshManager(storage, apiClient);
  
  // Setup interceptors
  const interceptor = new EnhancedAuthInterceptor(tokenRefreshManager, storage);
  interceptor.setupInterceptors(apiClient);
  
  // Initialize auth store
  const authStore = new ResilientAuthStore(storage, tokenRefreshManager, apiClient);
  
  return {
    storage,
    apiClient,
    authStore,
    tokenRefreshManager
  };
}
```

### React Integration

```tsx
// components/AuthProvider.tsx
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authSystem] = useState(() => setupAuthSystem());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    authSystem.authStore.initialize()
      .then(() => setIsInitialized(true))
      .catch(console.error);
  }, []);

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  return (
    <AuthContext.Provider value={authSystem}>
      {children}
    </AuthContext.Provider>
  );
};
```

This implementation provides a robust, secure, and resilient authentication system that addresses all the identified issues in the current architecture.