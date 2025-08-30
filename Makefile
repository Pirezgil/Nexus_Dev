# Nexus ERP - Development Makefile
# This file provides shortcuts for common development tasks

.PHONY: help setup dev build clean logs health test

# Default target
help:
	@echo "Nexus ERP - Available Commands:"
	@echo ""
	@echo "  setup     - Copy environment file and setup project"
	@echo "  dev       - Start all services in development mode"
	@echo "  build     - Build all Docker images"
	@echo "  down      - Stop all services"
	@echo "  clean     - Stop services and remove volumes"
	@echo "  reset     - Full cleanup (containers, volumes, images)"
	@echo "  logs      - Show logs from all services"
	@echo "  health    - Check health of all services"
	@echo ""
	@echo "Module-specific logs:"
	@echo "  logs-user       - User Management module logs"
	@echo "  logs-crm        - CRM module logs" 
	@echo "  logs-services   - Services module logs"
	@echo "  logs-agendamento- Agendamento module logs"
	@echo "  logs-frontend   - Frontend application logs"
	@echo "  logs-db         - PostgreSQL database logs"
	@echo "  logs-redis      - Redis cache logs"
	@echo ""
	@echo "Database commands:"
	@echo "  db-migrate      - Run database migrations"
	@echo "  db-reset        - Reset database (destructive!)"
	@echo "  db-studio       - Open Prisma Studio"
	@echo ""

# Project setup
setup:
	@echo "Setting up Nexus ERP development environment..."
	@if [ ! -f .env ]; then cp .env.example .env && echo "✓ Created .env file"; else echo "✓ .env file already exists"; fi
	@echo "✓ Setup complete. Please edit .env file with your configuration."
	@echo "✓ Run 'make dev' to start all services."

# Development commands
dev:
	@echo "Starting Nexus ERP in development mode..."
	docker-compose up -d
	@echo "✓ All services started. Access:"
	@echo "  Frontend:     http://localhost:5000"
	@echo "  API Gateway:  http://localhost:5001"
	@echo "  User Mgmt:    http://localhost:5003"
	@echo "  CRM:          http://localhost:5004" 
	@echo "  Services:     http://localhost:5005"
	@echo "  Agendamento:  http://localhost:5007"

build:
	@echo "Building all Docker images..."
	docker-compose build

down:
	@echo "Stopping all services..."
	docker-compose down

clean:
	@echo "Cleaning up containers and volumes..."
	docker-compose down -v --remove-orphans

reset:
	@echo "Full cleanup - this will remove everything!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	docker-compose down -v --remove-orphans
	docker system prune -f

# Monitoring commands
logs:
	docker-compose logs -f

logs-user:
	docker-compose logs -f nexus-user-management

logs-crm:
	docker-compose logs -f nexus-crm

logs-services:
	docker-compose logs -f nexus-services

logs-agendamento:
	docker-compose logs -f nexus-agendamento

logs-frontend:
	docker-compose logs -f nexus-frontend

logs-gateway:
	docker-compose logs -f nexus-gateway

logs-db:
	docker-compose logs -f nexus-postgres

logs-redis:
	docker-compose logs -f nexus-redis

health:
	@echo "Checking service health..."
	docker-compose ps
	@echo ""
	@echo "Service endpoints:"
	@curl -s http://localhost:5001/health && echo " ✓ API Gateway" || echo " ✗ API Gateway"
	@curl -s http://localhost:5003/health && echo " ✓ User Management" || echo " ✗ User Management"
	@curl -s http://localhost:5004/health && echo " ✓ CRM" || echo " ✗ CRM"
	@curl -s http://localhost:5005/health && echo " ✓ Services" || echo " ✗ Services"
	@curl -s http://localhost:5007/health && echo " ✓ Agendamento" || echo " ✗ Agendamento"

# Database commands
db-migrate:
	@echo "Running database migrations..."
	docker-compose exec nexus-user-management npx prisma migrate dev

db-reset:
	@echo "Resetting database - this will delete all data!"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	docker-compose exec nexus-user-management npx prisma migrate reset

db-studio:
	@echo "Opening Prisma Studio..."
	@echo "Access at: http://localhost:5555"
	docker-compose exec nexus-user-management npx prisma studio

# Development helpers
install:
	@echo "Installing dependencies in all modules..."
	@for module in modules/*/; do \
		if [ -f "$$module/package.json" ]; then \
			echo "Installing $$module"; \
			(cd $$module && npm install); \
		fi \
	done
	@if [ -f "frontend/package.json" ]; then \
		echo "Installing frontend"; \
		(cd frontend && npm install); \
	fi

test:
	@echo "Running tests..."
	@echo "Tests will be implemented per module"

lint:
	@echo "Running linters..."
	@echo "Linting will be implemented per module"