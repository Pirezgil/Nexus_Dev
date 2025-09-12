// Enhanced secure storage utilities for token management
// Implements multiple layers of security for client-side token storage

import { encrypt, decrypt } from './encryption';

export interface SecureStorageOptions {
  encrypt?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
  maxAge?: number;
}

class SecureStorageManager {
  private static instance: SecureStorageManager;
  private readonly storagePrefix = 'erp_nexus_';
  private readonly encryptionEnabled = true;

  private constructor() {
    // Initialize security measures
    this.initializeSecurity();
  }

  static getInstance(): SecureStorageManager {
    if (!SecureStorageManager.instance) {
      SecureStorageManager.instance = new SecureStorageManager();
    }
    return SecureStorageManager.instance;
  }

  /**
   * Initialize security measures and CSP
   */
  private initializeSecurity(): void {
    // Set Content Security Policy headers
    if (typeof document !== 'undefined') {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.erp-nexus.com",
        "font-src 'self' https://fonts.gstatic.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ');
      
      document.head.appendChild(meta);
    }
  }

  /**
   * Enhanced token storage with multiple security layers
   */
  setToken(key: string, value: string, options: SecureStorageOptions = {}): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const {
        encrypt = this.encryptionEnabled,
        httpOnly = false,
        secure = true,
        sameSite = 'strict',
        maxAge = 24 * 60 * 60 * 1000 // 24 hours
      } = options;

      // Add timestamp and integrity check
      const tokenData = {
        value,
        timestamp: Date.now(),
        checksum: this.generateChecksum(value),
        fingerprint: this.generateBrowserFingerprint(),
        domain: window.location.hostname
      };

      let dataToStore = JSON.stringify(tokenData);

      // Encrypt if enabled
      if (encrypt) {
        dataToStore = encrypt(dataToStore);
      }

      const storageKey = this.storagePrefix + key;

      // Try to use secure cookie storage first
      if (httpOnly && this.isCookieStorageAvailable()) {
        document.cookie = [
          `${storageKey}=${encodeURIComponent(dataToStore)}`,
          `Path=${options.path || '/'}`,
          `Max-Age=${Math.floor(maxAge / 1000)}`,
          secure ? 'Secure' : '',
          `SameSite=${sameSite}`,
          'HttpOnly'
        ].filter(Boolean).join('; ');

        return true;
      }

      // Fallback to localStorage with additional security
      if (this.isLocalStorageAvailable()) {
        // Use sessionStorage for more sensitive data
        const storage = key.includes('refresh') ? sessionStorage : localStorage;
        storage.setItem(storageKey, dataToStore);
        
        // Set expiration in separate key
        storage.setItem(
          storageKey + '_expires', 
          (Date.now() + maxAge).toString()
        );

        // Verification
        const saved = storage.getItem(storageKey);
        if (saved !== dataToStore) {
          console.error('Token storage verification failed');
          return false;
        }

        return true;
      }

