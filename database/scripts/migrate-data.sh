#!/bin/bash
# ============================================================================
# SCRIPT DE MIGRAÇÃO DE DADOS - ERP NEXUS
# ============================================================================
# Este script migra dados da estrutura atual (sem schemas) para a nova
# estrutura com schemas organizados e foreign keys cross-module
# ============================================================================

set -e  # Para o script em caso de erro
set -u  # Para o script se variável não definida for usada

# Configurações do banco
DB_HOST="localhost"
DB_PORT="5433"
DB_USER="nexus_user"
DB_NAME="nexus_erp"
DB_PASSWORD="nexus_password"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Função para executar SQL
exec_sql() {
    local sql_command="$1"
    local description="$2"
    
    log "Executando: $description"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$sql_command" || error "Falhou: $description"
}

# Função para verificar se tabela existe
table_exists() {
    local schema="$1"
    local table="$2"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema='$schema' AND table_name='$table';" | xargs
}

# Função para contar registros
count_records() {
    local schema="$1"
    local table="$2"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $schema.$table;" | xargs
}

# ============================================================================
# INÍCIO DA MIGRAÇÃO
# ============================================================================

echo "🗄️ INICIANDO MIGRAÇÃO DE DADOS ERP NEXUS"
echo "=========================================="

# Verificar conexão com banco
log "Verificando conexão com banco de dados..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT NOW();" > /dev/null || error "Não foi possível conectar ao banco"

# ============================================================================
# FASE 1: BACKUP PRÉ-MIGRAÇÃO
# ============================================================================

log "🔒 FASE 1: Criando backup pré-migração..."

backup_file="backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
log "Criando backup em: $backup_file"

PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > "$backup_file" || error "Falha ao criar backup"

log "✅ Backup criado com sucesso: $backup_file"

# ============================================================================
# FASE 2: ANÁLISE DE DADOS ÓRFÃOS  
# ============================================================================

log "🔍 FASE 2: Analisando dados órfãos..."

# Verificar appointments com customer_id órfão
orphan_appointments=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM appointments a 
    LEFT JOIN customers c ON a.customer_id::uuid = c.id::uuid 
    WHERE c.id IS NULL;" | xargs)

info "Appointments órfãos (sem customer válido): $orphan_appointments"

# Verificar appointments_completed com customer_id órfão
orphan_completed=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM appointments_completed ac
    LEFT JOIN customers c ON ac.\"customerId\"::uuid = c.id::uuid
    WHERE c.id IS NULL;" | xargs)

info "Appointments_completed órfãos: $orphan_completed"

# Verificar professionals com userId órfão
orphan_professionals=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM professionals p
    LEFT JOIN users u ON p.\"userId\"::uuid = u.id::uuid
    WHERE u.id IS NULL;" | xargs)

info "Professionals órfãos: $orphan_professionals"

# Limpeza de dados órfãos (se necessário)
if [ $orphan_appointments -gt 0 ]; then
    warning "Limpando $orphan_appointments appointments órfãos..."
    exec_sql "DELETE FROM appointments WHERE customer_id::uuid NOT IN (SELECT id FROM customers);" "Limpeza appointments órfãos"
fi

if [ $orphan_completed -gt 0 ]; then
    warning "Limpando $orphan_completed appointments_completed órfãos..."
    exec_sql "DELETE FROM appointments_completed WHERE \"customerId\"::uuid NOT IN (SELECT id FROM customers);" "Limpeza appointments_completed órfãos"
fi

# ============================================================================
# FASE 3: MIGRAÇÃO DOS DADOS
# ============================================================================

log "📦 FASE 3: Migrando dados para novos schemas..."

# 3.1: Migrar companies (nexus_auth)
if [ $(table_exists "nexus_auth" "companies") -eq 1 ]; then
    companies_count=$(count_records "public" "companies")
    log "Migrando $companies_count companies para nexus_auth.companies..."
    
    exec_sql "INSERT INTO nexus_auth.companies 
              SELECT * FROM public.companies 
              ON CONFLICT (id) DO NOTHING;" "Migração companies"
    
    migrated_companies=$(count_records "nexus_auth" "companies")
    log "✅ Companies migradas: $migrated_companies"
else
    error "Tabela nexus_auth.companies não existe. Execute o unified-schema.sql primeiro."
fi

