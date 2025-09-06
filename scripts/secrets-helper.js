#!/usr/bin/env node

/**
 * =====================================================================
 * Docker Secrets Helper for ERP Nexus
 * =====================================================================
 * This utility helps applications read Docker Secrets in both
 * development and production environments, providing a seamless
 * experience across different deployment scenarios.
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');

class SecretsHelper {
    constructor() {
        this.secretsPath = '/run/secrets';
        this.isDocker = this.checkIfRunningInDocker();
        this.isDevelopment = process.env.NODE_ENV === 'development';
        
        console.log(`🔐 SecretsHelper initialized:`, {
            isDocker: this.isDocker,
            isDevelopment: this.isDevelopment,
            secretsPath: this.secretsPath
        });
    }

    /**
     * Check if we're running inside a Docker container
     */
    checkIfRunningInDocker() {
        try {
            // Check for Docker-specific files
            return fs.existsSync('/.dockerenv') || 
                   fs.existsSync('/proc/1/cgroup') && 
                   fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
        } catch (error) {
            return false;
        }
    }

    /**
     * Read a secret from Docker Secrets or environment variable fallback
     * @param {string} secretName - Name of the secret
     * @param {string} envFallback - Environment variable to use as fallback
     * @param {string} defaultValue - Default value if neither secret nor env var exists
     * @returns {string} The secret value
     */
    getSecret(secretName, envFallback = null, defaultValue = null) {
        // First try to read from Docker Secrets
        if (this.isDocker) {
            const secretPath = path.join(this.secretsPath, secretName);
            try {
                if (fs.existsSync(secretPath)) {
                    const secretValue = fs.readFileSync(secretPath, 'utf8').trim();
                    console.log(`✅ Loaded secret from Docker: ${secretName}`);
                    return secretValue;
                }
            } catch (error) {
                console.warn(`⚠️  Failed to read Docker secret ${secretName}:`, error.message);
            }
        }

        // Fallback to environment variable
        if (envFallback && process.env[envFallback]) {
            console.log(`📱 Using environment variable: ${envFallback}`);
            return process.env[envFallback];
        }

        // Use default value
        if (defaultValue !== null) {
            console.log(`🔧 Using default value for: ${secretName}`);
            return defaultValue;
        }

        // Secret not found
        console.error(`❌ Secret not found: ${secretName} (env: ${envFallback})`);
        throw new Error(`Required secret '${secretName}' not found`);
    }

    /**
     * Get database configuration from secrets
     */
    getDatabaseConfig() {
        const config = {
            host: this.getSecret('nexus_db_host', 'DB_HOST', 'postgres'),
            port: parseInt(this.getSecret('nexus_db_port', 'DB_PORT', '5432')),
            database: this.getSecret('nexus_db_name', 'POSTGRES_DB', 'nexus_erp'),
            username: this.getSecret('nexus_db_user', 'POSTGRES_USER', 'nexus_user'),
            password: this.getSecret('nexus_db_password', 'POSTGRES_PASSWORD', 'nexus_password'),
            url: this.getSecret('nexus_database_url', 'DATABASE_URL', null)
        };

        // If we don't have a complete URL, construct one
        if (!config.url) {
            const sslMode = process.env.NODE_ENV === 'production' ? '?sslmode=require' : '';
            config.url = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${sslMode}`;
        }

        console.log(`🗄️  Database config loaded:`, {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            hasPassword: !!config.password,
            hasUrl: !!config.url
        });

        return config;
    }

    /**
     * Get Redis configuration from secrets
     */
    getRedisConfig() {
        const redisUrl = this.getSecret('nexus_redis_url', 'REDIS_URL', 'redis://redis:6379');
        const redisPassword = this.getSecret('nexus_redis_password', 'REDIS_PASSWORD', null);

        const config = {
            url: redisUrl,
            password: redisPassword,
            host: this.getSecret('nexus_redis_host', 'REDIS_HOST', 'redis'),
            port: parseInt(this.getSecret('nexus_redis_port', 'REDIS_PORT', '6379')),
            db: parseInt(this.getSecret('nexus_redis_db', 'REDIS_DB', '0'))
        };

        console.log(`📦 Redis config loaded:`, {
            url: config.url,
            hasPassword: !!config.password,
            host: config.host,
            port: config.port,
            db: config.db
        });

        return config;
    }

    /**
     * Get JWT configuration from secrets
     */
    getJWTConfig() {
        const config = {
            secret: this.getSecret('nexus_jwt_secret', 'JWT_SECRET', 'development-jwt-secret-change-in-production'),
            expiresIn: this.getSecret('nexus_jwt_expires_in', 'JWT_EXPIRES_IN', '24h'),
            algorithm: this.getSecret('nexus_jwt_algorithm', 'JWT_ALGORITHM', 'HS256')
        };

        console.log(`🔑 JWT config loaded:`, {
            hasSecret: !!config.secret,
            secretLength: config.secret.length,
            expiresIn: config.expiresIn,
            algorithm: config.algorithm
        });

        return config;
    }

    /**
     * Get HMAC secret for service communication
     */
    getHMACSecret() {
        const secret = this.getSecret('nexus_hmac_secret', 'GATEWAY_HMAC_SECRET', 'development-hmac-secret-change-in-production');
        
        console.log(`🔐 HMAC secret loaded:`, {
            hasSecret: !!secret,
            secretLength: secret.length
        });

        return secret;
    }

    /**
     * Get WhatsApp Business API configuration from secrets
     */
    getWhatsAppConfig() {
        const config = {
            phoneNumberId: this.getSecret('nexus_whatsapp_phone_id', 'WHATSAPP_PHONE_NUMBER_ID', 'your-phone-number-id-here'),
            accessToken: this.getSecret('nexus_whatsapp_access_token', 'WHATSAPP_ACCESS_TOKEN', 'your-access-token-here'),
            appSecret: this.getSecret('nexus_whatsapp_app_secret', 'WHATSAPP_APP_SECRET', 'your-app-secret-here'),
            webhookToken: this.getSecret('nexus_whatsapp_webhook_token', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'your-webhook-verify-token-here'),
            apiVersion: this.getSecret('nexus_whatsapp_api_version', 'WHATSAPP_API_VERSION', 'v18.0')
        };

        console.log(`📱 WhatsApp config loaded:`, {
            phoneNumberId: config.phoneNumberId,
            hasAccessToken: !!config.accessToken && config.accessToken !== 'your-access-token-here',
            hasAppSecret: !!config.appSecret && config.appSecret !== 'your-app-secret-here',
            hasWebhookToken: !!config.webhookToken && config.webhookToken !== 'your-webhook-verify-token-here',
            apiVersion: config.apiVersion
        });

        return config;
    }

    /**
     * Get all application secrets at once
     */
    getAllSecrets() {
        try {
            const secrets = {
                database: this.getDatabaseConfig(),
                redis: this.getRedisConfig(),
                jwt: this.getJWTConfig(),
                hmac: this.getHMACSecret(),
                whatsapp: this.getWhatsAppConfig()
            };

            console.log(`🎯 All secrets loaded successfully`);
            return secrets;
        } catch (error) {
            console.error(`❌ Failed to load secrets:`, error.message);
            throw error;
        }
    }

    /**
     * Validate that all required secrets are available
     */
    validateSecrets() {
        const requiredSecrets = [
            'nexus_database_url',
            'nexus_jwt_secret',
            'nexus_hmac_secret'
        ];

        const missing = [];
        
        for (const secret of requiredSecrets) {
            try {
                this.getSecret(secret);
            } catch (error) {
                missing.push(secret);
            }
        }

        if (missing.length > 0) {
            throw new Error(`Missing required secrets: ${missing.join(', ')}`);
        }

        console.log(`✅ All required secrets are available`);
        return true;
    }

    /**
     * Create a development-friendly configuration object
     */
    createConfig() {
        try {
            this.validateSecrets();
            
            const config = this.getAllSecrets();
            
            // Add non-secret configuration
            config.environment = process.env.NODE_ENV || 'development';
            config.port = parseInt(process.env.PORT || '3000');
            config.isDocker = this.isDocker;
            config.isDevelopment = this.isDevelopment;
            
            return config;
        } catch (error) {
            console.error(`❌ Failed to create configuration:`, error.message);
            
            // In development, provide fallback configuration
            if (this.isDevelopment) {
                console.log(`🔧 Using development fallback configuration`);
                return this.createDevelopmentFallbackConfig();
            }
            
            throw error;
        }
    }

    /**
     * Create fallback configuration for development
     */
    createDevelopmentFallbackConfig() {
        return {
            database: {
                url: process.env.DATABASE_URL || 'postgresql://nexus_user:nexus_password@localhost:5433/nexus_erp'
            },
            redis: {
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            },
            jwt: {
                secret: process.env.JWT_SECRET || 'development-jwt-secret',
                expiresIn: '24h'
            },
            hmac: process.env.GATEWAY_HMAC_SECRET || 'development-hmac-secret',
            whatsapp: {
                phoneNumberId: 'development-phone-id',
                accessToken: 'development-access-token',
                appSecret: 'development-app-secret',
                webhookToken: 'development-webhook-token'
            },
            environment: 'development',
            port: parseInt(process.env.PORT || '3000'),
            isDocker: this.isDocker,
            isDevelopment: true
        };
    }
}

// Export for use in other modules
module.exports = SecretsHelper;

// CLI usage
if (require.main === module) {
    const helper = new SecretsHelper();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            console.log('🧪 Testing secrets access...');
            try {
                helper.validateSecrets();
                console.log('✅ All secrets are accessible');
            } catch (error) {
                console.error('❌ Secrets test failed:', error.message);
                process.exit(1);
            }
            break;
            
        case 'config':
            console.log('⚙️  Application configuration:');
            try {
                const config = helper.createConfig();
                console.log(JSON.stringify(config, null, 2));
            } catch (error) {
                console.error('❌ Failed to create config:', error.message);
                process.exit(1);
            }
            break;
            
        case 'validate':
            console.log('🔍 Validating secrets...');
            try {
                helper.validateSecrets();
                console.log('✅ Validation successful');
            } catch (error) {
                console.error('❌ Validation failed:', error.message);
                process.exit(1);
            }
            break;
            
        default:
            console.log(`
🔐 Docker Secrets Helper for ERP Nexus

Usage:
  node secrets-helper.js test      - Test secrets access
  node secrets-helper.js config    - Show application configuration
  node secrets-helper.js validate  - Validate required secrets

Examples:
  # Test if all secrets are accessible
  node secrets-helper.js test
  
  # Show the complete application configuration
  node secrets-helper.js config
  
  # Validate that all required secrets are present
  node secrets-helper.js validate
            `);
    }
}