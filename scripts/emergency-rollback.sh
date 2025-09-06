#!/bin/bash
# Script de Rollback de Emergência
# Parte do Plano Executivo Docker - Procedimentos de Emergência

set -e

echo "🚨 INICIANDO ROLLBACK DE EMERGÊNCIA"
echo "Data: $(date)"
echo "========================================"

ROLLBACK_LOG="logs/emergency-rollback-$(date +%Y%m%d_%H%M%S).log"

# Criar diretório de logs se não existir
mkdir -p logs

# Função de logging
log() {
    local message="$1"
    echo "[$(date '+%H:%M:%S')] $message" | tee -a "$ROLLBACK_LOG"
}

log "🚨 ROLLBACK DE EMERGÊNCIA INICIADO"

# Passo 1: Parar todos os serviços
log "🛑 Parando todos os serviços..."
docker-compose down --remove-orphans 2>&1 | tee -a "$ROLLBACK_LOG"

if [ $? -eq 0 ]; then
    log "✅ Serviços parados com sucesso"
else
    log "⚠️ Alguns problemas ao parar serviços, continuando..."
fi

# Passo 2: Verificar se existe backup do docker-compose.yml
COMPOSE_BACKUP=""

# Procurar pelo backup mais recente
if [ -f "docker-compose.yml.backup" ]; then
    COMPOSE_BACKUP="docker-compose.yml.backup"
    log "📁 Encontrado backup: docker-compose.yml.backup"
elif [ -f "docker-compose.yml.bak" ]; then
    COMPOSE_BACKUP="docker-compose.yml.bak"
    log "📁 Encontrado backup: docker-compose.yml.bak"
