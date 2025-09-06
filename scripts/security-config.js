#!/usr/bin/env node

/**
 * =====================================================================
 * Security Configuration Helper for ERP Nexus
 * =====================================================================
 * This utility configures security settings that are development-friendly
 * while maintaining production-ready security practices.
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityConfigManager {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.isDevelopment = this.environment === 'development';
        
        console.log(`🔐 Security Configuration Manager initialized for ${this.environment} environment`);
    }

    /**
     * Generate secure configuration for Redis
     */
    generateRedisConfig() {
        const config = {
            development: {
                // No password for development convenience
                requirepass: false,
                bind: '0.0.0.0', // Allow external connections for debugging
                port: 6379,
                timeout: 0,
                'tcp-keepalive': 300,
                // Persistence settings
                save: ['900 1', '300 10', '60 10000'],
                appendonly: true,
                appendfsync: 'everysec',
                // Memory settings (lower for development)
                maxmemory: '256mb',
                'maxmemory-policy': 'allkeys-lru',
                // Debugging
                loglevel: 'notice',
                syslog: false
            },
            production: {
                // Strong password required
                requirepass: true,
                bind: '127.0.0.1', // Internal network only
                port: 6379,
                timeout: 0,
                'tcp-keepalive': 300,
                // Enhanced persistence
                save: ['900 1', '300 10', '60 10000'],
                appendonly: true,
                appendfsync: 'everysec',
                // Memory optimization
                maxmemory: '512mb',
                'maxmemory-policy': 'allkeys-lru',
                // Security
                'rename-command': {
                    'FLUSHDB': 'FLUSHDB_DISABLED',
                    'FLUSHALL': 'FLUSHALL_DISABLED',
                    'DEBUG': 'DEBUG_DISABLED',
                    'CONFIG': 'CONFIG_DISABLED'
                },
                loglevel: 'warning',
                syslog: true
            }
        };

        return config[this.environment];
    }

    /**
     * Generate PostgreSQL configuration
     */
    generatePostgreSQLConfig() {
        const config = {
            development: {
                // Connection settings (relaxed for development)
                max_connections: 20,
                port: 5432,
                listen_addresses: '*',
                // Authentication (simplified for development)
                password_encryption: 'scram-sha-256',
                // Logging (verbose for debugging)
                log_statement: 'all',
                log_min_duration_statement: 100,
                log_connections: true,
                log_disconnections: true,
                // Performance (development optimized)
                shared_buffers: '128MB',
                effective_cache_size: '512MB',
                work_mem: '4MB',
                maintenance_work_mem: '32MB',
                // SSL (optional in development)
                ssl: false,
                ssl_ciphers: 'HIGH:MEDIUM:+3DES:!aNULL',
                ssl_prefer_server_ciphers: true
            },
            production: {
                // Connection settings (secure)
                max_connections: 100,
                port: 5432,
                listen_addresses: 'localhost',
                // Strong authentication
                password_encryption: 'scram-sha-256',
                // Minimal logging (security)
                log_statement: 'ddl',
                log_min_duration_statement: 1000,
                log_connections: false,
                log_disconnections: false,
                // Performance (production optimized)
                shared_buffers: '256MB',
                effective_cache_size: '1GB',
                work_mem: '8MB',
                maintenance_work_mem: '64MB',
                // SSL required
                ssl: true,
                ssl_ciphers: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!3DES:!DH:!RC4',
                ssl_prefer_server_ciphers: true,
                ssl_cert_file: '/etc/ssl/certs/postgres.crt',
                ssl_key_file: '/etc/ssl/private/postgres.key'
            }
        };

        return config[this.environment];
    }

    /**
     * Generate JWT configuration
     */
    generateJWTConfig() {
        const config = {
            development: {
                algorithm: 'HS256', // Simpler for development
                expiresIn: '24h',
                issuer: 'nexus-erp-dev',
                audience: 'nexus-erp-users-dev',
                // Development secret (predictable)
                secretLength: 32,
                // Relaxed security for debugging
                clockTolerance: 30,
                ignoreExpiration: false,
                ignoreNotBefore: false
            },
            production: {
                algorithm: 'RS256', // Asymmetric for production
                expiresIn: '1h',
                refreshExpiresIn: '7d',
                issuer: 'nexus-erp',
                audience: 'nexus-erp-users',
                // Production secret (strong)
                secretLength: 64,
                keySize: 2048, // For RSA keys
                // Strict security
                clockTolerance: 5,
                ignoreExpiration: false,
                ignoreNotBefore: false
            }
        };

        return config[this.environment];
    }

    /**
     * Generate CORS configuration
     */
    generateCORSConfig() {
        const config = {
            development: {
                origin: true, // Allow all origins in development
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
                allowedHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Requested-With',
                    'Accept',
                    'Origin',
                    'Cache-Control',
                    'X-File-Name'
                ],
                exposedHeaders: [
                    'X-Total-Count',
                    'Content-Range',
                    'X-Content-Range'
                ],
                preflightContinue: false,
                optionsSuccessStatus: 200
            },
            production: {
                origin: [
                    'https://nexus-erp.com',
                    'https://www.nexus-erp.com',
                    'https://api.nexus-erp.com'
                ],
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                allowedHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Requested-With',
                    'Accept',
                    'Origin'
                ],
                exposedHeaders: [
                    'X-Total-Count'
                ],
                preflightContinue: false,
                optionsSuccessStatus: 204
            }
        };

        return config[this.environment];
    }

    /**
     * Generate rate limiting configuration
     */
    generateRateLimitConfig() {
        const config = {
            development: {
                // Relaxed rate limiting for development
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000, // High limit for development
                standardHeaders: true,
                legacyHeaders: false,
                message: {
                    error: 'Too many requests (development mode)',
                    retryAfter: '15 minutes'
                }
            },
            production: {
                // Strict rate limiting for production
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // Reasonable limit for production
                standardHeaders: true,
                legacyHeaders: false,
                message: {
                    error: 'Too many requests',
                    retryAfter: '15 minutes'
                },
                // IP-based limits
                keyGenerator: (req) => req.ip,
                // Skip successful requests for authenticated users
                skip: (req) => req.user && req.user.authenticated
            }
        };

        return config[this.environment];
    }

    /**
     * Generate security headers configuration
     */
    generateSecurityHeaders() {
        const config = {
            development: {
                // Relaxed security headers for development
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                        imgSrc: ["'self'", "data:", "https:", "http:"],
                        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
                    }
                },
                hsts: false, // Disabled for HTTP development
                noSniff: true,
                frameguard: { action: 'deny' },
                xssFilter: true
            },
            production: {
                // Strict security headers for production
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'", "https:"],
                        fontSrc: ["'self'", "https:"],
                        objectSrc: ["'none'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'none'"],
                        baseUri: ["'self'"],
                        formAction: ["'self'"],
                        upgradeInsecureRequests: []
                    }
                },
                hsts: {
                    maxAge: 31536000, // 1 year
                    includeSubDomains: true,
                    preload: true
                },
                noSniff: true,
                frameguard: { action: 'deny' },
                xssFilter: true,
                referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
            }
        };

        return config[this.environment];
    }

    /**
     * Generate complete security configuration
     */
    generateSecurityConfiguration() {
        return {
            environment: this.environment,
            isDevelopment: this.isDevelopment,
            redis: this.generateRedisConfig(),
            postgresql: this.generatePostgreSQLConfig(),
            jwt: this.generateJWTConfig(),
            cors: this.generateCORSConfig(),
            rateLimit: this.generateRateLimitConfig(),
            securityHeaders: this.generateSecurityHeaders(),
            // Additional security settings
            bcrypt: {
                saltRounds: this.isDevelopment ? 10 : 14
            },
            session: {
                secure: !this.isDevelopment,
                httpOnly: true,
                maxAge: this.isDevelopment ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 24h dev, 1h prod
                sameSite: this.isDevelopment ? 'lax' : 'strict'
            }
        };
    }

    /**
     * Save configuration to files
     */
    saveConfiguration(outputDir = './config') {
        const config = this.generateSecurityConfiguration();
        
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save main security configuration
        const configPath = path.join(outputDir, `security-${this.environment}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`✅ Security configuration saved to: ${configPath}`);

        // Generate Redis configuration file
        const redisConfigPath = path.join(outputDir, `redis-${this.environment}.conf`);
        let redisConfig = '';
        Object.entries(config.redis).forEach(([key, value]) => {
            if (key === 'rename-command' && typeof value === 'object') {
                Object.entries(value).forEach(([cmd, newCmd]) => {
                    redisConfig += `rename-command ${cmd} ${newCmd}\n`;
                });
            } else if (key === 'save' && Array.isArray(value)) {
                value.forEach(saveRule => {
                    redisConfig += `save ${saveRule}\n`;
                });
            } else if (typeof value === 'boolean') {
                redisConfig += `${key} ${value ? 'yes' : 'no'}\n`;
            } else {
                redisConfig += `${key} ${value}\n`;
            }
        });
        fs.writeFileSync(redisConfigPath, redisConfig);
        console.log(`✅ Redis configuration saved to: ${redisConfigPath}`);

        // Generate PostgreSQL configuration file
        const pgConfigPath = path.join(outputDir, `postgresql-${this.environment}.conf`);
        let pgConfig = '';
        Object.entries(config.postgresql).forEach(([key, value]) => {
            if (typeof value === 'boolean') {
                pgConfig += `${key} = ${value ? 'on' : 'off'}\n`;
            } else {
                pgConfig += `${key} = '${value}'\n`;
            }
        });
        fs.writeFileSync(pgConfigPath, pgConfig);
        console.log(`✅ PostgreSQL configuration saved to: ${pgConfigPath}`);

        return config;
    }

    /**
     * Validate current security configuration
     */
    validateSecurityConfiguration() {
        const issues = [];

        // Check if running in production with development settings
        if (!this.isDevelopment) {
            if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes('development')) {
                issues.push('Production environment using development JWT secret');
            }
            
            if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=require')) {
                issues.push('Production database connection without SSL requirement');
            }
        }

        // Check for hardcoded secrets
        const secretPatterns = [
            /password.*=.*['"][^'"]*['"]/gi,
            /secret.*=.*['"][^'"]*['"]/gi,
            /key.*=.*['"][^'"]*['"]/gi
        ];

        // This would ideally scan configuration files
        // For demonstration, we'll just check environment variables
        Object.entries(process.env).forEach(([key, value]) => {
            if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')) {
                if (value && (value.includes('development') || value.includes('test') || value.includes('default'))) {
                    issues.push(`Potentially insecure value in environment variable: ${key}`);
                }
            }
        });

        if (issues.length > 0) {
            console.log(`❌ Security validation found ${issues.length} issue(s):`);
            issues.forEach(issue => console.log(`   • ${issue}`));
            return false;
        } else {
            console.log(`✅ Security configuration validation passed`);
            return true;
        }
    }
}

// CLI usage
if (require.main === module) {
    const manager = new SecurityConfigManager();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'generate':
            console.log('🔧 Generating security configuration...');
            const config = manager.saveConfiguration('./infrastructure/config');
            console.log('✅ Security configuration generated successfully');
            break;
            
        case 'validate':
            console.log('🔍 Validating security configuration...');
            const isValid = manager.validateSecurityConfiguration();
            process.exit(isValid ? 0 : 1);
            break;
            
        case 'show':
            console.log('📋 Current security configuration:');
            const currentConfig = manager.generateSecurityConfiguration();
            console.log(JSON.stringify(currentConfig, null, 2));
            break;
            
        default:
            console.log(`
🔐 Security Configuration Helper for ERP Nexus

Usage:
  node security-config.js generate  - Generate security configuration files
  node security-config.js validate  - Validate current security settings
  node security-config.js show      - Show current configuration

Environment Variables:
  NODE_ENV                          - Set environment (development|production)

Examples:
  # Generate development security configuration
  node security-config.js generate
  
  # Generate production security configuration
  NODE_ENV=production node security-config.js generate
  
  # Validate security settings
  node security-config.js validate
            `);
    }
}

module.exports = SecurityConfigManager;