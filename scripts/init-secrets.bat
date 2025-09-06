@echo off
REM =====================================================================
REM Docker Secrets Initialization Script for Windows - ERP Nexus
REM =====================================================================
REM Windows batch version of the Docker Secrets initialization script
REM =====================================================================

setlocal enabledelayedexpansion

echo.
echo [94m🔐 Initializing Docker Secrets for ERP Nexus (Windows)[0m
echo [94mEnvironment: %NEXUS_ENV%[0m
echo.

REM Set default environment
if "%NEXUS_ENV%"=="" set NEXUS_ENV=development

REM Function to create Docker secret
:create_secret
set secret_name=%~1
set secret_value=%~2
set description=%~3

echo [93mProcessing secret: %secret_name%[0m

REM Check if secret exists and remove it
docker secret ls --format "{{.Name}}" | findstr /x "%secret_name%" >nul
if %errorlevel%==0 (
    echo [93m  Secret %secret_name% already exists. Removing old version...[0m
    docker secret rm "%secret_name%" >nul 2>&1
    if errorlevel 1 (
        echo [91m  Warning: Could not remove old secret %secret_name%. Creating versioned secret...[0m
        set "secret_name=%secret_name%_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
        set "secret_name=!secret_name: =0!"
    )
)

REM Create the secret
echo %secret_value%| docker secret create "%secret_name%" -
echo [92m  ✅ Secret %secret_name% created successfully[0m
echo [94m     Description: %description%[0m
echo.
goto :eof

echo [94m🔑 Generating secure credentials...[0m

REM Generate credentials based on environment
if "%NEXUS_ENV%"=="production" (
    REM Production: Generate secure random passwords (simplified for Windows)
    set "DB_PASSWORD=nexus_prod_%random%%random%"
    set "JWT_SECRET=prod_jwt_secret_%random%%random%%random%"
    set "HMAC_SECRET=prod_hmac_secret_%random%%random%%random%"
    set "WHATSAPP_ACCESS_TOKEN=prod_whatsapp_token_%random%%random%"
    set "WHATSAPP_APP_SECRET=prod_whatsapp_secret_%random%"
    set "WHATSAPP_WEBHOOK_TOKEN=prod_webhook_token_%random%"
    echo [92mGenerated secure production credentials[0m
) else (
    REM Development: Use predictable but secure credentials
    set "DB_PASSWORD=nexus_dev_%date:~-4,4%%date:~-10,2%%date:~-7,2%"
    set "JWT_SECRET=dev_jwt_secret_%random%%random%"
    set "HMAC_SECRET=dev_hmac_secret_%random%%random%"
    set "WHATSAPP_ACCESS_TOKEN=dev_whatsapp_token_%random%"
    set "WHATSAPP_APP_SECRET=dev_whatsapp_secret_%random%"
    set "WHATSAPP_WEBHOOK_TOKEN=dev_webhook_token_%random%"
    echo [93mGenerated development-friendly credentials[0m
)

echo.
echo [94m📦 Creating Docker Secrets...[0m
echo.

REM Database secrets
call :create_secret "nexus_db_name" "nexus_erp" "PostgreSQL database name"
call :create_secret "nexus_db_user" "nexus_user" "PostgreSQL database user"
call :create_secret "nexus_db_password" "%DB_PASSWORD%" "PostgreSQL database password"

REM Application secrets
call :create_secret "nexus_jwt_secret" "%JWT_SECRET%" "JWT signing secret for authentication"
call :create_secret "nexus_hmac_secret" "%HMAC_SECRET%" "HMAC secret for secure service communication"

REM WhatsApp API secrets
call :create_secret "nexus_whatsapp_phone_id" "your-phone-number-id-here" "WhatsApp Business Phone Number ID"
call :create_secret "nexus_whatsapp_access_token" "%WHATSAPP_ACCESS_TOKEN%" "WhatsApp Business Access Token"
call :create_secret "nexus_whatsapp_app_secret" "%WHATSAPP_APP_SECRET%" "WhatsApp Business App Secret"
call :create_secret "nexus_whatsapp_webhook_token" "%WHATSAPP_WEBHOOK_TOKEN%" "WhatsApp Webhook Verification Token"

REM Redis and Database URLs
if "%NEXUS_ENV%"=="production" (
    set "REDIS_PASSWORD=redis_prod_%random%%random%"
    call :create_secret "nexus_redis_password" "!REDIS_PASSWORD!" "Redis authentication password"
    call :create_secret "nexus_redis_url" "redis://:!REDIS_PASSWORD!@redis:6379" "Redis connection URL with authentication"
    call :create_secret "nexus_database_url" "postgresql://nexus_user:%DB_PASSWORD%@postgres:5432/nexus_erp?sslmode=require" "Complete PostgreSQL connection URL"
) else (
    call :create_secret "nexus_redis_url" "redis://redis:6379" "Redis connection URL (development - no auth)"
    call :create_secret "nexus_database_url" "postgresql://nexus_user:%DB_PASSWORD%@postgres:5432/nexus_erp" "Complete PostgreSQL connection URL"
)

echo [92m🎉 All Docker Secrets have been created successfully![0m
echo.

REM List created secrets
echo [94m📋 Created secrets summary:[0m
docker secret ls --filter name=nexus_ --format "table {{.Name}}\t{{.CreatedAt}}"

echo.
echo [93m⚠️  IMPORTANT NOTES:[0m
echo [93m   • Secrets are stored securely in Docker's encrypted storage[0m
echo [93m   • In development, credentials are predictable for convenience[0m
echo [93m   • In production, credentials are randomly generated[0m
echo [93m   • Update docker-compose.yml to use these secrets[0m

if "%NEXUS_ENV%"=="development" (
    echo.
    echo [94m🔍 Development Database Credentials:[0m
    echo [94m   Host: localhost:5433[0m
    echo [94m   Database: nexus_erp[0m
    echo [94m   Username: nexus_user[0m
    echo [94m   Password: %DB_PASSWORD%[0m
    echo.
    echo [93m💡 You can connect to the database using these credentials for debugging[0m
)

echo.
echo [92m✅ Docker Secrets initialization completed![0m
pause