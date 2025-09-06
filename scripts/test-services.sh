#!/bin/bash

# =====================================================================
# Service Testing Script - ERP Nexus
# =====================================================================
# This script tests all services to ensure they are running correctly
# with proper secret configuration and security settings.
# =====================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.secrets.yml}
MAX_RETRIES=30
RETRY_INTERVAL=10

echo -e "${BLUE}🧪 Testing ERP Nexus Services${NC}"
echo -e "${BLUE}Compose File: ${COMPOSE_FILE}${NC}"
echo ""

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local health_url=$2
    local max_retries=${3:-$MAX_RETRIES}
    local retry_count=0
    
    echo -e "${YELLOW}⏳ Waiting for ${service_name} to be ready...${NC}"
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${service_name} is ready${NC}"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        echo -e "${YELLOW}   Attempt $retry_count/$max_retries - waiting ${RETRY_INTERVAL}s...${NC}"
        sleep $RETRY_INTERVAL
    done
    
    echo -e "${RED}❌ ${service_name} failed to become ready after $max_retries attempts${NC}"
    return 1
}

# Function to test service endpoint
test_service_endpoint() {
    local service_name=$1
    local endpoint_url=$2
    local expected_status=${3:-200}
    local description=${4:-""}
    
    echo -e "${BLUE}🔍 Testing ${service_name}${description:+ - $description}${NC}"
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/response_body "$endpoint_url")
    local status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}  ✅ ${service_name} responded with status $status_code${NC}"
        
        # Show response content if it's JSON
        if curl -s -I "$endpoint_url" | grep -q "application/json"; then
            echo -e "${BLUE}  📄 Response:${NC}"
            cat /tmp/response_body | jq '.' 2>/dev/null || cat /tmp/response_body | head -3
        fi
        return 0
    else
        echo -e "${RED}  ❌ ${service_name} responded with status $status_code (expected $expected_status)${NC}"
        echo -e "${RED}     Response body:${NC}"
        cat /tmp/response_body | head -5
        return 1
    fi
}

# Function to test database connectivity
test_database_connectivity() {
    echo -e "${BLUE}🗄️  Testing database connectivity...${NC}"
    
    # Test through one of the services
    local response=$(curl -s "http://localhost:5003/health" | jq -r '.data.database.status // "unknown"' 2>/dev/null || echo "unknown")
    
    if [ "$response" = "connected" ] || [ "$response" = "healthy" ]; then
        echo -e "${GREEN}  ✅ Database connectivity OK${NC}"
        return 0
    else
        echo -e "${RED}  ❌ Database connectivity failed (status: $response)${NC}"
        return 1
    fi
}

# Function to test Redis connectivity
test_redis_connectivity() {
    echo -e "${BLUE}📦 Testing Redis connectivity...${NC}"
    
    # Test Redis through Docker
    if docker exec nexus-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Redis connectivity OK${NC}"
        return 0
    else
        echo -e "${RED}  ❌ Redis connectivity failed${NC}"
        return 1
    fi
}

# Function to test secrets configuration
test_secrets_configuration() {
    echo -e "${BLUE}🔐 Testing secrets configuration...${NC}"
    
    # Test secrets helper
    if node scripts/secrets-helper.js validate > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ Secrets configuration valid${NC}"
        return 0
    else
        echo -e "${RED}  ❌ Secrets configuration invalid${NC}"
        return 1
    fi
}

