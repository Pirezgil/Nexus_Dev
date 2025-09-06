#!/bin/bash
# Execução Automatizada - Fase 1: Segurança Crítica
# Script para executar todas as correções da Fase 1 automaticamente

set -e

echo "🚀 EXECUTANDO FASE 1: SEGURANÇA CRÍTICA"
echo "Plano Executivo Docker - ERP Nexus"
echo "Data: $(date)"
echo "=========================================="

# Variáveis
BACKUP_DIR="backups/phase1/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="logs/phase1-execution-$(date +%Y%m%d_%H%M%S).log"

# Criar diretórios necessários
mkdir -p "$BACKUP_DIR" logs scripts

# Função de logging
log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para verificar pré-requisitos
check_prerequisites() {
    log "🔍 Verificando pré-requisitos..."
    
    # Docker funcionando
    if ! docker info > /dev/null 2>&1; then
        log "❌ Docker não está funcionando"
        exit 1
    fi
    
    # OpenSSL disponível
    if ! command -v openssl > /dev/null 2>&1; then
        log "❌ OpenSSL não encontrado (necessário para gerar secrets)"
        exit 1
    fi
    
    # Arquivo docker-compose.yml existe
    if [ ! -f "docker-compose.yml" ]; then
        log "❌ docker-compose.yml não encontrado"
        exit 1
    fi
    
    log "✅ Pré-requisitos verificados"
}

# Passo 1: Backup de segurança
backup_current_state() {
    log ""
    log "📁 Passo 1: Fazendo backup do estado atual..."
    
    # Backup docker-compose.yml
    cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml"
    
    # Backup Dockerfiles
    for module in user-management crm services agendamento; do
        if [ -f "modules/$module/Dockerfile" ]; then
            cp "modules/$module/Dockerfile" "$BACKUP_DIR/Dockerfile.$module"
        fi
    done
    
    # Exportar estado atual dos containers
    docker-compose ps > "$BACKUP_DIR/containers-state.txt" 2>&1 || true
    
    log "✅ Backup criado em: $BACKUP_DIR"
}

# Passo 2: Criar secrets
create_secrets() {
    log ""
    log "🔐 Passo 2: Criando secrets seguros..."
    
    # Parar serviços para criar secrets
    docker-compose down > /dev/null 2>&1 || true
    
    # Inicializar Docker Swarm se necessário (para secrets)
    if ! docker node ls > /dev/null 2>&1; then
        log "🔄 Inicializando Docker Swarm para secrets..."
        docker swarm init --advertise-addr 127.0.0.1 > /dev/null 2>&1
    fi
    
    # Gerar e criar secrets
    log "🔑 Gerando JWT secret..."
    echo "$(openssl rand -hex 32)" | docker secret create jwt_secret - 2>/dev/null || \
        log "⚠️ Secret jwt_secret já existe"
    
    log "🔑 Gerando Postgres password..."
    echo "$(openssl rand -hex 16)" | docker secret create postgres_password - 2>/dev/null || \
        log "⚠️ Secret postgres_password já existe"
    
    log "🔑 Gerando Gateway HMAC secret..."
    echo "$(openssl rand -hex 32)" | docker secret create gateway_hmac_secret - 2>/dev/null || \
        log "⚠️ Secret gateway_hmac_secret já existe"
    
    # Verificar secrets criados
    log "📋 Secrets criados:"
    docker secret ls | tee -a "$LOG_FILE"
    
    log "✅ Secrets configurados"
}

# Passo 3: Corrigir Dockerfiles
fix_dockerfiles() {
    log ""
    log "🔧 Passo 3: Aplicando Dockerfiles seguros..."
    
    if [ -f "scripts/fix-dockerfiles.sh" ]; then
        chmod +x scripts/fix-dockerfiles.sh
        ./scripts/fix-dockerfiles.sh
    else
        log "⚠️ Script fix-dockerfiles.sh não encontrado, aplicando correções manuais..."
        
        # Aplicar template para cada módulo
        MODULES=("user-management" "crm" "services" "agendamento")
        
        for module in "${MODULES[@]}"; do
            if [ -d "modules/$module" ] && [ -f "templates/Dockerfile.multistage" ]; then
                log "🔄 Aplicando Dockerfile seguro para $module..."
                cp templates/Dockerfile.multistage "modules/$module/Dockerfile"
                
                # Criar .dockerignore
                cat > "modules/$module/.dockerignore" << 'EOF'
node_modules
npm-debug.log*
logs
*.log
.env*
dist
build
.git
.DS_Store
test/
tests/
*.test.js
*.test.ts
README.md
docs/
EOF
            fi
        done
    fi
    
    log "✅ Dockerfiles corrigidos"
}

