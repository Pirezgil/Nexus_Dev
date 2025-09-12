@echo off
echo ===========================================
echo CORS ERROR DIAGNOSIS - ERP NEXUS
echo ===========================================
echo.

echo 1. Testing API Gateway connectivity...
curl -I http://localhost:5001/health 2>nul && echo "   ✓ API Gateway responding" || echo "   ✗ API Gateway not accessible"

echo.
echo 2. Testing API Gateway /ping endpoint...
curl -s -X GET "http://localhost:5001/ping" 2>nul && echo "   ✓ Ping endpoint working" || echo "   ✗ Ping endpoint failed"

echo.
echo 3. Testing CORS preflight for CRM customers...
curl -I -X OPTIONS "http://localhost:5001/api/crm/customers" -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Content-Type,Authorization" 2>nul && echo "   ✓ CORS preflight working" || echo "   ✗ CORS preflight failed"

echo.
echo 4. Testing CRM customers GET request...
curl -I -X GET "http://localhost:5001/api/crm/customers" -H "Origin: http://localhost:3000" -H "Authorization: Bearer test-token" 2>nul && echo "   ✓ CRM GET request working" || echo "   ✗ CRM GET request failed"

echo.
echo 5. Checking port availability...
netstat -an | findstr ":5001" >nul && echo "   ✓ Port 5001 is listening" || echo "   ✗ Port 5001 not available"
netstat -an | findstr ":3000" >nul && echo "   ✓ Port 3000 is listening" || echo "   ✗ Port 3000 not available"

echo.
echo 6. Testing Docker containers (if running)...
docker ps --format "table {{.Names}}\t{{.Status}}" 2>nul || echo "   Docker not running or not accessible"

echo.
echo ===========================================
echo TEST COMPLETED
echo ===========================================
echo.
echo If API Gateway is not responding:
echo   1. Run: npm run dev:gateway
echo   2. Or: docker-compose up api-gateway
echo.
echo If CORS is failing:
echo   1. Check API Gateway CORS configuration
echo   2. Verify frontend origin configuration
echo   3. Check nginx proxy settings
echo.
pause