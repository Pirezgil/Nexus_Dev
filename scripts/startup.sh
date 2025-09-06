#!/bin/bash

# Nexus ERP - Sistema de Startup Automatizado
# Fase 3 - Integração Completa
# Autor: Sistema de Integração Nexus

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
PROJECT_ROOT="$(pwd)"
HEALTH_CHECK_TIMEOUT=300  # 5 minutos
HEALTH_CHECK_INTERVAL=5   # 5 segundos

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   NEXUS ERP - STARTUP AUTOMÁTICO     ${NC}"
echo -e "${BLUE}   Fase 3: Integração Completa        ${NC}"
echo -e "${BLUE}======================================${NC}"

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Função para verificar se Docker está rodando
check_docker() {
    log "Verificando Docker..."
    if ! docker info > /dev/null 2>&1; then
        error "Docker não está rodando. Por favor, inicie o Docker Desktop."
        exit 1
    fi
    log "Docker está rodando ✓"
}

# Função para limpar containers antigos
cleanup() {
    log "Limpando containers antigos..."
    docker-compose down --remove-orphans || true
    docker system prune -f > /dev/null 2>&1 || true
    log "Limpeza concluída ✓"
}

# Função para verificar health check de um serviço
check_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=1

    log "Aguardando $service_name ficar saudável..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "$health_url" > /dev/null 2>&1; then
            log "$service_name está saudável ✓"
            return 0
        fi
        
        if [ $((attempt % 6)) -eq 0 ]; then
            warn "$service_name ainda não está pronto (tentativa $attempt/$max_attempts)..."
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        attempt=$((attempt + 1))
    done
    
    error "$service_name falhou ao inicializar após ${HEALTH_CHECK_TIMEOUT}s"
    return 1
}

# Função para verificar todos os health checks
verify_all_services() {
    log "Verificando todos os serviços..."
    
    local services=(
        "PostgreSQL:http://localhost:5433"
        "Redis:http://localhost:6379"
        "User Management:http://localhost:5003/health"
        "CRM:http://localhost:5004/health"
        "Services:http://localhost:5005/health"
        "Agendamento:http://localhost:5008/health"
        "API Gateway:http://localhost:5001/health"
        "Frontend:http://localhost:5000"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name health_url <<< "$service_info"
        
        # Skip direct database checks, they're handled by Docker health checks
        if [[ "$service_name" == "PostgreSQL" || "$service_name" == "Redis" ]]; then
            log "Aguardando $service_name via Docker health check..."
            continue
        fi
        
        if ! check_health "$service_name" "$health_url"; then
            error "Falha na verificação de saúde: $service_name"
            return 1
        fi
    done
    
    log "Todos os serviços estão saudáveis ✓"
}

# Função para exibir status dos serviços
show_status() {
    log "Status dos containers:"
    docker-compose ps
    
    echo ""
    log "Serviços disponíveis:"
    echo -e "  ${BLUE}Frontend:${NC}           http://localhost:5000"
    echo -e "  ${BLUE}API Gateway:${NC}        http://localhost:5001"
    echo -e "  ${BLUE}User Management:${NC}    http://localhost:5003"
    echo -e "  ${BLUE}CRM:${NC}                http://localhost:5004"
    echo -e "  ${BLUE}Services:${NC}           http://localhost:5005"
    echo -e "  ${BLUE}Agendamento:${NC}        http://localhost:5008"
    echo -e "  ${BLUE}PostgreSQL:${NC}         localhost:5433"
    echo -e "  ${BLUE}Redis:${NC}              localhost:6379"
    
    echo ""
    log "Health Checks:"
    echo -e "  ${BLUE}API Gateway:${NC}        http://localhost:5001/health"
    echo -e "  ${BLUE}User Management:${NC}    http://localhost:5003/health"
    echo -e "  ${BLUE}CRM:${NC}                http://localhost:5004/health"
    echo -e "  ${BLUE}Services:${NC}           http://localhost:5005/health"
    echo -e "  ${BLUE}Agendamento:${NC}        http://localhost:5008/health"
}

# Função para executar testes básicos
run_basic_tests() {
    log "Executando testes básicos de conectividade..."
    
    # Teste API Gateway
    if curl -f "http://localhost:5001/ping" > /dev/null 2>&1; then
        log "API Gateway respondendo ✓"
    else
        error "API Gateway não está respondendo"
        return 1
    fi
    
    # Teste integração básica
    log "Testando integração entre serviços..."
    
    # Teste auth endpoint através do gateway
    if curl -f "http://localhost:5001/api/auth" > /dev/null 2>&1; then
        log "Integração User Management via Gateway ✓"
    else
        warn "Integração User Management pode ter problemas"
    fi
    
    log "Testes básicos concluídos ✓"
}

# Função principal
main() {
    log "Iniciando processo de startup..."
    
    # 1. Verificar pré-requisitos
    check_docker
    
    # 2. Limpar ambiente
    if [ "${1:-}" = "--clean" ]; then
        cleanup
    fi
    
    # 3. Construir e iniciar serviços
    log "Construindo e iniciando serviços..."
    docker-compose up -d --build
    
    # 4. Aguardar inicialização
    log "Aguardando inicialização dos serviços..."
    sleep 30
    
    # 5. Verificar health checks
    if ! verify_all_services; then
        error "Falha na inicialização dos serviços"
        log "Logs dos containers:"
        docker-compose logs --tail=50
        exit 1
    fi
    
    # 6. Executar testes básicos
    if ! run_basic_tests; then
        error "Falha nos testes básicos"
        exit 1
    fi
    
    # 7. Exibir status
    show_status
    
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}   NEXUS ERP INICIADO COM SUCESSO!   ${NC}"
    echo -e "${GREEN}======================================${NC}"
    
    log "Sistema pronto para uso!"
}

# Função de limpeza em caso de erro
cleanup_on_exit() {
    if [ $? -ne 0 ]; then
        error "Startup falhou. Executando limpeza..."
        docker-compose logs --tail=20
    fi
}

# Registrar função de limpeza
trap cleanup_on_exit EXIT

# Executar função principal
main "$@"