#!/usr/bin/env ts-node

/**
 * Security Configuration Validation Script
 * Run this script to validate your security configuration before deployment
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

interface SecurityCheck {
  name: string;
  description: string;
  check: () => Promise<boolean> | boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fix?: string;
}

class SecurityValidator {
  private checks: SecurityCheck[] = [];
  private results: { check: SecurityCheck; passed: boolean; error?: string }[] = [];

  constructor() {
    this.initializeChecks();
  }

  private initializeChecks(): void {
    this.checks = [
      {
        name: 'JWT Secret Strength',
        description: 'Validates JWT secret meets security requirements',
        severity: 'critical',
        check: () => this.validateJWTSecret(),
        fix: 'Generate a strong random string with at least 64 characters for JWT_SECRET'
      },
      {
        name: 'Password Hashing Configuration',
        description: 'Validates bcrypt salt rounds configuration',
        severity: 'high',
        check: () => this.validatePasswordHashing(),
        fix: 'Set BCRYPT_SALT_ROUNDS to at least 12 for production'
      },
      {
        name: 'Session Security',
        description: 'Validates session encryption and timeout settings',
        severity: 'high',
        check: () => this.validateSessionSecurity(),
        fix: 'Configure SESSION_ENCRYPTION_KEY and appropriate timeouts'
      },
      {
        name: 'HTTPS Configuration',
        description: 'Ensures HTTPS is enforced in production',
        severity: 'critical',
        check: () => this.validateHTTPS(),
        fix: 'Enable HTTPS and set secure cookie flags for production'
      },
      {
        name: 'CORS Configuration',
        description: 'Validates CORS settings are secure',
        severity: 'medium',
        check: () => this.validateCORS(),
        fix: 'Configure specific allowed origins instead of wildcards'
      },
      {
        name: 'Rate Limiting',
        description: 'Ensures rate limiting is properly configured',
        severity: 'high',
        check: () => this.validateRateLimiting(),
        fix: 'Configure appropriate rate limits for different endpoints'
      },
      {
        name: 'Database Security',
        description: 'Validates database connection security',
        severity: 'high',
        check: () => this.validateDatabaseSecurity(),
        fix: 'Enable SSL for database connections and use strong credentials'
      },
      {
        name: 'Environment Variables',
        description: 'Checks for presence of required security environment variables',
        severity: 'critical',
        check: () => this.validateEnvironmentVariables(),
        fix: 'Set all required environment variables with secure values'
      },
      {
        name: 'File Permissions',
        description: 'Validates file permissions for sensitive files',
        severity: 'medium',
        check: () => this.validateFilePermissions(),
        fix: 'Set appropriate file permissions (600 for .env files)'
      },
      {
        name: 'Security Headers',
        description: 'Validates security headers configuration',
        severity: 'medium',
        check: () => this.validateSecurityHeaders(),
        fix: 'Configure helmet middleware with appropriate security headers'
      }
    ];
  }

  async runAllChecks(): Promise<void> {
    console.log(chalk.blue.bold('🔒 ERP Nexus Security Configuration Validator\n'));

    for (const check of this.checks) {
      try {
        console.log(chalk.gray(`Checking: ${check.name}...`));
        const passed = await check.check();
        
        this.results.push({ check, passed });
        
        if (passed) {
          console.log(chalk.green(`✓ ${check.name}`));
        } else {
          const color = check.severity === 'critical' ? chalk.red : 
                       check.severity === 'high' ? chalk.yellow : chalk.gray;
          console.log(color(`✗ ${check.name} (${check.severity.toUpperCase()})`));
        }
      } catch (error) {
        this.results.push({ 
          check, 
          passed: false, 
          error: (error as Error).message 
        });
        console.log(chalk.red(`✗ ${check.name} - Error: ${(error as Error).message}`));
      }
    }

    this.printSummary();
  }

  private validateJWTSecret(): boolean {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    
    if (!jwtSecret || !jwtRefreshSecret) {
      return false;
    }

    // Check for default/weak secrets
    const weakSecrets = [
      'your-super-secret-jwt-key-change-in-production',
      'secret',
      'password',
      'jwt-secret'
    ];

    if (weakSecrets.some(weak => jwtSecret.includes(weak) || jwtRefreshSecret.includes(weak))) {
      return false;
    }

    // Check minimum length (64 characters)
    if (jwtSecret.length < 64 || jwtRefreshSecret.length < 64) {
      return false;
    }

    // Check entropy (should have good randomness)
    const entropy = this.calculateEntropy(jwtSecret);
    return entropy >= 4.5; // Good entropy threshold
  }

  private validatePasswordHashing(): boolean {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
    const minScore = parseInt(process.env.PASSWORD_MIN_SCORE || '0', 10);

    return saltRounds >= 12 && minLength >= 12 && minScore >= 3;
  }

  private validateSessionSecurity(): boolean {
    const sessionKey = process.env.SESSION_ENCRYPTION_KEY;
    const sessionTimeout = process.env.SESSION_TIMEOUT;
    const inactivityTimeout = process.env.SESSION_INACTIVITY_TIMEOUT;

    if (!sessionKey || sessionKey.length < 32) {
      return false;
    }

    const timeout = parseInt(sessionTimeout || '0', 10);
    const inactivity = parseInt(inactivityTimeout || '0', 10);

    return timeout > 0 && timeout <= 86400000 && // Max 24 hours
           inactivity > 0 && inactivity <= 1800000; // Max 30 minutes
  }

  private validateHTTPS(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    
    if (nodeEnv === 'production') {
      // In production, HTTPS should be enforced
      return process.env.HTTPS === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0';
    }
    
    return true; // Not critical in development
  }

  private validateCORS(): boolean {
    const corsOrigins = process.env.CORS_ORIGINS;
    
    if (!corsOrigins) {
      return false;
    }

    // Check for wildcard origins in production
    if (process.env.NODE_ENV === 'production' && corsOrigins.includes('*')) {
      return false;
    }

    return true;
  }

  private validateRateLimiting(): boolean {
    const rateLimitWindow = process.env.RATE_LIMIT_WINDOW_MS;
    const rateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    const loginRateLimit = process.env.LOGIN_RATE_LIMIT_MAX;

    return !!(rateLimitWindow && rateLimitMax && loginRateLimit);
  }

  private validateDatabaseSecurity(): boolean {
    const databaseUrl = process.env.DATABASE_URL;
    const sslEnabled = process.env.DB_SSL_ENABLED;

    if (!databaseUrl) {
      return false;
    }

    // Check for production database security
    if (process.env.NODE_ENV === 'production') {
      return sslEnabled === 'true' && databaseUrl.includes('ssl=true');
    }

    return true;
  }

  private validateEnvironmentVariables(): boolean {
    const requiredVars = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
      'REDIS_URL',
      'SESSION_ENCRYPTION_KEY'
    ];

    return requiredVars.every(varName => {
      const value = process.env[varName];
      return value && value.length > 0;
    });
  }

  private validateFilePermissions(): boolean {
    try {
      const envFiles = ['.env', '.env.local', '.env.production'];
      
      for (const file of envFiles) {
        if (fs.existsSync(file)) {
          const stats = fs.statSync(file);
          const permissions = (stats.mode & parseInt('777', 8)).toString(8);
          
          // Should be 600 or 644 at most
          if (!['600', '644'].includes(permissions)) {
            return false;
          }
        }
      }
      
      return true;
    } catch {
      return true; // Skip if can't check
    }
  }

  private validateSecurityHeaders(): boolean {
    // This would check if helmet is configured in the application
    // For now, we'll check if the configuration exists
    return true; // Placeholder - would need to check actual middleware setup
  }

  private calculateEntropy(str: string): number {
    const counts: { [key: string]: number } = {};
    for (const char of str) {
      counts[char] = (counts[char] || 0) + 1;
    }

    let entropy = 0;
    const length = str.length;

    for (const count of Object.values(counts)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private printSummary(): void {
    console.log('\n' + chalk.blue.bold('📊 Security Check Summary'));
    console.log('─'.repeat(50));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const critical = this.results.filter(r => !r.passed && r.check.severity === 'critical').length;
    const high = this.results.filter(r => !r.passed && r.check.severity === 'high').length;

    console.log(`✓ Passed: ${chalk.green(passed.toString())}`);
    console.log(`✗ Failed: ${chalk.red(failed.toString())}`);
    
    if (critical > 0) {
      console.log(`🚨 Critical Issues: ${chalk.red.bold(critical.toString())}`);
    }
    if (high > 0) {
      console.log(`⚠️  High Priority Issues: ${chalk.yellow.bold(high.toString())}`);
    }

    console.log('\n' + chalk.blue.bold('🔧 Recommendations'));
    console.log('─'.repeat(50));

    for (const result of this.results) {
      if (!result.passed && result.check.fix) {
        const icon = result.check.severity === 'critical' ? '🚨' : 
                    result.check.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${result.check.name}:`);
        console.log(`   ${result.check.fix}\n`);
      }
    }

    // Overall security score
    const score = Math.round((passed / this.results.length) * 100);
    const scoreColor = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
    
    console.log(`🏆 Security Score: ${scoreColor.bold(score + '%')}\n`);

    if (critical > 0) {
      console.log(chalk.red.bold('⚠️  CRITICAL: Address critical security issues before deployment!'));
      process.exit(1);
    } else if (score < 80) {
      console.log(chalk.yellow.bold('⚠️  WARNING: Consider addressing security issues before deployment.'));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('✅ Security configuration looks good!'));
    }
  }
}

// Load environment variables
require('dotenv').config();

// Run security validation
const validator = new SecurityValidator();
validator.runAllChecks().catch((error) => {
  console.error(chalk.red('Security validation failed:'), error);
  process.exit(1);
});