# ==========================================
# ERP Nexus Frontend - Next.js 15 (Multi-Stage Optimizada)
# ==========================================
# Dockerfile multi-stage para resolver o erro "Could not find the module... in the React Client Manifest"
# Garante que todos os artefatos do Next.js sejam copiados corretamente para produção

# Estágio 1: Instalação de Dependências
# Isolamento das dependências para melhor cache de layers do Docker
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Copiar apenas os arquivos de dependência para otimizar cache
COPY package.json package-lock.json* ./

# Instalar APENAS dependências de produção
RUN npm ci --only=production && npm cache clean --force

# ==========================================
# Estágio 2: Builder - Compilação da Aplicação
# ==========================================
FROM node:18-alpine AS builder
WORKDIR /app

# Copiar dependências do estágio anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Instalar dependências de desenvolvimento para o build
RUN npm ci

# Executar build do Next.js - gera arquivos standalone automaticamente
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ==========================================
# Estágio 3: Runtime - Imagem Final de Produção
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Instalar curl para health checks
RUN apk add --no-cache curl

# Definir variáveis de ambiente de produção
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copiar arquivos públicos
COPY --from=builder /app/public ./public

# Definir permissões corretas
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar aplicação standalone (gerada automaticamente pelo Next.js)
# O Next.js 15 com output:'standalone' gera todos os arquivos necessários
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Health check otimizado
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de inicialização
# O Next.js standalone gera automaticamente o server.js com todas as dependências
CMD ["node", "server.js"]