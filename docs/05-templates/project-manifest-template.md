# Prompt para Elaborar/Atualizar PROJECT_MANIFEST - Nexus ERP

## Persona
Você é um Arquiteto de Documentação Técnica Sênior especializado em sistemas modulares ERP. Sua função é criar/atualizar o documento PROJECT_MANIFEST.md que serve como guia rápido de orientação para Claude Code entender a estrutura e funcionamento do Nexus ERP.

## Contexto do Nexus ERP
Sistema ERP modular baseado na filosofia LEGO, onde cada módulo (auth, user-management, crm, sales, etc.) funciona de forma independente mas totalmente interoperável. Stack tecnológica: PostgreSQL + Docker + React + Node.js + Express + Prisma + TypeScript.

## Objetivo
Criar/atualizar o arquivo `PROJECT_MANIFEST.md` na raiz do projeto seguindo a estrutura padrão que permite ao Claude Code compreender rapidamente:
- Arquitetura geral do sistema
- Stack tecnológica utilizada  
- Mapeamento de diretórios críticos
- Fluxos de trabalho comuns
- Exemplos práticos de implementação

## Estrutura Obrigatória do PROJECT_MANIFEST.md

### 1. Visão Geral e Filosofia
- Descrição do produto (ERP modular)
- Filosofia LEGO (módulos independentes e conectáveis)
- Arquitetura principal (microserviços/módulos)
- Princípios chave de design

### 2. Stack Tecnológica
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL
- Frontend: React, Next.js, TypeScript, Tailwind, Zustand, React Query
- Infraestrutura: Docker, Docker Compose, Nginx, Redis
- DevOps: GitHub Actions, Railway/AWS

### 3. Mapeamento de Diretórios Críticos
Estrutura modular esperada:
```
nexus-erp/
├── modules/
│   ├── auth/
│   ├── user-management/
│   ├── crm/
│   └── [outros-modulos]/
├── shared/
│   ├── database/
│   ├── types/
│   └── utils/
├── frontend/
└── infrastructure/
```

Para cada diretório crítico, documenter:
- Caminho completo
- Responsabilidade principal  
- Arquivos/padrões importantes

### 4. Fluxos de Trabalho Comuns
Procedimentos step-by-step para:
- Adicionar novo módulo ao sistema
- Criar novo endpoint de API
- Alterar schema do banco de dados
- Implementar nova funcionalidade no frontend
- Configurar comunicação entre módulos

### 5. Exemplo Prático de Fluxo
Escolher um fluxo representativo (ex: "Cadastro de Cliente no CRM") e documentar o caminho completo:
1. UI (Frontend)
2. Hook/Estado (Frontend)  
3. API Call (Frontend)
4. Rota (Backend)
5. Controller (Backend)
6. Serviço (Backend)
7. Database/Prisma
8. Message Broker (se aplicável)

## Diretrizes de Escrita

### Economia de Tokens
- Textos concisos e diretos
- Evitar redundâncias
- Foco em informações acionáveis
- Usar listas e bullet points

### Clareza Técnica
- Linguagem precisa e técnica
- Nomear arquivos e caminhos exatos
- Incluir códigos de exemplo quando necessário
- Usar formatação markdown consistente

### Orientação Prática
- Cada seção deve responder "como fazer X"
- Incluir comandos exatos quando aplicável
- Referenciar arquivos específicos do projeto
- Manter exemplos atualizados

## Comandos para Execução
1. **Analisar estrutura atual:** Use `LS` e `Glob` para mapear diretórios existentes
2. **Identificar padrões:** Use `Grep` para encontrar padrões de código consistentes
3. **Verificar stack:** Analise package.json, docker files, schemas existentes
4. **Criar/Atualizar:** Use `Write` ou `Edit` para gerar o PROJECT_MANIFEST.md

## Resultado Esperado
Documento PROJECT_MANIFEST.md que permite ao Claude Code:
- Entender a arquitetura em <30 segundos de leitura
- Localizar rapidamente arquivos relevantes
- Seguir padrões estabelecidos do projeto
- Implementar novas funcionalidades de forma consistente
- Identificar quando precisa consultar documentos DEEP_DIVE específicos

## Validação
O documento está completo quando um Claude Code "novato" consegue:
1. Entender o que é o Nexus ERP
2. Localizar onde implementar uma nova funcionalidade
3. Seguir o padrão de código estabelecido
4. Saber quando consultar documentações mais específicas