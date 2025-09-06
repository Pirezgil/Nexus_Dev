#!/bin/bash

# =====================================================================
# Docker Secrets Initialization Script for ERP Nexus
# =====================================================================
# This script initializes Docker Secrets for development and production
# environments, providing a hybrid approach that maintains development
# productivity while implementing production-ready security practices.
# =====================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment detection
ENVIRONMENT=${NEXUS_ENV:-development}
DOCKER_CONTEXT=${DOCKER_CONTEXT:-default}

echo -e "${BLUE}🔐 Initializing Docker Secrets for ERP Nexus${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Docker Context: ${DOCKER_CONTEXT}${NC}"
echo ""

# Function to create or update a Docker secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    echo -e "${YELLOW}Processing secret: ${secret_name}${NC}"
    
    # Check if secret exists
    if docker secret ls --format "{{.Name}}" | grep -q "^${secret_name}$"; then
        echo -e "${YELLOW}  Secret ${secret_name} already exists. Removing old version...${NC}"
        docker secret rm "${secret_name}" || {
            echo -e "${RED}  Warning: Could not remove old secret ${secret_name}. It might be in use.${NC}"
            echo -e "${YELLOW}  Creating versioned secret instead...${NC}"
            secret_name="${secret_name}_$(date +%Y%m%d_%H%M%S)"
        }
    fi
    
    # Create the secret
    echo "${secret_value}" | docker secret create "${secret_name}" -
    echo -e "${GREEN}  ✅ Secret ${secret_name} created successfully${NC}"
    echo -e "${BLUE}     Description: ${description}${NC}"
    echo ""
}

# Function to generate secure random passwords
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -hex 64
}

# Function to generate HMAC secret
generate_hmac_secret() {
    openssl rand -hex 64
}

echo -e "${BLUE}🔑 Generating secure credentials...${NC}"

# Generate credentials based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    # Production: Generate completely random credentials
    DB_PASSWORD=$(generate_password 32)
    JWT_SECRET=$(generate_jwt_secret)
    HMAC_SECRET=$(generate_hmac_secret)
    WHATSAPP_ACCESS_TOKEN=$(generate_password 64)
    WHATSAPP_APP_SECRET=$(generate_password 32)
    WHATSAPP_WEBHOOK_TOKEN=$(generate_password 32)
    
    echo -e "${GREEN}Generated secure production credentials${NC}"
else
    # Development: Use predictable but secure credentials for convenience
    DB_PASSWORD="nexus_dev_$(date +%Y%m%d)"
    JWT_SECRET="dev_jwt_secret_$(openssl rand -hex 32)"
    HMAC_SECRET="dev_hmac_secret_$(openssl rand -hex 32)"
    WHATSAPP_ACCESS_TOKEN="dev_whatsapp_token_$(generate_password 32)"
    WHATSAPP_APP_SECRET="dev_whatsapp_secret_$(generate_password 16)"
    WHATSAPP_WEBHOOK_TOKEN="dev_webhook_token_$(generate_password 16)"
    
    echo -e "${YELLOW}Generated development-friendly credentials${NC}"
fi

echo ""
echo -e "${BLUE}📦 Creating Docker Secrets...${NC}"
echo ""

# Database secrets
create_or_update_secret "nexus_db_name" "nexus_erp" "PostgreSQL database name"
create_or_update_secret "nexus_db_user" "nexus_user" "PostgreSQL database user"
create_or_update_secret "nexus_db_password" "$DB_PASSWORD" "PostgreSQL database password"

# Application secrets
create_or_update_secret "nexus_jwt_secret" "$JWT_SECRET" "JWT signing secret for authentication"
create_or_update_secret "nexus_hmac_secret" "$HMAC_SECRET" "HMAC secret for secure service communication"

# WhatsApp API secrets (for agendamento module)
create_or_update_secret "nexus_whatsapp_phone_id" "your-phone-number-id-here" "WhatsApp Business Phone Number ID"
create_or_update_secret "nexus_whatsapp_access_token" "$WHATSAPP_ACCESS_TOKEN" "WhatsApp Business Access Token"
create_or_update_secret "nexus_whatsapp_app_secret" "$WHATSAPP_APP_SECRET" "WhatsApp Business App Secret"
create_or_update_secret "nexus_whatsapp_webhook_token" "$WHATSAPP_WEBHOOK_TOKEN" "WhatsApp Webhook Verification Token"

# Redis connection string (no password for development, secure for production)
if [ "$ENVIRONMENT" = "production" ]; then
    REDIS_PASSWORD=$(generate_password 24)
    create_or_update_secret "nexus_redis_password" "$REDIS_PASSWORD" "Redis authentication password"
    create_or_update_secret "nexus_redis_url" "redis://:$REDIS_PASSWORD@redis:6379" "Redis connection URL with authentication"
else
    create_or_update_secret "nexus_redis_url" "redis://redis:6379" "Redis connection URL (development - no auth)"
fi

# Database URL construction
if [ "$ENVIRONMENT" = "production" ]; then
    DATABASE_URL="postgresql://nexus_user:$DB_PASSWORD@postgres:5432/nexus_erp?sslmode=require"
else
    DATABASE_URL="postgresql://nexus_user:$DB_PASSWORD@postgres:5432/nexus_erp"
fi
create_or_update_secret "nexus_database_url" "$DATABASE_URL" "Complete PostgreSQL connection URL"

echo -e "${GREEN}🎉 All Docker Secrets have been created successfully!${NC}"
echo ""

# List all created secrets
echo -e "${BLUE}📋 Created secrets summary:${NC}"
docker secret ls --filter name=nexus_ --format "table {{.Name}}\t{{.CreatedAt}}" | head -20

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo -e "${YELLOW}   • Secrets are stored securely in Docker's encrypted storage${NC}"
echo -e "${YELLOW}   • In development, credentials are predictable for convenience${NC}"
echo -e "${YELLOW}   • In production, credentials are randomly generated${NC}"
echo -e "${YELLOW}   • Update docker-compose.yml to use these secrets${NC}"

if [ "$ENVIRONMENT" = "development" ]; then
    echo ""
    echo -e "${BLUE}🔍 Development Database Credentials:${NC}"
    echo -e "${BLUE}   Host: localhost:5433${NC}"
    echo -e "${BLUE}   Database: nexus_erp${NC}"
    echo -e "${BLUE}   Username: nexus_user${NC}"
    echo -e "${BLUE}   Password: $DB_PASSWORD${NC}"
    echo ""
    echo -e "${YELLOW}💡 You can connect to the database using these credentials for debugging${NC}"
fi

echo ""
echo -e "${GREEN}✅ Docker Secrets initialization completed!${NC}"