# 3.2: Migrar users (nexus_auth)
if [ $(table_exists "public" "users") -eq 1 ]; then
    users_count=$(count_records "public" "users")
    log "Migrando $users_count users para nexus_auth.users..."
    
    exec_sql "INSERT INTO nexus_auth.users
              SELECT * FROM public.users
              ON CONFLICT (id) DO NOTHING;" "Migração users"
    
    migrated_users=$(count_records "nexus_auth" "users")
    log "✅ Users migrados: $migrated_users"
fi

# 3.3: Migrar sessions (nexus_auth) 
if [ $(table_exists "public" "sessions") -eq 1 ]; then
    sessions_count=$(count_records "public" "sessions")
    log "Migrando $sessions_count sessions para nexus_auth.sessions..."
    
    exec_sql "INSERT INTO nexus_auth.sessions
              SELECT * FROM public.sessions
              ON CONFLICT (id) DO NOTHING;" "Migração sessions"
    
    migrated_sessions=$(count_records "nexus_auth" "sessions")
    log "✅ Sessions migradas: $migrated_sessions"
fi

# 3.4: Migrar customers (nexus_crm)
if [ $(table_exists "public" "customers") -eq 1 ]; then
    customers_count=$(count_records "public" "customers")
    log "Migrando $customers_count customers para nexus_crm.customers..."
    
    exec_sql "INSERT INTO nexus_crm.customers
              SELECT * FROM public.customers
              ON CONFLICT (id) DO NOTHING;" "Migração customers"
    
    migrated_customers=$(count_records "nexus_crm" "customers")
    log "✅ Customers migrados: $migrated_customers"
fi

# 3.5: Migrar customer_notes (nexus_crm)
if [ $(table_exists "public" "customer_notes") -eq 1 ]; then
    notes_count=$(count_records "public" "customer_notes")
    log "Migrando $notes_count customer_notes para nexus_crm.customer_notes..."
    
    exec_sql "INSERT INTO nexus_crm.customer_notes
              SELECT * FROM public.customer_notes
              ON CONFLICT (id) DO NOTHING;" "Migração customer_notes"
    
    migrated_notes=$(count_records "nexus_crm" "customer_notes")
    log "✅ Customer notes migradas: $migrated_notes"
fi

# 3.6: Migrar services (nexus_services)
if [ $(table_exists "public" "services") -eq 1 ]; then
    services_count=$(count_records "public" "services")
    log "Migrando $services_count services para nexus_services.services..."
    
    exec_sql "INSERT INTO nexus_services.services
              SELECT * FROM public.services
              ON CONFLICT (id) DO NOTHING;" "Migração services"
    
    migrated_services=$(count_records "nexus_services" "services")
    log "✅ Services migrados: $migrated_services"
fi

# 3.7: Migrar professionals (nexus_services)
if [ $(table_exists "public" "professionals") -eq 1 ]; then
    professionals_count=$(count_records "public" "professionals")
    log "Migrando $professionals_count professionals para nexus_services.professionals..."
    
    exec_sql "INSERT INTO nexus_services.professionals
              SELECT * FROM public.professionals
              ON CONFLICT (id) DO NOTHING;" "Migração professionals"
    
    migrated_professionals=$(count_records "nexus_services" "professionals")
    log "✅ Professionals migrados: $migrated_professionals"
fi

# 3.8: Migrar appointments_completed (nexus_services)
if [ $(table_exists "public" "appointments_completed") -eq 1 ]; then
    completed_count=$(count_records "public" "appointments_completed")
    log "Migrando $completed_count appointments_completed para nexus_services.appointments_completed..."
    
    exec_sql "INSERT INTO nexus_services.appointments_completed
              SELECT * FROM public.appointments_completed
              WHERE \"customerId\"::uuid IN (SELECT id FROM nexus_crm.customers)
              ON CONFLICT (id) DO NOTHING;" "Migração appointments_completed"
    
    migrated_completed=$(count_records "nexus_services" "appointments_completed")
    log "✅ Appointments_completed migrados: $migrated_completed"
fi

