#!/bin/bash

# =====================================================================
# Start Services with Docker Secrets - ERP Nexus
# =====================================================================
# This script starts all services using Docker Secrets configuration
# with development-friendly settings and production-ready security.
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
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.secrets.yml}

echo -e "${BLUE}🚀 Starting ERP Nexus with Docker Secrets${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Compose File: ${COMPOSE_FILE}${NC}"
echo ""

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if Docker Swarm is initialized (required for secrets)
check_swarm() {
    if ! docker node ls > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Docker Swarm not initialized. Initializing...${NC}"
        docker swarm init --advertise-addr 127.0.0.1 > /dev/null 2>&1
        echo -e "${GREEN}✅ Docker Swarm initialized${NC}"
    else
        echo -e "${GREEN}✅ Docker Swarm is active${NC}"
    fi
}

# Function to check if secrets exist
check_secrets() {
    local required_secrets=(
        "nexus_database_url"
        "nexus_jwt_secret"
        "nexus_hmac_secret"
    )
    
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if ! docker secret ls --format "{{.Name}}" | grep -q "^${secret}$"; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [ ${#missing_secrets[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required secrets: ${missing_secrets[*]}${NC}"
        echo -e "${YELLOW}💡 Run './scripts/init-secrets.sh' to create secrets${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required secrets are available${NC}"
}

# Function to start services
start_services() {
    echo -e "${BLUE}🔧 Starting services...${NC}"
    
    # Use Docker Compose with secrets configuration
    if [ -f "$COMPOSE_FILE" ]; then
        echo -e "${BLUE}📦 Using compose file: ${COMPOSE_FILE}${NC}"
        docker compose -f "$COMPOSE_FILE" up -d
    else
        echo -e "${RED}❌ Compose file not found: ${COMPOSE_FILE}${NC}"
        exit 1
    fi
}

# Function to show service status
show_status() {
    echo ""
    echo -e "${BLUE}📊 Service Status:${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    echo -e "${BLUE}🔍 Health Check Summary:${NC}"
    
    # Wait a moment for services to start
    sleep 5
    
    local services=("postgres" "redis" "nexus-user-management" "nexus-crm" "nexus-services" "nexus-agendamento" "api-gateway" "nginx")
    
    for service in "${services[@]}"; do
        local container_name=""
        case $service in
            "postgres") container_name="nexus-postgres" ;;
            "redis") container_name="nexus-redis" ;;
            "nexus-user-management") container_name="nexus-user-management" ;;
            "nexus-crm") container_name="nexus-crm" ;;
            "nexus-services") container_name="nexus-services" ;;
            "nexus-agendamento") container_name="nexus-agendamento" ;;
            "api-gateway") container_name="nexus-api-gateway" ;;
            "nginx") container_name="nexus-nginx" ;;
        esac
        
        if docker ps --filter "name=${container_name}" --filter "status=running" | grep -q "${container_name}"; then
            echo -e "${GREEN}  ✅ ${service} - Running${NC}"
        else
            echo -e "${RED}  ❌ ${service} - Not Running${NC}"
        fi
    done
}

# Function to show access information
show_access_info() {
    echo ""
    echo -e "${BLUE}🌐 Access Information:${NC}"
    echo -e "${GREEN}  Frontend: http://localhost:5000${NC}"
    echo -e "${GREEN}  API Gateway: http://localhost:5001${NC}"
    echo -e "${GREEN}  User Management: http://localhost:5003${NC}"
    echo -e "${GREEN}  CRM Module: http://localhost:5004${NC}"
    echo -e "${GREEN}  Services Module: http://localhost:5005${NC}"
    echo -e "${GREEN}  Agendamento Module: http://localhost:5008${NC}"
    
    if [ "$ENVIRONMENT" = "development" ]; then
        echo ""
        echo -e "${BLUE}🔍 Development Database Access:${NC}"
        echo -e "${GREEN}  PostgreSQL: localhost:5433${NC}"
        echo -e "${GREEN}  Redis: localhost:6379${NC}"
        echo -e "${YELLOW}  Use 'node scripts/secrets-helper.js config' to see credentials${NC}"
    fi
}

# Function to tail logs
tail_logs() {
    if [ "${1:-}" = "--logs" ] || [ "${1:-}" = "-l" ]; then
        echo ""
        echo -e "${BLUE}📝 Following service logs (Ctrl+C to stop):${NC}"
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🔍 Pre-flight checks...${NC}"
    check_docker
    check_swarm
    check_secrets
    
    echo ""
    echo -e "${BLUE}🚀 Starting services...${NC}"
    start_services
    
    echo ""
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    sleep 10
    
    show_status
    show_access_info
    
    echo ""
    echo -e "${GREEN}🎉 ERP Nexus started successfully!${NC}"
    echo -e "${YELLOW}💡 Use 'docker compose -f ${COMPOSE_FILE} logs -f' to view logs${NC}"
    echo -e "${YELLOW}💡 Use 'docker compose -f ${COMPOSE_FILE} down' to stop services${NC}"
    
    # Show logs if requested
    tail_logs "$1"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--logs|-l] [--help|-h]"
        echo ""
        echo "Options:"
        echo "  --logs, -l    Follow service logs after startup"
        echo "  --help, -h    Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  NEXUS_ENV          Set environment (development|production)"
        echo "  COMPOSE_FILE       Override compose file (default: docker-compose.secrets.yml)"
        echo ""
        echo "Examples:"
        echo "  $0                 Start services"
        echo "  $0 --logs          Start services and follow logs"
        echo "  NEXUS_ENV=production $0    Start in production mode"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac