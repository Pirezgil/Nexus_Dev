# Deployment Guide - Nexus ERP

Guia completo para deploy em produção com Docker Swarm, IA monitoring e estratégias de rollback.

## 🎯 Visão Geral do Deploy

### **Arquitetura de Produção**
```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                       │
│                     Nginx (SSL)                         │
└─────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────────────────────────────────────────┐
│                Docker Swarm Cluster                    │
├──────────────┬──────────────┬──────────────┬───────────┤
│ User Mgmt    │     CRM      │   Services   │Agendamento│
│   :5001      │    :5002     │    :5003     │   :5007   │
└──────────────┴──────────────┴──────────────┴───────────┘
┌────────────────────────────────────────────────────────┐
│          PostgreSQL + Redis + Monitoring               │
└────────────────────────────────────────────────────────┘
```

### **Estratégias de Deploy**
- **Blue-Green Deployment** - Zero downtime
- **Rolling Updates** - Deploy gradual por módulo
- **Canary Releases** - Teste com subset de usuários
- **Rollback Inteligente** - IA decide escopo mínimo

## 🐳 Docker Swarm Setup

### **Inicialização do Cluster**
```bash
# Master node
docker swarm init --advertise-addr <MASTER_IP>

# Worker nodes (execute em cada worker)
docker swarm join --token <TOKEN> <MASTER_IP>:2377

# Verificar cluster
docker node ls
```

### **Configuração de Secrets**
```bash
# JWT Secret
echo "your-super-secret-jwt-key" | docker secret create jwt_secret -

# Database credentials
echo "postgresql://user:pass@postgres:5432/nexus_erp" | docker secret create db_url -

# WhatsApp API
echo "your-whatsapp-token" | docker secret create whatsapp_token -

# Listar secrets
docker secret ls
```

## 📁 Estrutura de Deploy

### **docker-compose.prod.yml**
```yaml
version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    deploy:
      replicas: 2
      placement:
        constraints: [node.role == manager]
    networks:
      - nexus-network

  # User Management Module
  nexus-user-management:
    image: nexus-user-management:${VERSION}
    environment:
      - NODE_ENV=production
    secrets:
      - jwt_secret
      - db_url
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
    networks:
      - nexus-network

  # CRM Module  
  nexus-crm:
    image: nexus-crm:${VERSION}
    environment:
      - NODE_ENV=production
      - USER_MANAGEMENT_URL=http://nexus-user-management:5000
    secrets:
      - db_url
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
    networks:
      - nexus-network

  # Services Module
  nexus-services:
    image: nexus-services:${VERSION}
    environment:
      - NODE_ENV=production
      - USER_MANAGEMENT_URL=http://nexus-user-management:5000
      - CRM_URL=http://nexus-crm:5000
    secrets:
      - db_url
    volumes:
      - services_uploads:/uploads
    deploy:
      replicas: 3  # Mais réplicas (core do negócio)
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    networks:
      - nexus-network

  # Agendamento Module
  nexus-agendamento:
    image: nexus-agendamento:${VERSION}
    environment:
      - NODE_ENV=production
      - SERVICES_URL=http://nexus-services:5000
      - CRM_URL=http://nexus-crm:5000
    secrets:
      - db_url
      - whatsapp_token
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.5'
          memory: 3G
    networks:
      - nexus-network

  # Database
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=nexus_erp
      - POSTGRES_USER=postgres
    secrets:
      - source: postgres_password
        target: POSTGRES_PASSWORD_FILE
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    networks:
      - nexus-network

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
    networks:
      - nexus-network

  # IA Monitor
  nexus-ai-monitor:
    image: nexus-ai-monitor:${VERSION}
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN}
      - INFLUXDB_URL=http://influxdb:8086
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]
    networks:
      - nexus-network

volumes:
  postgres_data:
  redis_data:
  services_uploads:

networks:
  nexus-network:
    driver: overlay

secrets:
  jwt_secret:
    external: true
  db_url:
    external: true
  whatsapp_token:
    external: true
  postgres_password:
    external: true
```

### **Nginx Configuration**
```nginx
# nginx/nginx.conf
upstream user_management {
    server nexus-user-management:5000;
}

upstream crm {
    server nexus-crm:5000;
}

upstream services {
    server nexus-services:5000;
}

upstream agendamento {
    server nexus-agendamento:5000;
}

server {
    listen 80;
    server_name nexus-erp.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nexus-erp.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubdomains";

    # User Management
    location /api/auth/ {
        proxy_pass http://user_management/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # CRM
    location /api/crm/ {
        proxy_pass http://crm/api/crm/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Services
    location /api/services/ {
        proxy_pass http://services/api/services/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Upload de fotos - aumentar timeout
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }

    # Agendamento
    location /api/agendamento/ {
        proxy_pass http://agendamento/api/agendamento/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health checks
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## 🚀 Pipeline CI/CD

### **GitHub Actions Workflow**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: nexus-erp

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          npm ci
          npm run test
          npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        module: [user-management, crm, services, agendamento]
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          context: ./modules/${{ matrix.module }}
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.module }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-${{ matrix.module }}:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          docker stack deploy -c docker-compose.staging.yml nexus-staging

      - name: Run staging tests
        run: |
          npm run test:e2e -- --baseUrl=https://staging.nexus-erp.com

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          # Blue-Green Deployment
          export VERSION=${{ github.sha }}
          docker stack deploy -c docker-compose.prod.yml nexus-green
          
          # Health check
          ./scripts/health-check.sh nexus-green
          
          # Switch traffic
          ./scripts/switch-traffic.sh nexus-blue nexus-green
          
          # Remove old stack
          docker stack rm nexus-blue

      - name: Notify success
        run: |
          curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_TOKEN }}/sendMessage" \
            -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
            -d text="🚀 Nexus ERP deployed successfully to production. Version: ${{ github.sha }}"
```

## 📊 Monitoring e Observabilidade

### **Health Checks**
```bash
#!/bin/bash
# scripts/health-check.sh

STACK_NAME=$1
TIMEOUT=300  # 5 minutes
INTERVAL=10

echo "Health checking stack: $STACK_NAME"

for i in $(seq 1 $((TIMEOUT/INTERVAL))); do
  echo "Check $i..."
  
  # Check all services are running
  RUNNING=$(docker service ls --filter name=${STACK_NAME} --format "table {{.Replicas}}" | grep -c "1/1\|2/2\|3/3")
  TOTAL=$(docker service ls --filter name=${STACK_NAME} | wc -l)
  TOTAL=$((TOTAL-1))  # Remove header
  
  if [ "$RUNNING" -eq "$TOTAL" ]; then
    echo "✅ All services healthy"
    
    # Test API endpoints
    if curl -f http://localhost/health > /dev/null 2>&1; then
      echo "✅ API endpoints responding"
      echo "🎉 Health check passed!"
      exit 0
    fi
  fi
  
  echo "⏳ Waiting for services to be ready... ($RUNNING/$TOTAL)"
  sleep $INTERVAL
done

echo "❌ Health check failed!"
exit 1
```

### **IA Monitor Integration**
```python
# ai-monitor/src/production_monitor.py
import requests
import time
from datetime import datetime
from telegram import Bot

class ProductionMonitor:
    def __init__(self):
        self.telegram_bot = Bot(token=os.getenv('TELEGRAM_TOKEN'))
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.services = [
            'http://nexus-user-management:5000/health',
            'http://nexus-crm:5000/health',
            'http://nexus-services:5000/health',
            'http://nexus-agendamento:5000/health'
        ]

    def check_services(self):
        failed_services = []
        
        for service_url in self.services:
            try:
                response = requests.get(service_url, timeout=5)
                if response.status_code != 200:
                    failed_services.append(service_url)
            except requests.RequestException:
                failed_services.append(service_url)
        
        if failed_services:
            self.alert_critical(f"🚨 Services down: {', '.join(failed_services)}")
            
    def alert_critical(self, message):
        self.telegram_bot.send_message(
            chat_id=self.chat_id,
            text=f"🔴 NEXUS PROD ALERT\n\n{message}\n\nTime: {datetime.now()}"
        )

    def monitor_loop(self):
        while True:
            self.check_services()
            time.sleep(30)  # Check every 30 seconds

if __name__ == "__main__":
    monitor = ProductionMonitor()
    monitor.monitor_loop()
```

## 🔄 Rollback Strategy

### **Rollback Automático**
```bash
#!/bin/bash
# scripts/auto-rollback.sh

CURRENT_STACK="nexus-green"
PREVIOUS_STACK="nexus-blue"

# Check if current deployment is failing
FAILING_SERVICES=$(docker service ls --filter name=${CURRENT_STACK} --format "table {{.Name}} {{.Replicas}}" | grep "0/")

if [ ! -z "$FAILING_SERVICES" ]; then
  echo "🚨 Failing services detected:"
  echo "$FAILING_SERVICES"
  
  echo "🔄 Initiating automatic rollback..."
  
  # Switch traffic back
  ./scripts/switch-traffic.sh $CURRENT_STACK $PREVIOUS_STACK
  
  # Remove failing stack
  docker stack rm $CURRENT_STACK
  
  # Alert
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="🔄 AUTOMATIC ROLLBACK executed. Previous version restored."
  
  echo "✅ Rollback completed"
else
  echo "✅ All services healthy"
fi
```

