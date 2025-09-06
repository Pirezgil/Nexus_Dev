#!/bin/bash
# Script de Benchmark de Performance
# Parte do Plano Executivo Docker - Medição de Performance

set -e

echo "📊 Iniciando Benchmark de Performance Docker"
echo "Data: $(date)"
echo "=========================================="

BENCHMARK_LOG="logs/benchmark-$(date +%Y%m%d_%H%M%S).log"
mkdir -p logs

# Função de logging
log() {
    local message="$1"
    echo "[$(date '+%H:%M:%S')] $message" | tee -a "$BENCHMARK_LOG"
}

# Módulos a testar
MODULES=("api-gateway" "user-management" "crm" "services" "agendamento")

log "🎯 Módulos para benchmark: ${MODULES[*]}"

# Teste 1: Tempo de Build
test_build_times() {
    log ""
    log "🔨 Teste 1: Medindo tempos de build..."
    
    for module in "${MODULES[@]}"; do
        if [ ! -d "modules/$module" ] && [ "$module" != "api-gateway" ]; then
            log "⚠️ Diretório não encontrado: modules/$module"
            continue
        fi
        
        log "⏱️ Testando build para $module..."
        
        # Limpar cache Docker para teste justo
        docker builder prune -f > /dev/null 2>&1 || true
        
        # Medir tempo de build
        start_time=$(date +%s)
        
        if [ "$module" = "api-gateway" ]; then
            build_context="."
            dockerfile="modules/api-gateway/Dockerfile"
        else
            build_context="modules/$module"
            dockerfile="Dockerfile"
        fi
        
        if docker build -t benchmark-$module -f "$dockerfile" "$build_context" > /dev/null 2>&1; then
            end_time=$(date +%s)
            duration=$((end_time - start_time))
            
            # Obter tamanho da imagem
            size=$(docker images benchmark-$module --format "{{.Size}}")
            
            log "✅ $module - Build: ${duration}s, Tamanho: $size"
            
            # Meta: build < 2min (120s)
            if [ $duration -le 120 ]; then
                log "🎯 $module atende meta de build time (< 2min)"
            else
                log "⚠️ $module excede meta de build time (${duration}s > 120s)"
            fi
        else
            log "❌ $module - Build falhou"
        fi
    done
}

# Teste 2: Startup Time
test_startup_times() {
    log ""
    log "🚀 Teste 2: Medindo tempos de startup..."
    
    # Parar todos os serviços primeiro
    docker-compose down > /dev/null 2>&1
    
    for service in postgres redis nexus-user-management nexus-crm nexus-services nexus-agendamento api-gateway; do
        log "⏱️ Testando startup para $service..."
        
        start_time=$(date +%s)
        
        # Iniciar apenas este serviço
        if [ "$service" = "postgres" ] || [ "$service" = "redis" ]; then
            docker-compose up -d $service > /dev/null 2>&1
        else
            # Para os outros serviços, precisamos dos dependências
            docker-compose up -d postgres redis > /dev/null 2>&1
            sleep 5
            docker-compose up -d $service > /dev/null 2>&1
        fi
        
        # Aguardar até que o health check passe
        timeout=60
        elapsed=0
        
        while [ $elapsed -lt $timeout ]; do
            if [ "$service" = "postgres" ]; then
                if docker exec nexus-postgres pg_isready -U nexus_user -d nexus_erp > /dev/null 2>&1; then
                    break
                fi
            elif [ "$service" = "redis" ]; then
                if docker exec nexus-redis redis-cli ping > /dev/null 2>&1; then
                    break
                fi
            else
                # Verificar se o container está rodando e saudável
                if docker-compose ps $service | grep -q "Up"; then
                    if curl -f "http://localhost:$(get_port_for_service $service)/health" > /dev/null 2>&1; then
                        break
                    fi
                fi
            fi
            
            sleep 1
            elapsed=$((elapsed + 1))
        done
        
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        
        if [ $elapsed -lt $timeout ]; then
            log "✅ $service - Startup: ${duration}s"
            
            # Meta: startup < 10s
            if [ $duration -le 10 ]; then
                log "🎯 $service atende meta de startup time (< 10s)"
            else
                log "⚠️ $service excede meta de startup time (${duration}s > 10s)"
            fi
        else
            log "❌ $service - Startup timeout (> 60s)"
        fi
        
        # Parar o serviço para próximo teste
        docker-compose stop $service > /dev/null 2>&1
    done
}

# Função auxiliar para obter porta do serviço
get_port_for_service() {
    case $1 in
        "nexus-user-management") echo "5003" ;;
        "nexus-crm") echo "5004" ;;
        "nexus-services") echo "5005" ;;
        "nexus-agendamento") echo "5008" ;;
        "api-gateway") echo "5001" ;;
        *) echo "3000" ;;
    esac
}