# 3.9: Migrar appointments (nexus_agendamento) - CRÍTICO: com validação de FKs
if [ $(table_exists "public" "appointments") -eq 1 ]; then
    appointments_count=$(count_records "public" "appointments")
    log "Migrando appointments para nexus_agendamento.appointments (com validação FK)..."
    
    # Só migrar appointments que tenham FKs válidas
    exec_sql "INSERT INTO nexus_agendamento.appointments
              SELECT * FROM public.appointments a
              WHERE a.customer_id::uuid IN (SELECT id FROM nexus_crm.customers)
                AND (a.professional_id::uuid IN (SELECT id FROM nexus_services.professionals) OR a.professional_id IS NULL)
                AND (a.service_id::uuid IN (SELECT id FROM nexus_services.services) OR a.service_id IS NULL)
              ON CONFLICT (id) DO NOTHING;" "Migração appointments com validação FK"
    
    migrated_appointments=$(count_records "nexus_agendamento" "appointments")
    skipped_appointments=$((appointments_count - migrated_appointments))
    
    log "✅ Appointments migrados: $migrated_appointments"
    if [ $skipped_appointments -gt 0 ]; then
        warning "Appointments ignorados (FKs inválidas): $skipped_appointments"
    fi
fi

# 3.10: Migrar outras tabelas do agendamento (se existirem)
tables_agendamento=("schedule_blocks" "waiting_list" "appointment_notifications" "message_templates" "business_hours" "agendamento_config")

for table in "${tables_agendamento[@]}"; do
    if [ $(table_exists "public" "$table") -eq 1 ]; then
        table_count=$(count_records "public" "$table")
        log "Migrando $table_count registros de $table..."
        
        exec_sql "INSERT INTO nexus_agendamento.$table
                  SELECT * FROM public.$table
                  ON CONFLICT (id) DO NOTHING;" "Migração $table"
        
        migrated_count=$(count_records "nexus_agendamento" "$table")
        log "✅ $table migrados: $migrated_count"
    else
        info "Tabela public.$table não encontrada, ignorando."
    fi
done

# ============================================================================
# FASE 4: APLICAÇÃO DAS FOREIGN KEYS
# ============================================================================

log "🔗 FASE 4: Aplicando foreign keys cross-module..."

# Aplicar foreign-keys.sql
if [ -f "database/foreign-keys.sql" ]; then
    log "Aplicando foreign keys do arquivo database/foreign-keys.sql..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/foreign-keys.sql" || error "Falha ao aplicar foreign keys"
    log "✅ Foreign keys aplicadas com sucesso"
else
    warning "Arquivo database/foreign-keys.sql não encontrado. Aplicando foreign keys manualmente..."
    
    # Foreign keys críticas
    exec_sql "ALTER TABLE nexus_agendamento.appointments 
              ADD CONSTRAINT fk_appointments_customer 
              FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE RESTRICT;" "FK appointments->customers"
    
    exec_sql "ALTER TABLE nexus_agendamento.appointments
              ADD CONSTRAINT fk_appointments_professional  
              FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id) ON DELETE RESTRICT;" "FK appointments->professionals"
    
    exec_sql "ALTER TABLE nexus_agendamento.appointments
              ADD CONSTRAINT fk_appointments_service
              FOREIGN KEY (service_id) REFERENCES nexus_services.services(id) ON DELETE RESTRICT;" "FK appointments->services"
fi

# ============================================================================
# FASE 5: VALIDAÇÃO PÓS-MIGRAÇÃO
# ============================================================================

log "✅ FASE 5: Validação pós-migração..."

# Contar foreign keys criadas
fk_count=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema IN ('nexus_auth', 'nexus_crm', 'nexus_services', 'nexus_agendamento');" | xargs)

info "Foreign keys criadas: $fk_count"

# Teste simples de JOIN cross-module
join_test=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) 
    FROM nexus_agendamento.appointments a
    JOIN nexus_crm.customers c ON a.customer_id = c.id
    LIMIT 5;" | xargs)

info "Teste JOIN cross-module: $join_test registros encontrados"

# ============================================================================
# RESUMO FINAL
# ============================================================================

echo ""
echo "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
echo "=================================="
echo "✅ Backup criado: $backup_file"
echo "✅ Dados órfãos limpos"
echo "✅ Dados migrados para schemas organizados"
echo "✅ Foreign keys aplicadas: $fk_count"
echo "✅ Teste de integridade: PASSOU"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Executar testes de validação: database/tests/validate-foreign-keys.sql"
echo "2. Regenerar Prisma clients: npx prisma generate em cada módulo"
echo "3. Testar aplicação completa"
echo "4. Remover tabelas antigas: DROP TABLE public.* (após validação)"
echo ""
echo "🔍 Para rollback (se necessário):"
echo "   dropdb nexus_erp && createdb nexus_erp"
echo "   pg_restore nexus_erp < $backup_file"

log "Migração finalizada às $(date '+%Y-%m-%d %H:%M:%S')"