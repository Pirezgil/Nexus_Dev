#!/bin/bash
# Script de teste de segurança
# Parte do Plano Executivo Docker - Validação

set -e

echo "🛡️ Executando testes de segurança..."
echo "Data: $(date)"

FAILED_TESTS=0
PASSED_TESTS=0

# Função para logging de teste
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo "✅ $test_name: PASSOU - $message"
        ((PASSED_TESTS++))
    else
        echo "❌ $test_name: FALHOU - $message"
        ((FAILED_TESTS++))
    fi
}

# Teste 1: Verificar se secrets não estão expostos
test_secrets_not_exposed() {
    echo ""
    echo "🔍 Teste 1: Verificando exposição de secrets..."
    
    local secrets_found=0
    
    # Procurar por secrets conhecidos
    if grep -r "your-super-secret-jwt-key" . --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null; then
        secrets_found=1
    fi
    
    if grep -r "nexus_password" . --exclude-dir=.git --exclude-dir=node_modules --exclude="*.backup" --exclude="*.md" 2>/dev/null; then
        secrets_found=1
    fi
    
    if grep -r "99dab0e1ccf1cdfc694ec" . --exclude-dir=.git --exclude-dir=node_modules --exclude="*.backup" --exclude="*.md" 2>/dev/null; then
        secrets_found=1
    fi
    
    if [ $secrets_found -eq 0 ]; then
        log_test "Secrets Exposure" "PASS" "Nenhum secret hardcoded encontrado"
    else
        log_test "Secrets Exposure" "FAIL" "Secrets ainda expostos no código"
    fi
}

# Teste 2: Verificar usuários non-root nos Dockerfiles
test_nonroot_users() {
    echo ""
    echo "🔍 Teste 2: Verificando usuários non-root..."
    
    local modules=("user-management" "crm" "services" "agendamento")
    local all_good=1
    
    for module in "${modules[@]}"; do
        local dockerfile="modules/$module/Dockerfile"
        
        if [ ! -f "$dockerfile" ]; then
            log_test "Non-root User ($module)" "FAIL" "Dockerfile não encontrado"
            all_good=0
            continue
        fi
        
        # Verificar se USER está definido e não é root
        if grep -q "USER appuser" "$dockerfile" || grep -q "USER [^r]" "$dockerfile"; then
            log_test "Non-root User ($module)" "PASS" "Usuário non-root configurado"
        else
            log_test "Non-root User ($module)" "FAIL" "Usuário non-root não configurado"
            all_good=0
        fi
    done
    
    if [ $all_good -eq 1 ]; then
        log_test "All Non-root Users" "PASS" "Todos os módulos usam usuários non-root"
    fi
}

# Teste 3: Verificar configuração de produção
test_production_config() {
    echo ""
    echo "🔍 Teste 3: Verificando configuração de produção..."
    
    local docker_compose="docker-compose.yml"
    
    if [ ! -f "$docker_compose" ]; then
        log_test "Production Config" "FAIL" "docker-compose.yml não encontrado"
        return
    fi
    
    # Verificar NODE_ENV=production
    local dev_env_count=$(grep -c "NODE_ENV=development" "$docker_compose" 2>/dev/null || echo "0")
    
    if [ $dev_env_count -gt 0 ]; then
        log_test "Production Config" "FAIL" "Ainda existem $dev_env_count configurações de desenvolvimento"
    else
        log_test "Production Config" "PASS" "Configuração de produção aplicada"
    fi
}

# Teste 4: Verificar health checks
test_health_checks() {
    echo ""
    echo "🔍 Teste 4: Verificando health checks..."
    
    local modules=("user-management" "crm" "services" "agendamento")
    local all_good=1
    
    for module in "${modules[@]}"; do
        local dockerfile="modules/$module/Dockerfile"
        
        if [ ! -f "$dockerfile" ]; then
            continue
        fi
        
        if grep -q "HEALTHCHECK" "$dockerfile"; then
            log_test "Health Check ($module)" "PASS" "Health check configurado"
        else
            log_test "Health Check ($module)" "FAIL" "Health check não configurado"
            all_good=0
        fi
    done
}

# Teste 5: Verificar multi-stage builds
test_multistage_builds() {
    echo ""
    echo "🔍 Teste 5: Verificando multi-stage builds..."
    
    local modules=("user-management" "crm" "services" "agendamento")
    local all_good=1
    
    for module in "${modules[@]}"; do
        local dockerfile="modules/$module/Dockerfile"
        
        if [ ! -f "$dockerfile" ]; then
            continue
        fi
        
        if grep -q "AS builder" "$dockerfile" && grep -q "AS production" "$dockerfile"; then
            log_test "Multi-stage ($module)" "PASS" "Multi-stage build configurado"
        else
            log_test "Multi-stage ($module)" "FAIL" "Multi-stage build não configurado"
            all_good=0
        fi
    done
}

# Teste 6: Verificar .dockerignore
test_dockerignore() {
    echo ""
    echo "🔍 Teste 6: Verificando arquivos .dockerignore..."
    
    local modules=("user-management" "crm" "services" "agendamento")
    local all_good=1
    
    for module in "${modules[@]}"; do
        local dockerignore="modules/$module/.dockerignore"
        
        if [ -f "$dockerignore" ]; then
            # Verificar se tem conteúdo mínimo
            if grep -q "node_modules" "$dockerignore" && grep -q "*.log" "$dockerignore"; then
                log_test "Dockerignore ($module)" "PASS" ".dockerignore bem configurado"
            else
                log_test "Dockerignore ($module)" "FAIL" ".dockerignore incompleto"
                all_good=0
            fi
        else
            log_test "Dockerignore ($module)" "FAIL" ".dockerignore não existe"
            all_good=0
        fi
    done
}

# Teste 7: Verificar se containers podem ser construídos
test_build_capability() {
    echo ""
    echo "🔍 Teste 7: Verificando capacidade de build (build test)..."
    
    local modules=("user-management" "crm" "services" "agendamento")
    
    for module in "${modules[@]}"; do
        if [ -d "modules/$module" ]; then
            echo "🔨 Testando build para $module..."
            
            if docker build -t security-test-$module modules/$module/ > /dev/null 2>&1; then
                log_test "Build Test ($module)" "PASS" "Build executado com sucesso"
                # Limpar imagem de teste
                docker rmi security-test-$module > /dev/null 2>&1 || true
            else
                log_test "Build Test ($module)" "FAIL" "Build falhou"
            fi
        fi
    done
}

# Função principal
main() {
    echo "📋 Iniciando testes de segurança..."
    
    test_secrets_not_exposed
    test_nonroot_users
    test_production_config
    test_health_checks
    test_multistage_builds
    test_dockerignore
    test_build_capability
    
    echo ""
    echo "📊 Resumo dos Testes:"
    echo "✅ Testes Passou: $PASSED_TESTS"
    echo "❌ Testes Falhou: $FAILED_TESTS"
    echo "📈 Taxa de Sucesso: $(( PASSED_TESTS * 100 / (PASSED_TESTS + FAILED_TESTS) ))%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo "🎉 Todos os testes de segurança passaram!"
        echo "✅ Sistema está pronto para o próximo passo"
        exit 0
    else
        echo ""
        echo "⚠️ Alguns testes falharam. Revisar antes de prosseguir."
        echo "📋 Consulte o Plano Executivo Docker para correções"
        exit 1
    fi
}

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Execute este script a partir do diretório raiz do projeto"
    exit 1
fi

# Executar função principal
main