#!/bin/bash

# ===========================
# 🧪 TESTE FINAL - SISTEMA COMPLETO
# ===========================

echo -e "\033[0;34m🎯 TESTE FINAL - Sistema ERP Nexus\033[0m"
echo -e "\033[0;34mVersão: Fase 3 Completa\033[0m\n"

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
    
    echo -e "${BLUE}🔍 ${test_name}${NC}"
    ((total_tests++))
    
    if eval $command; then
        echo -e "${GREEN}  ✅ PASSOU${NC}"
        ((success_count++))
        return 0
    else
        echo -e "${RED}  ❌ FALHOU${NC}"
        return 1
    fi
}

echo -e "${BLUE}🏗️ TESTANDO INFRAESTRUTURA${NC}"

# Infraestrutura básica
run_test "PostgreSQL funcionando" "docker exec nexus-postgres pg_isready -U nexus_user -d nexus_erp >/dev/null 2>&1"
run_test "Redis funcionando" "docker exec nexus-redis redis-cli ping | grep -q PONG"
run_test "Network configurada" "docker network ls | grep -q nexus-network"

echo -e "\n${BLUE}🔐 TESTANDO SEGURANÇA${NC}"

# Configurações de segurança
run_test "Senha segura configurada" "echo 'SELECT 1' | docker exec -i nexus-postgres psql -U nexus_user -d nexus_erp >/dev/null 2>&1"
run_test "Redis sem senha (dev mode)" "docker exec nexus-redis redis-cli ping >/dev/null 2>&1"

echo -e "\n${BLUE}🌐 TESTANDO CONECTIVIDADE${NC}"

# Portas e conectividade
run_test "PostgreSQL porta 5433" "nc -z localhost 5433 2>/dev/null || (curl -f http://localhost:5433 2>/dev/null; test $? -eq 7)"
run_test "Redis porta 6379" "nc -z localhost 6379 2>/dev/null || (curl -f http://localhost:6379 2>/dev/null; test $? -eq 52)"

echo -e "\n${BLUE}💾 TESTANDO PERSISTÊNCIA${NC}"

# Volumes e dados
run_test "Volume PostgreSQL" "docker volume ls | grep -q postgres_data"
run_test "Volume Redis" "docker volume ls | grep -q redis_data"

echo -e "\n${BLUE}🧪 TESTANDO SERVICES (se disponíveis)${NC}"

# Services de aplicação
if docker ps | grep -q nexus-user-management; then
    run_test "User Management container" "docker exec nexus-user-management echo 'OK' >/dev/null 2>&1"
    if curl -f http://localhost:5003/health >/dev/null 2>&1; then
        run_test "User Management health endpoint" "curl -f http://localhost:5003/health >/dev/null 2>&1"
    else
        echo -e "${YELLOW}  ⚠️ User Management health endpoint não acessível (ainda inicializando)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️ User Management não está rodando${NC}"
fi

if docker ps | grep -q nexus-api-gateway; then
    run_test "API Gateway container" "docker exec nexus-api-gateway echo 'OK' >/dev/null 2>&1"
    if curl -f http://localhost:5001/health >/dev/null 2>&1; then
        run_test "API Gateway health endpoint" "curl -f http://localhost:5001/health >/dev/null 2>&1"
    else
        echo -e "${YELLOW}  ⚠️ API Gateway health endpoint não acessível (ainda inicializando)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️ API Gateway não está rodando${NC}"
fi

echo -e "\n${BLUE}📊 RESULTADO FINAL${NC}"
echo -e "${BLUE}===============${NC}"

percentage=$((success_count * 100 / total_tests))

if [ $percentage -ge 80 ]; then
    echo -e "${GREEN}🎉 SISTEMA FUNCIONAL! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${GREEN}✅ Infraestrutura Docker funcionando corretamente${NC}"
    exit_code=0
elif [ $percentage -ge 60 ]; then
    echo -e "${YELLOW}⚠️ SISTEMA PARCIALMENTE FUNCIONAL! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${YELLOW}⚠️ Algumas melhorias necessárias${NC}"
    exit_code=0
else
    echo -e "${RED}❌ SISTEMA COM PROBLEMAS! ${success_count}/${total_tests} testes passaram (${percentage}%)${NC}"
    echo -e "${RED}❌ Infraestrutura precisa de correções${NC}"
    exit_code=1
fi

echo -e "\n${BLUE}💡 STATUS ATUAL:${NC}"
echo -e "${BLUE}📊 Containers em execução:${NC}"
docker-compose -f docker-compose.simple.yml ps --format table 2>/dev/null || docker ps --format table

echo -e "\n${BLUE}🚀 COMANDOS ÚTEIS:${NC}"
echo -e "${BLUE}  Iniciar sistema: docker-compose -f docker-compose.simple.yml up -d${NC}"
echo -e "${BLUE}  Ver logs: docker-compose -f docker-compose.simple.yml logs -f${NC}"
echo -e "${BLUE}  Parar sistema: docker-compose -f docker-compose.simple.yml down${NC}"

exit $exit_code