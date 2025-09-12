// Client-side encryption utilities for sensitive data
// Uses Web Crypto API for secure encryption/decryption

class ClientEncryption {
  private static instance: ClientEncryption;
  private key: CryptoKey | null = null;
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;

  private constructor() {
    this.initializeKey();
  }

  static getInstance(): ClientEncryption {
    if (!ClientEncryption.instance) {
      ClientEncryption.instance = new ClientEncryption();
    }
    return ClientEncryption.instance;
  }

  /**
   * Initialize encryption key from browser fingerprint and secret
   */
  private async initializeKey(): Promise<void> {
    try {
      // Generate a deterministic key based on browser characteristics
      const keyMaterial = await this.generateKeyMaterial();
      
      this.key = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: this.algorithm },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      // Fallback to simple encoding for browsers without crypto support
      this.key = null;
    }
  }

  /**
   * Generate key material from browser characteristics
   */
  private async generateKeyMaterial(): Promise<ArrayBuffer> {
    // Create deterministic seed from browser characteristics
    const browserData = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.platform,
      'erp-nexus-secret-salt' // Application-specific salt
    ].join('|');

    // Use Web Crypto API to derive key
    if (crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(browserData);
      return await crypto.subtle.digest('SHA-256', data);
    }

    // Fallback for older browsers
    return this.simpleHash(browserData);
  }

  /**
   * Simple hash function for browsers without crypto.subtle
   */
  private simpleHash(str: string): ArrayBuffer {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to ArrayBuffer
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    for (let i = 0; i < 8; i++) {
      view.setUint32(i * 4, Math.abs(hash + i));
    }
    return buffer;
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encryptData(plaintext: string): Promise<string> {
    if (!this.key) {
      // Fallback to simple base64 encoding
      return btoa(plaintext);
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      // Fallback to base64
      return btoa(plaintext);
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decryptData(ciphertext: string): Promise<string> {
    if (!this.key) {
      // Fallback from base64 encoding
      try {
        return atob(ciphertext);
      } catch {
        return ciphertext; // Return as-is if not base64
      }
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(ciphertext).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.key,
        encrypted
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      // Fallback to base64 decode
      try {
        return atob(ciphertext);
      } catch {
        return ciphertext;
      }
    }
  }

  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    return this.key !== null && crypto.subtle !== undefined;
  }
}

// Export singleton instance
const clientEncryption = ClientEncryption.getInstance();

/**
 * Encrypt sensitive data for storage
 */
export async function encrypt(data: string): Promise<string> {
  return await clientEncryption.encryptData(data);
}

/**
 * Decrypt sensitive data from storage
 */
export async function decrypt(encryptedData: string): Promise<string> {
  return await clientEncryption.decryptData(encryptedData);
}

/**
 * Check if client-side encryption is supported
 */
export function isEncryptionSupported(): boolean {
  return clientEncryption.isEncryptionAvailable();
}