else
    # Procurar na pasta de backups
    LATEST_BACKUP=$(find backups/ -name "docker-compose.yml*" -type f 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        COMPOSE_BACKUP="$LATEST_BACKUP"
        log "📁 Encontrado backup em: $LATEST_BACKUP"
    fi
fi

# Restaurar docker-compose.yml
if [ -n "$COMPOSE_BACKUP" ]; then
    log "🔄 Restaurando docker-compose.yml do backup..."
    cp "$COMPOSE_BACKUP" docker-compose.yml
    log "✅ docker-compose.yml restaurado"
else
    log "⚠️ Nenhum backup encontrado para docker-compose.yml"
    log "📋 Usando versão atual (pode conter problemas)"
fi

# Passo 3: Restaurar Dockerfiles se necessário
log "🔄 Verificando e restaurando Dockerfiles..."

MODULES=("user-management" "crm" "services" "agendamento")

for module in "${MODULES[@]}"; do
    DOCKERFILE_PATH="modules/$module/Dockerfile"
    
    # Procurar backup mais recente
    DOCKERFILE_BACKUP=""
    
    if [ -f "${DOCKERFILE_PATH}.backup" ]; then
        DOCKERFILE_BACKUP="${DOCKERFILE_PATH}.backup"
    else
        # Procurar na pasta de backups
        LATEST_DOCKERFILE_BACKUP=$(find backups/ -name "Dockerfile.$module.backup" -type f 2>/dev/null | head -1)
        if [ -n "$LATEST_DOCKERFILE_BACKUP" ]; then
            DOCKERFILE_BACKUP="$LATEST_DOCKERFILE_BACKUP"
        fi
    fi
    
    if [ -n "$DOCKERFILE_BACKUP" ]; then
        log "🔄 Restaurando Dockerfile para $module..."
        cp "$DOCKERFILE_BACKUP" "$DOCKERFILE_PATH"
        log "✅ Dockerfile $module restaurado"
    else
        log "⚠️ Backup não encontrado para Dockerfile $module"
    fi
done

# Passo 4: Limpar imagens problemáticas
log "🧹 Limpando imagens Docker problemáticas..."

# Remover imagens que podem ter sido criadas com problemas
IMAGES_TO_REMOVE=$(docker images | grep -E "(nexus-|security-test-|benchmark-)" | awk '{print $3}' | head -10)

if [ -n "$IMAGES_TO_REMOVE" ]; then
    echo "$IMAGES_TO_REMOVE" | xargs docker rmi -f 2>&1 | tee -a "$ROLLBACK_LOG" || true
    log "✅ Imagens problemáticas removidas"
else
    log "ℹ️ Nenhuma imagem problemática encontrada"
fi

# Passo 5: Subir serviços essenciais primeiro
log "🚀 Subindo serviços essenciais (postgres, redis)..."

# Subir apenas postgres e redis primeiro
docker-compose up -d postgres redis 2>&1 | tee -a "$ROLLBACK_LOG"

# Aguardar serviços essenciais
log "⏳ Aguardando serviços essenciais (30 segundos)..."
sleep 30

# Verificar se os serviços essenciais estão funcionando
if docker-compose ps postgres | grep -q "Up"; then
    log "✅ PostgreSQL está rodando"
else
    log "❌ PostgreSQL falhou ao iniciar"
fi

if docker-compose ps redis | grep -q "Up"; then
    log "✅ Redis está rodando"
else
    log "❌ Redis falhou ao iniciar"
fi

# Passo 6: Subir todos os outros serviços
log "🚀 Subindo todos os serviços..."
docker-compose up -d 2>&1 | tee -a "$ROLLBACK_LOG"

# Passo 7: Aguardar e verificar status
log "⏳ Aguardando inicialização completa (60 segundos)..."
sleep 60

# Verificar status de todos os serviços
log "🔍 Verificando status dos serviços..."
docker-compose ps | tee -a "$ROLLBACK_LOG"

# Contar serviços funcionando
SERVICES_UP=$(docker-compose ps | grep "Up" | wc -l)
TOTAL_SERVICES=$(docker-compose ps | tail -n +3 | wc -l)

log "📊 Status: $SERVICES_UP de $TOTAL_SERVICES serviços estão rodando"

# Passo 8: Teste básico de conectividade
log "🌐 Testando conectividade básica..."

# Lista de endpoints para testar
ENDPOINTS=(
    "http://localhost:5433"  # PostgreSQL (check if port is accessible)
    "http://localhost:6379"  # Redis (if exposed)
    "http://localhost:80"    # Nginx
)

WORKING_ENDPOINTS=0

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f "$endpoint" --connect-timeout 5 >/dev/null 2>&1; then
        log "✅ $endpoint está respondendo"
        ((WORKING_ENDPOINTS++))
    else
        log "❌ $endpoint não está respondendo"
    fi
done

# Passo 9: Relatório final
log "📋 RELATÓRIO FINAL DO ROLLBACK"
log "==============================="
log "🕒 Tempo total: aproximadamente 2-3 minutos"
log "📊 Serviços funcionando: $SERVICES_UP/$TOTAL_SERVICES"
log "🌐 Endpoints funcionando: $WORKING_ENDPOINTS/${#ENDPOINTS[@]}"
log "📁 Log completo salvo em: $ROLLBACK_LOG"

if [ $SERVICES_UP -ge $(( TOTAL_SERVICES * 70 / 100 )) ]; then
    log "✅ ROLLBACK CONCLUÍDO COM SUCESSO"
    log "🎉 Sistema restaurado para estado funcional"
    
    echo ""
    echo "🎯 PRÓXIMOS PASSOS RECOMENDADOS:"
    echo "1. Verificar logs dos serviços: docker-compose logs"
    echo "2. Testar funcionalidades críticas manualmente"
    echo "3. Investigar causa raiz do problema"
    echo "4. Planejar nova implementação das correções"
    echo ""
    
    exit 0
else
    log "⚠️ ROLLBACK PARCIAL - ALGUNS SERVIÇOS AINDA COM PROBLEMAS"
    log "🔧 Intervenção manual pode ser necessária"
    
    echo ""
    echo "🚨 AÇÕES DE EMERGÊNCIA ADICIONAIS:"
    echo "1. Verificar logs detalhados: docker-compose logs"
    echo "2. Verificar recursos do sistema: docker stats"
    echo "3. Considerar reinicialização completa do Docker"
    echo "4. Contatar equipe de DevOps se necessário"
    echo ""
    
    exit 1
fi