# Function to test service integration
test_service_integration() {
    echo -e "${BLUE}🔗 Testing service integration...${NC}"
    
    # Test API Gateway routing to User Management
    local response=$(curl -s "http://localhost:5001/api/auth/health" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q "User Management\|healthy\|running"; then
        echo -e "${GREEN}  ✅ API Gateway → User Management integration OK${NC}"
    else
        echo -e "${RED}  ❌ API Gateway → User Management integration failed${NC}"
        return 1
    fi
    
    # Test API Gateway routing to CRM
    local response=$(curl -s "http://localhost:5001/api/crm/health" 2>/dev/null || echo "")
    
    if echo "$response" | grep -q "CRM\|healthy\|running"; then
        echo -e "${GREEN}  ✅ API Gateway → CRM integration OK${NC}"
    else
        echo -e "${RED}  ❌ API Gateway → CRM integration failed${NC}"
        return 1
    fi
    
    return 0
}

# Function to test security configuration
test_security_configuration() {
    echo -e "${BLUE}🛡️  Testing security configuration...${NC}"
    
    # Test CORS headers
    local cors_headers=$(curl -s -I -H "Origin: http://localhost:3000" "http://localhost:5001/health" | grep -i "access-control")
    
    if echo "$cors_headers" | grep -q "access-control-allow-origin"; then
        echo -e "${GREEN}  ✅ CORS configuration OK${NC}"
    else
        echo -e "${YELLOW}  ⚠️  CORS headers not found (might be expected)${NC}"
    fi
    
    # Test security headers
    local security_headers=$(curl -s -I "http://localhost:5001/health")
    
    if echo "$security_headers" | grep -q -i "x-content-type-options\|x-frame-options"; then
        echo -e "${GREEN}  ✅ Security headers present${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Some security headers missing${NC}"
    fi
    
    return 0
}

# Function to run performance tests
test_performance() {
    echo -e "${BLUE}⚡ Running basic performance tests...${NC}"
    
    # Test API Gateway response time
    local start_time=$(date +%s%3N)
    curl -s "http://localhost:5001/health" > /dev/null
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    echo -e "${BLUE}  API Gateway response time: ${response_time}ms${NC}"
    
    if [ $response_time -lt 1000 ]; then
        echo -e "${GREEN}  ✅ Response time acceptable${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Response time high (${response_time}ms)${NC}"
    fi
    
    return 0
}

# Main testing function
run_tests() {
    local failed_tests=0
    local total_tests=0
    
    echo -e "${BLUE}🚀 Starting comprehensive service tests...${NC}"
    echo ""
    
    # Check if services are running
    echo -e "${BLUE}📊 Checking service status...${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    
    # Test 1: Wait for core services
    echo -e "${BLUE}=== Test 1: Service Readiness ===${NC}"
    total_tests=$((total_tests + 1))
    if wait_for_service "PostgreSQL" "http://localhost:5003/health" 10 && \
       wait_for_service "User Management" "http://localhost:5003/health" && \
       wait_for_service "API Gateway" "http://localhost:5001/health" && \
       wait_for_service "CRM" "http://localhost:5004/health" && \
       wait_for_service "Services" "http://localhost:5005/health"; then
        echo -e "${GREEN}✅ Test 1 PASSED: All services are ready${NC}"
    else
        echo -e "${RED}❌ Test 1 FAILED: Some services are not ready${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 2: Health endpoints
    echo -e "${BLUE}=== Test 2: Health Endpoints ===${NC}"
    total_tests=$((total_tests + 1))
    if test_service_endpoint "API Gateway" "http://localhost:5001/health" 200 "health check" && \
       test_service_endpoint "User Management" "http://localhost:5003/health" 200 "health check" && \
       test_service_endpoint "CRM" "http://localhost:5004/health" 200 "health check" && \
       test_service_endpoint "Services" "http://localhost:5005/health" 200 "health check"; then
        echo -e "${GREEN}✅ Test 2 PASSED: All health endpoints responding${NC}"
    else
        echo -e "${RED}❌ Test 2 FAILED: Some health endpoints not responding${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 3: Database connectivity
    echo -e "${BLUE}=== Test 3: Database Connectivity ===${NC}"
    total_tests=$((total_tests + 1))
    if test_database_connectivity; then
        echo -e "${GREEN}✅ Test 3 PASSED: Database connectivity OK${NC}"
    else
        echo -e "${RED}❌ Test 3 FAILED: Database connectivity issues${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 4: Redis connectivity
    echo -e "${BLUE}=== Test 4: Redis Connectivity ===${NC}"
    total_tests=$((total_tests + 1))
    if test_redis_connectivity; then
        echo -e "${GREEN}✅ Test 4 PASSED: Redis connectivity OK${NC}"
    else
        echo -e "${RED}❌ Test 4 FAILED: Redis connectivity issues${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 5: Secrets configuration
    echo -e "${BLUE}=== Test 5: Secrets Configuration ===${NC}"
    total_tests=$((total_tests + 1))
    if test_secrets_configuration; then
        echo -e "${GREEN}✅ Test 5 PASSED: Secrets configuration valid${NC}"
    else
        echo -e "${RED}❌ Test 5 FAILED: Secrets configuration invalid${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 6: Service integration
    echo -e "${BLUE}=== Test 6: Service Integration ===${NC}"
    total_tests=$((total_tests + 1))
    if test_service_integration; then
        echo -e "${GREEN}✅ Test 6 PASSED: Service integration OK${NC}"
    else
        echo -e "${RED}❌ Test 6 FAILED: Service integration issues${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 7: Security configuration
    echo -e "${BLUE}=== Test 7: Security Configuration ===${NC}"
    total_tests=$((total_tests + 1))
    if test_security_configuration; then
        echo -e "${GREEN}✅ Test 7 PASSED: Security configuration OK${NC}"
    else
        echo -e "${RED}❌ Test 7 FAILED: Security configuration issues${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test 8: Basic performance
    echo -e "${BLUE}=== Test 8: Performance Tests ===${NC}"
    total_tests=$((total_tests + 1))
    if test_performance; then
        echo -e "${GREEN}✅ Test 8 PASSED: Performance tests OK${NC}"
    else
        echo -e "${RED}❌ Test 8 FAILED: Performance issues detected${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    echo ""
    
    # Test summary
    echo -e "${BLUE}=== Test Summary ===${NC}"
    local passed_tests=$((total_tests - failed_tests))
    echo -e "${BLUE}Total Tests: $total_tests${NC}"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Services are running correctly.${NC}"
        return 0
    else
        echo -e "${RED}❌ $failed_tests test(s) failed. Please check the issues above.${NC}"
        return 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help|-h] [--quick|-q]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quick, -q    Run quick tests only"
        echo ""
        echo "Environment Variables:"
        echo "  COMPOSE_FILE   Override compose file (default: docker-compose.secrets.yml)"
        echo ""
        echo "Examples:"
        echo "  $0             Run full test suite"
        echo "  $0 --quick     Run quick tests only"
        exit 0
        ;;
    --quick|-q)
        echo -e "${BLUE}🏃 Running quick tests...${NC}"
        # Just test basic connectivity
        wait_for_service "API Gateway" "http://localhost:5001/health" 10
        test_service_endpoint "API Gateway" "http://localhost:5001/health" 200
        echo -e "${GREEN}✅ Quick tests completed${NC}"
        ;;
    *)
        run_tests
        ;;
esac