      console.error('No secure storage mechanism available');
      return false;

    } catch (error) {
      console.error('Error storing secure token:', error);
      return false;
    }
  }

  /**
   * Enhanced token retrieval with security validation
   */
  getToken(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const storageKey = this.storagePrefix + key;

      // Try cookie storage first
      if (this.isCookieStorageAvailable()) {
        const cookieValue = this.getCookie(storageKey);
        if (cookieValue) {
          return this.validateAndExtractToken(cookieValue);
        }
      }

      // Try localStorage/sessionStorage
      if (this.isLocalStorageAvailable()) {
        const storage = key.includes('refresh') ? sessionStorage : localStorage;
        const rawData = storage.getItem(storageKey);
        const expiresData = storage.getItem(storageKey + '_expires');

        if (!rawData) return null;

        // Check expiration
        if (expiresData) {
          const expires = parseInt(expiresData, 10);
          if (Date.now() > expires) {
            this.removeToken(key);
            return null;
          }
        }

        return this.validateAndExtractToken(rawData);
      }

      return null;

    } catch (error) {
      console.error('Error retrieving secure token:', error);
      return null;
    }
  }

  /**
   * Validate and extract token from stored data
   */
  private validateAndExtractToken(rawData: string): string | null {
    try {
      let dataStr = rawData;

      // Decrypt if needed
      if (this.encryptionEnabled) {
        dataStr = decrypt(rawData);
      }

      const tokenData = JSON.parse(dataStr);

      // Validate structure
      if (!tokenData.value || !tokenData.timestamp || !tokenData.checksum) {
        console.warn('Invalid token data structure');
        return null;
      }

      // Validate checksum
      if (tokenData.checksum !== this.generateChecksum(tokenData.value)) {
        console.error('Token integrity check failed');
        return null;
      }

      // Validate browser fingerprint
      const currentFingerprint = this.generateBrowserFingerprint();
      if (tokenData.fingerprint !== currentFingerprint) {
        console.warn('Browser fingerprint mismatch - possible token theft');
        return null;
      }

      // Validate domain
      if (tokenData.domain !== window.location.hostname) {
        console.error('Domain validation failed');
        return null;
      }

      return tokenData.value;

    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  }

  /**
   * Secure token removal
   */
  removeToken(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      const storageKey = this.storagePrefix + key;

      // Remove from cookies
      if (this.isCookieStorageAvailable()) {
        document.cookie = `${storageKey}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=strict`;
      }

      // Remove from storage
      if (this.isLocalStorageAvailable()) {
        const storage = key.includes('refresh') ? sessionStorage : localStorage;
        storage.removeItem(storageKey);
        storage.removeItem(storageKey + '_expires');
      }

    } catch (error) {
      console.error('Error removing secure token:', error);
    }
  }

  /**
   * Clear all tokens securely
   */
  clearAllTokens(): void {
    if (typeof window === 'undefined') return;

    try {
      // Clear all cookies with our prefix
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name.startsWith(this.storagePrefix)) {
          document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=strict`;
        }
      });

      // Clear localStorage and sessionStorage
      if (this.isLocalStorageAvailable()) {
        const storageKeys = [
          ...Object.keys(localStorage),
          ...Object.keys(sessionStorage)
        ];

        storageKeys.forEach(key => {
          if (key.startsWith(this.storagePrefix)) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          }
        });
      }

      console.log('All tokens cleared securely');

    } catch (error) {
      console.error('Error clearing all tokens:', error);
    }
  }

  /**
   * Generate browser fingerprint for device binding
   */
  private generateBrowserFingerprint(): string {
    if (typeof window === 'undefined') return 'server';

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.platform,
      navigator.cookieEnabled ? '1' : '0'
    ].join('|');

    // Simple hash function (in production, use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Generate checksum for integrity validation
   */
  private generateChecksum(value: string): string {
    // Simple checksum (in production, use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cookie value by name
   */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    
    return null;
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if cookie storage is available
   */
  private isCookieStorageAvailable(): boolean {
    if (typeof document === 'undefined') return false;

    try {
      return navigator.cookieEnabled && document.cookie !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Validate token format and structure
   */
  isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') return false;

    // Check JWT format (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      // Validate base64url encoding of header and payload
      atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if token is expired (client-side check only)
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp ? payload.exp < now : false;
    } catch {
      return true;
    }
  }
}

// Export singleton instance
export const secureStorage = SecureStorageManager.getInstance();

// Convenience functions
export const setSecureToken = (key: string, value: string, options?: SecureStorageOptions) => 
  secureStorage.setToken(key, value, options);

export const getSecureToken = (key: string) => 
  secureStorage.getToken(key);

export const removeSecureToken = (key: string) => 
  secureStorage.removeToken(key);

export const clearAllSecureTokens = () => 
  secureStorage.clearAllTokens();