# Teste 3: Resource Usage
test_resource_usage() {
    log ""
    log "💾 Teste 3: Medindo uso de recursos..."
    
    # Iniciar todos os serviços
    docker-compose up -d > /dev/null 2>&1
    
    log "⏳ Aguardando estabilização dos serviços (30s)..."
    sleep 30
    
    # Coletar estatísticas
    log "📊 Coletando estatísticas de recursos..."
    
    # Criar arquivo temporário para stats
    temp_stats=$(mktemp)
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" > "$temp_stats"
    
    log "Estatísticas de recursos:"
    cat "$temp_stats" | tee -a "$BENCHMARK_LOG"
    
    # Analisar uso de memória
    total_memory_mb=0
    while IFS=$'\t' read -r container cpu memory netio; do
        if [[ $container == nexus-* ]] || [[ $container == *api-gateway* ]]; then
            # Extrair valor de memória em MB
            memory_value=$(echo "$memory" | grep -o '[0-9.]*MiB' | cut -d'M' -f1)
            if [ -n "$memory_value" ]; then
                total_memory_mb=$(echo "$total_memory_mb + $memory_value" | bc 2>/dev/null || echo "$total_memory_mb")
                
                # Meta: cada serviço < 512MB
                if (( $(echo "$memory_value > 512" | bc -l) )); then
                    log "⚠️ $container excede meta de memória (${memory_value}MB > 512MB)"
                else
                    log "🎯 $container atende meta de memória (${memory_value}MB < 512MB)"
                fi
            fi
        fi
    done < <(tail -n +2 "$temp_stats")
    
    log "💾 Uso total de memória aproximado: ${total_memory_mb}MB"
    
    rm -f "$temp_stats"
}

# Teste 4: Network Latency
test_network_latency() {
    log ""
    log "🌐 Teste 4: Testando latência de rede entre serviços..."
    
    # Testar comunicação entre serviços
    services=("nexus-user-management:3000" "nexus-crm:3000" "nexus-services:3000" "api-gateway:5001")
    
    for service in "${services[@]}"; do
        container=$(echo $service | cut -d':' -f1)
        port=$(echo $service | cut -d':' -f2)
        
        if docker ps | grep -q $container; then
            log "🔍 Testando latência para $container..."
            
            # Fazer 5 requests e medir tempo médio
            total_time=0
            successful_requests=0
            
            for i in {1..5}; do
                start_time=$(date +%s%N)
                if docker exec $container curl -f http://localhost:$port/health > /dev/null 2>&1; then
                    end_time=$(date +%s%N)
                    request_time=$((($end_time - $start_time) / 1000000)) # Convert to ms
                    total_time=$((total_time + request_time))
                    successful_requests=$((successful_requests + 1))
                fi
            done
            
            if [ $successful_requests -gt 0 ]; then
                avg_time=$((total_time / successful_requests))
                log "✅ $container - Latência média: ${avg_time}ms"
                
                # Meta: latência < 50ms
                if [ $avg_time -le 50 ]; then
                    log "🎯 $container atende meta de latência (< 50ms)"
                else
                    log "⚠️ $container excede meta de latência (${avg_time}ms > 50ms)"
                fi
            else
                log "❌ $container - Não foi possível medir latência"
            fi
        fi
    done
}

# Cleanup
cleanup() {
    log ""
    log "🧹 Limpando recursos de teste..."
    
    # Remover imagens de benchmark
    for module in "${MODULES[@]}"; do
        docker rmi benchmark-$module > /dev/null 2>&1 || true
    done
    
    log "✅ Cleanup concluído"
}

# Relatório final
generate_report() {
    log ""
    log "📋 RELATÓRIO FINAL DE BENCHMARK"
    log "==============================="
    log "🕒 Teste executado em: $(date)"
    log "📁 Log completo: $BENCHMARK_LOG"
    log ""
    log "🎯 Metas de Performance:"
    log "  - Build Time: < 2 minutos"
    log "  - Startup Time: < 10 segundos"
    log "  - Memória por serviço: < 512MB"
    log "  - Latência de rede: < 50ms"
    log ""
    log "📊 Para análise detalhada, consulte o log completo"
    
    echo ""
    echo "📈 PRÓXIMOS PASSOS:"
    echo "1. Analisar resultados detalhados no log: $BENCHMARK_LOG"
    echo "2. Identificar serviços que excedem metas"
    echo "3. Aplicar otimizações conforme Plano Executivo"
    echo "4. Executar novamente após otimizações"
}

# Função principal
main() {
    log "🚀 Iniciando benchmark completo..."
    
    test_build_times
    test_startup_times
    test_resource_usage
    test_network_latency
    
    cleanup
    generate_report
}

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Execute este script a partir do diretório raiz do projeto"
    exit 1
fi

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando"
    exit 1
fi

# Instalar bc se não estiver disponível (para cálculos)
if ! command -v bc > /dev/null 2>&1; then
    echo "⚠️ 'bc' não encontrado. Alguns cálculos podem ser limitados"
fi

# Executar benchmark
trap cleanup EXIT
main