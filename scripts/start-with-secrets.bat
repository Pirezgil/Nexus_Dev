@echo off
REM =====================================================================
REM Start Services with Docker Secrets - Windows Version - ERP Nexus
REM =====================================================================
REM Windows batch version of the startup script with Docker Secrets
REM =====================================================================

setlocal enabledelayedexpansion

REM Set default environment
if "%NEXUS_ENV%"=="" set NEXUS_ENV=development
if "%COMPOSE_FILE%"=="" set COMPOSE_FILE=docker-compose.secrets.yml

echo.
echo [94m🚀 Starting ERP Nexus with Docker Secrets[0m
echo [94mEnvironment: %NEXUS_ENV%[0m
echo [94mCompose File: %COMPOSE_FILE%[0m
echo.

REM Function to check if Docker is running
echo [94m🔍 Pre-flight checks...[0m
docker info >nul 2>&1
if errorlevel 1 (
    echo [91m❌ Docker is not running. Please start Docker and try again.[0m
    exit /b 1
)
echo [92m✅ Docker is running[0m

REM Check if Docker Swarm is initialized
docker node ls >nul 2>&1
if errorlevel 1 (
    echo [93m⚠️  Docker Swarm not initialized. Initializing...[0m
    docker swarm init --advertise-addr 127.0.0.1 >nul 2>&1
    echo [92m✅ Docker Swarm initialized[0m
) else (
    echo [92m✅ Docker Swarm is active[0m
)

REM Check if required secrets exist
echo [94m🔐 Checking required secrets...[0m
set "SECRETS_OK=1"

docker secret ls --format "{{.Name}}" | findstr /x "nexus_database_url" >nul
if errorlevel 1 set "SECRETS_OK=0"

docker secret ls --format "{{.Name}}" | findstr /x "nexus_jwt_secret" >nul
if errorlevel 1 set "SECRETS_OK=0"

docker secret ls --format "{{.Name}}" | findstr /x "nexus_hmac_secret" >nul
if errorlevel 1 set "SECRETS_OK=0"

if "%SECRETS_OK%"=="0" (
    echo [91m❌ Missing required secrets[0m
    echo [93m💡 Run 'scripts\init-secrets.bat' to create secrets[0m
    exit /b 1
)
echo [92m✅ All required secrets are available[0m

REM Check if compose file exists
if not exist "%COMPOSE_FILE%" (
    echo [91m❌ Compose file not found: %COMPOSE_FILE%[0m
    exit /b 1
)

echo.
echo [94m🚀 Starting services...[0m
docker compose -f "%COMPOSE_FILE%" up -d

if errorlevel 1 (
    echo [91m❌ Failed to start services[0m
    exit /b 1
)

echo.
echo [94m⏳ Waiting for services to be ready...[0m
timeout /t 10 /nobreak >nul

echo.
echo [94m📊 Service Status:[0m
docker compose -f "%COMPOSE_FILE%" ps

echo.
echo [94m🔍 Health Check Summary:[0m

REM Check each service
set "services=nexus-postgres nexus-redis nexus-user-management nexus-crm nexus-services nexus-agendamento nexus-api-gateway nexus-nginx"

for %%s in (%services%) do (
    docker ps --filter "name=%%s" --filter "status=running" | findstr "%%s" >nul
    if not errorlevel 1 (
        echo [92m  ✅ %%s - Running[0m
    ) else (
        echo [91m  ❌ %%s - Not Running[0m
    )
)

echo.
echo [94m🌐 Access Information:[0m
echo [92m  Frontend: http://localhost:5000[0m
echo [92m  API Gateway: http://localhost:5001[0m
echo [92m  User Management: http://localhost:5003[0m
echo [92m  CRM Module: http://localhost:5004[0m
echo [92m  Services Module: http://localhost:5005[0m
echo [92m  Agendamento Module: http://localhost:5008[0m

if "%NEXUS_ENV%"=="development" (
    echo.
    echo [94m🔍 Development Database Access:[0m
    echo [92m  PostgreSQL: localhost:5433[0m
    echo [92m  Redis: localhost:6379[0m
    echo [93m  Use 'node scripts\secrets-helper.js config' to see credentials[0m
)

echo.
echo [92m🎉 ERP Nexus started successfully![0m
echo [93m💡 Use 'docker compose -f %COMPOSE_FILE% logs -f' to view logs[0m
echo [93m💡 Use 'docker compose -f %COMPOSE_FILE% down' to stop services[0m

REM Handle command line arguments
if "%1"=="--logs" goto :show_logs
if "%1"=="-l" goto :show_logs
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help

goto :end

:show_logs
echo.
echo [94m📝 Following service logs (Ctrl+C to stop):[0m
docker compose -f "%COMPOSE_FILE%" logs -f
goto :end

:show_help
echo Usage: %0 [--logs^|-l] [--help^|-h]
echo.
echo Options:
echo   --logs, -l    Follow service logs after startup
echo   --help, -h    Show this help message
echo.
echo Environment Variables:
echo   NEXUS_ENV          Set environment (development^|production)
echo   COMPOSE_FILE       Override compose file (default: docker-compose.secrets.yml)
echo.
echo Examples:
echo   %0                 Start services
echo   %0 --logs          Start services and follow logs
echo   set NEXUS_ENV=production ^& %0    Start in production mode
goto :end

:end
echo.
pause