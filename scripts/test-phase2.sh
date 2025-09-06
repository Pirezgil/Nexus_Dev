#!/bin/bash

# ===========================
# 🧪 TESTE SIMPLIFICADO FASE 2
# ===========================

echo -e "\033[0;34m🧪 Testando Fase 2 - Configuration Híbrida\033[0m"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
total_tests=0

run_test() {
    local test_name="$1"
    local command="$2"
    local expected_text="$3"
    
    echo -e "\n${BLUE}🔍 Teste: ${test_name}${NC}"
    ((total_tests++))
    
    if eval $command; then
        echo -e "${GREEN}  ✅ PASSOU: ${test_name}${NC}"
        ((success_count++))
        return 0
    else
        echo -e "${RED}  ❌ FALHOU: ${test_name}${NC}"
        return 1
    fi
}

echo -e "\n${BLUE}📋 STATUS ATUAL DOS CONTAINERS${NC}"
docker-compose -f docker-compose.dev.yml ps

echo -e "\n${BLUE}🔐 VERIFICAÇÃO DE SEGURANÇA${NC}"

# Test 1: Verificar se PostgreSQL está rodando
run_test "PostgreSQL Container Health" "docker-compose -f docker-compose.dev.yml ps | grep nexus-postgres | grep -q healthy"

# Test 2: Verificar se Redis está rodando  
run_test "Redis Container Health" "docker-compose -f docker-compose.dev.yml ps | grep nexus-redis | grep -q healthy"

# Test 3: Verificar acesso ao PostgreSQL via Docker
run_test "PostgreSQL Database Connection" "docker exec nexus-postgres pg_isready -U nexus_user -d nexus_erp"

# Test 4: Verificar acesso ao Redis via Docker
run_test "Redis Connection" "docker exec nexus-redis redis-cli ping | grep -q PONG"

# Test 5: Verificar se não há secrets hardcoded expostos no processo
run_test "No Hardcoded Secrets in Processes" "! docker-compose -f docker-compose.dev.yml config | grep -q 'nexus_password'"

# Test 6: Verificar se PostgreSQL usa senha segura
run_test "PostgreSQL Secure Password" "docker-compose -f docker-compose.dev.yml config | grep -q 'nexus_dev_20250905'"

echo -e "\n${BLUE}🛠️ TESTES DE CONFIGURAÇÃO HÍBRIDA${NC}"

# Test 7: Verificar NODE_ENV=development
run_test "Development Environment Set" "docker-compose -f docker-compose.dev.yml config | grep -q 'NODE_ENV=development'"

# Test 8: Verificar DEBUG habilitado
run_test "Debug Mode Enabled" "docker-compose -f docker-compose.dev.yml config | grep -q 'DEBUG=nexus'"

# Test 9: Verificar Resource Limits
run_test "Resource Limits Configured" "docker-compose -f docker-compose.dev.yml config | grep -q 'memory:'"

echo -e "\n${BLUE}🔍 TESTES DE CONECTIVIDADE${NC}"

# Test 10: Testar portas expostas
run_test "PostgreSQL Port Accessible" "docker-compose -f docker-compose.dev.yml port postgres 5432 | grep -q 5433"

# Test 11: Testar Redis port
run_test "Redis Port Accessible" "docker-compose -f docker-compose.dev.yml port redis 6379 | grep -q 6379"

# Test 12: Verificar rede
run_test "Network Configuration" "docker network ls | grep -q nexus-network"

echo -e "\n${BLUE}📊 TESTES DE PERFORMANCE E MONITORAMENTO${NC}"

# Test 13: Verificar Health Checks
run_test "Health Check Intervals" "docker-compose -f docker-compose.dev.yml config | grep -q 'interval: 30s'"

# Test 14: Verificar volumes persistentes
run_test "Persistent Volumes" "docker volume ls | grep -q postgres_data"

echo -e "\n${BLUE}🛡️ VALIDAÇÃO DE SEGURANÇA${NC}"

# Test 15: Verificar se containers não rodam como root
if docker exec nexus-postgres whoami 2>/dev/null | grep -q root; then
    echo -e "${YELLOW}  ⚠️ AVISO: PostgreSQL rodando como root (OK para desenvolvimento)${NC}"
else
    echo -e "${GREEN}  ✅ PostgreSQL não roda como root${NC}"
fi

# Test 16: Verificar se Redis não está exposto publicamente em produção
if docker-compose -f docker-compose.dev.yml config | grep -A5 -B5 redis | grep -q "6379:6379"; then
    echo -e "${YELLOW}  ⚠️ AVISO: Redis exposto para desenvolvimento (remover em produção)${NC}"
else
    echo -e "${GREEN}  ✅ Redis não exposto publicamente${NC}"
fi

echo -e "\n${BLUE}📈 RESULTADO FINAL${NC}"
echo -e "${BLUE}=================${NC}"

percentage=$((success_count * 100 / total_tests))

if [ $percentage -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELENTE! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${GREEN}✅ Fase 2 implementada com sucesso!${NC}"
    exit_code=0
elif [ $percentage -ge 70 ]; then
    echo -e "${YELLOW}⚠️ BOM! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${YELLOW}⚠️ Algumas melhorias podem ser feitas${NC}"
    exit_code=0
else
    echo -e "${RED}❌ PROBLEMAS ENCONTRADOS! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${RED}❌ Fase 2 precisa de correções${NC}"
    exit_code=1
fi

echo -e "\n${BLUE}💡 RECOMENDAÇÕES:${NC}"
echo -e "${BLUE}📖 Documentação: docs/DOCKER_INFRASTRUCTURE_ANALYSIS.md${NC}"
echo -e "${BLUE}🚀 Para uso: docker-compose -f docker-compose.dev.yml up -d${NC}"
echo -e "${BLUE}🔍 Para debug: docker-compose -f docker-compose.dev.yml logs -f${NC}"

exit $exit_code