### **Rollback Manual**
```bash
# Rollback específico de um módulo
docker service update --image nexus-crm:previous-version nexus_nexus-crm

# Rollback completo para versão anterior
export VERSION=previous-sha
docker stack deploy -c docker-compose.prod.yml nexus
```

## 🔧 Scripts de Automação

### **Deploy Script**
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

VERSION=${1:-latest}
ENVIRONMENT=${2:-staging}

echo "🚀 Deploying Nexus ERP"
echo "Version: $VERSION"
echo "Environment: $ENVIRONMENT"

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."
./scripts/pre-deploy-check.sh

# Database migrations
echo "🗄️ Running database migrations..."
docker run --rm -e DATABASE_URL="$DATABASE_URL" \
  nexus-migration-runner:$VERSION npm run migrate

# Deploy stack
echo "📦 Deploying services..."
export VERSION=$VERSION
docker stack deploy -c docker-compose.$ENVIRONMENT.yml nexus-$ENVIRONMENT

# Health check
echo "🔍 Running health checks..."
./scripts/health-check.sh nexus-$ENVIRONMENT

# Post-deployment tests
if [ "$ENVIRONMENT" = "production" ]; then
  echo "🧪 Running post-deployment tests..."
  npm run test:smoke -- --baseUrl=https://nexus-erp.com
fi

echo "✅ Deployment completed successfully!"
```

## 📈 Scaling Strategy

### **Auto-scaling Configuration**
```yaml
# Auto-scaling based on metrics
services:
  nexus-services:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
      # Custom scaling (requires external orchestrator)
      labels:
        - "autoscaling.min_replicas=2"
        - "autoscaling.max_replicas=10"
        - "autoscaling.target_cpu=70"
        - "autoscaling.target_memory=80"
```

### **Manual Scaling**
```bash
# Scale up Services module (high demand)
docker service scale nexus_nexus-services=5

# Scale down Agendamento module (low demand)
docker service scale nexus_nexus-agendamento=1

# View current scaling
docker service ls
```

## 🔒 Security Hardening

### **Docker Security**
```yaml
# Security-focused service configuration
services:
  nexus-user-management:
    image: nexus-user-management:${VERSION}
    user: "1000:1000"  # Non-root user
    read_only: true     # Read-only filesystem
    tmpfs:
      - /tmp
      - /var/cache
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
```

### **Network Security**
```yaml
networks:
  nexus-network:
    driver: overlay
    driver_opts:
      encrypted: "true"  # Encrypt network traffic
    attachable: false    # Prevent manual attachment
```

## 📋 Deployment Checklist

### **Pre-deployment**
- [ ] **Tests passing** - Unit, integration, E2E
- [ ] **Security scan** - Vulnerabilities checked
- [ ] **Performance test** - Load testing completed
- [ ] **Database backup** - Recent backup available
- [ ] **Rollback plan** - Ready to execute if needed

### **Deployment**
- [ ] **Staging deploy** - Validated in staging environment
- [ ] **Health checks** - All services responding
- [ ] **Database migrations** - Applied successfully
- [ ] **Traffic switch** - Load balancer updated
- [ ] **Monitoring** - Alerts configured

### **Post-deployment**
- [ ] **Smoke tests** - Critical paths working
- [ ] **Performance monitoring** - Response times normal
- [ ] **Error monitoring** - No critical errors
- [ ] **User feedback** - No critical issues reported
- [ ] **Documentation** - Deployment notes updated

## 🆘 Emergency Procedures

### **Emergency Rollback**
```bash
# Immediate rollback (< 2 minutes)
./scripts/emergency-rollback.sh

# This script:
# 1. Switches load balancer to previous version
# 2. Removes current failing deployment
# 3. Alerts team via Telegram/Slack
# 4. Creates incident report
```

### **Service Recovery**
```bash
# Restart specific service
docker service update --force nexus_nexus-services

# Restart entire stack
docker stack rm nexus
sleep 10
docker stack deploy -c docker-compose.prod.yml nexus
```

## 📞 Support Contacts

**Production Issues:**
- **On-call:** +55 11 99999-9999
- **Telegram:** @nexus-alerts
- **Email:** alerts@nexus-erp.com

**Escalation:**
- **L1:** Development team
- **L2:** DevOps team  
- **L3:** Architecture team

---

**🚨 Remember:** Always test deployment procedures in staging first!

**📖 More info:** [DevOps Architecture](../01-architecture/devops-deployment.md)