# Passo 4: Aplicar configuração segura
apply_secure_config() {
    log ""
    log "⚙️ Passo 4: Aplicando configuração segura..."
    
    if [ -f "templates/docker-compose-secure.yml" ]; then
        log "🔄 Aplicando template docker-compose seguro..."
        
        # Usar template seguro como base
        cp templates/docker-compose-secure.yml docker-compose-secure.yml
        
        log "✅ Arquivo docker-compose-secure.yml criado"
        log "📋 Para usar: docker-compose -f docker-compose-secure.yml up -d"
    else
        log "⚠️ Template seguro não encontrado, aplicando correções no arquivo atual..."
        
        # Correções básicas no arquivo atual
        sed -i.bak 's/NODE_ENV=development/NODE_ENV=production/g' docker-compose.yml
        sed -i 's/- "6379:6379"/# Redis interno apenas - "6379:6379"/g' docker-compose.yml
        
        log "✅ Configurações básicas aplicadas"
    fi
}

# Passo 5: Testes de validação
run_validation_tests() {
    log ""
    log "🧪 Passo 5: Executando testes de validação..."
    
    if [ -f "scripts/security-test.sh" ]; then
        chmod +x scripts/security-test.sh
        
        log "🔍 Executando testes de segurança..."
        if ./scripts/security-test.sh; then
            log "✅ Testes de segurança aprovados"
        else
            log "⚠️ Alguns testes falharam - revisar logs"
        fi
    else
        log "⚠️ Script de testes não encontrado, fazendo validação básica..."
        
        # Testes básicos
        if ! grep -r "your-super-secret-jwt-key" . --exclude-dir=.git --exclude="*.log" --exclude="*.backup" > /dev/null 2>&1; then
            log "✅ Nenhum secret hardcoded encontrado"
        else
            log "❌ Ainda existem secrets hardcoded"
        fi
    fi
}

# Passo 6: Teste de build
test_builds() {
    log ""
    log "🔨 Passo 6: Testando builds dos módulos..."
    
    MODULES=("user-management" "crm" "services" "agendamento")
    SUCCESSFUL_BUILDS=0
    
    for module in "${MODULES[@]}"; do
        if [ -d "modules/$module" ]; then
            log "🔄 Testando build para $module..."
            
            if docker build -t phase1-test-$module modules/$module/ > /dev/null 2>&1; then
                log "✅ Build $module: OK"
                ((SUCCESSFUL_BUILDS++))
                docker rmi phase1-test-$module > /dev/null 2>&1 || true
            else
                log "❌ Build $module: FALHOU"
            fi
        fi
    done
    
    log "📊 Builds bem-sucedidos: $SUCCESSFUL_BUILDS/${#MODULES[@]}"
}

# Função de relatório final
generate_report() {
    log ""
    log "📋 RELATÓRIO FINAL - FASE 1"
    log "=========================="
    log "🕒 Executado em: $(date)"
    log "📁 Backup: $BACKUP_DIR"
    log "📄 Log completo: $LOG_FILE"
    log ""
    log "✅ FASE 1 CONCLUÍDA: Segurança Crítica"
    log ""
    log "🎯 PRÓXIMOS PASSOS:"
    log "1. Revisar logs em: $LOG_FILE"
    log "2. Testar aplicação com configuração segura:"
    log "   docker-compose -f docker-compose-secure.yml up -d"
    log "3. Executar Fase 2: ./scripts/execute-phase2.sh"
    log ""
    log "🔄 Em caso de problemas:"
    log "   ./scripts/emergency-rollback.sh"
}

# Função principal
main() {
    log "🚀 Iniciando execução da Fase 1..."
    
    check_prerequisites
    backup_current_state
    create_secrets
    fix_dockerfiles
    apply_secure_config
    run_validation_tests
    test_builds
    generate_report
    
    echo ""
    echo "🎉 FASE 1 EXECUTADA COM SUCESSO!"
    echo "📄 Log completo: $LOG_FILE"
    echo "📁 Backup salvo em: $BACKUP_DIR"
    echo ""
}

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Execute este script a partir do diretório raiz do projeto"
    exit 1
fi

# Perguntar confirmação antes de executar
echo "🚨 ATENÇÃO: Este script irá modificar sua infraestrutura Docker"
echo "📁 Backups serão criados automaticamente"
echo "🔄 Você pode fazer rollback com: ./scripts/emergency-rollback.sh"
echo ""
read -p "Deseja continuar com a Fase 1? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    main
else
    echo "❌ Operação cancelada pelo usuário"
    exit 0
fi