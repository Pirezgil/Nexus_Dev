#!/bin/bash
# Script para corrigir Dockerfiles com usuários non-root e multi-stage builds
# Parte do Plano Executivo Docker - Fase 1

set -e  # Exit on any error

echo "🔧 Iniciando correção dos Dockerfiles..."
echo "Data: $(date)"

# Definir módulos a serem corrigidos
MODULES=("user-management" "crm" "services" "agendamento")
BACKUP_DIR="backups/dockerfiles/$(date +%Y%m%d_%H%M%S)"

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

# Função para fazer backup
backup_dockerfile() {
    local module=$1
    local dockerfile_path="modules/$module/Dockerfile"
    
    if [ -f "$dockerfile_path" ]; then
        cp "$dockerfile_path" "$BACKUP_DIR/Dockerfile.$module.backup"
        echo "✅ Backup criado: $BACKUP_DIR/Dockerfile.$module.backup"
    else
        echo "⚠️ Dockerfile não encontrado: $dockerfile_path"
    fi
}

# Função para aplicar Dockerfile seguro
apply_secure_dockerfile() {
    local module=$1
    local dockerfile_path="modules/$module/Dockerfile"
    
    echo "🔄 Aplicando Dockerfile seguro para $module..."
    
    cat > "$dockerfile_path" << 'EOF'
# Multi-stage build seguro - ERP Nexus
FROM node:18-alpine AS builder

# Instalar dependências de sistema para build
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copiar arquivos de dependências (melhor caching)
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Copiar módulo shared se necessário
COPY ../shared ./shared 2>/dev/null || true

# Gerar Prisma client se prisma estiver configurado
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi

# Build TypeScript
RUN npm run build

# Stage de produção - imagem mínima e segura
FROM node:18-alpine AS production

# Atualizar system e instalar dependências runtime
RUN apk upgrade --no-cache && \
    apk add --no-cache libc6-compat openssl curl dumb-init

# Criar usuário non-root para segurança
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Instalar apenas dependências de produção
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copiar arquivos compilados com ownership correto
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma 2>/dev/null || true

# Alternar para usuário non-root
USER appuser

# Configurar ambiente
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

# Expor porta
EXPOSE 3000

# Health check melhorado
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Usar dumb-init para melhor signal handling
ENTRYPOINT ["dumb-init", "--"]

# Comando de início
CMD ["node", "dist/app.js"]
EOF
    
    echo "✅ Dockerfile seguro aplicado para $module"
}

# Função para criar .dockerignore
create_dockerignore() {
    local module=$1
    local dockerignore_path="modules/$module/.dockerignore"
    
    cat > "$dockerignore_path" << 'EOF'
# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock
logs
*.log

# Coverage directory used by tools like istanbul
coverage
.nyc_output

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build output
dist
build
.next

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode
.idea
*.swp
*.swo

# Git
.git
.gitignore
.gitattributes

# Documentation
README.md
*.md
docs/

# Test files
test/
tests/
*.test.js
*.test.ts
*.spec.js
*.spec.ts

# Temporary files
tmp/
temp/
EOF
    
    echo "✅ .dockerignore criado para $module"
}

# Função principal
main() {
    echo "📋 Módulos a serem processados: ${MODULES[*]}"
    
    # Processar cada módulo
    for module in "${MODULES[@]}"; do
        echo ""
        echo "🔄 Processando módulo: $module"
        
        # Verificar se o diretório existe
        if [ ! -d "modules/$module" ]; then
            echo "❌ Diretório não encontrado: modules/$module"
            continue
        fi
        
        # Fazer backup
        backup_dockerfile "$module"
        
        # Aplicar Dockerfile seguro
        apply_secure_dockerfile "$module"
        
        # Criar .dockerignore
        create_dockerignore "$module"
        
        echo "✅ Módulo $module processado com sucesso"
    done
    
    echo ""
    echo "🎉 Todos os Dockerfiles foram corrigidos!"
    echo "📁 Backups salvos em: $BACKUP_DIR"
    echo ""
    echo "🔍 Próximos passos:"
    echo "1. Testar builds: ./scripts/test-builds.sh"
    echo "2. Executar testes de segurança: ./scripts/security-test.sh"
    echo "3. Aplicar mudanças no docker-compose.yml"
}

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Execute este script a partir do diretório raiz do projeto (onde está o docker-compose.yml)"
    exit 1
fi

# Executar função principal
main

echo "✅ Script concluído com sucesso!"