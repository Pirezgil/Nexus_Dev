#!/bin/bash

# Test script to validate authentication fixes
echo "🧪 Testing Authentication Fixes - ERP Nexus"
echo "============================================"

API_GATEWAY="http://localhost:5001"

echo
echo "1. Testing API Gateway availability..."
response=$(curl -s -o /dev/null -w "%{http_code}" $API_GATEWAY/ping)
if [ "$response" -eq 200 ]; then
    echo "✅ API Gateway is running"
else
    echo "❌ API Gateway not available (HTTP $response)"
    exit 1
fi

echo
echo "2. Testing endpoints accessibility without auth..."
echo -n "   /api/services: "
response=$(curl -s $API_GATEWAY/api/services | jq -r '.code // "unknown"')
if [ "$response" = "MISSING_AUTH_HEADER" ]; then
    echo "✅ Correctly requires authentication"
else
    echo "❌ Unexpected response: $response"
fi

echo -n "   /api/professionals: "
response=$(curl -s $API_GATEWAY/api/professionals | jq -r '.code // "unknown"')
if [ "$response" = "MISSING_AUTH_HEADER" ]; then
    echo "✅ Correctly requires authentication"
else
    echo "❌ Unexpected response: $response"
fi

echo
echo "3. Testing login functionality..."
login_response=$(curl -s -X POST $API_GATEWAY/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@example.com", "password": "admin123"}')

echo "Login response: $login_response"

access_token=$(echo "$login_response" | jq -r '.data.tokens.accessToken // empty')
refresh_token=$(echo "$login_response" | jq -r '.data.tokens.refreshToken // empty')

if [ -n "$access_token" ] && [ -n "$refresh_token" ]; then
    echo "✅ Login successful - tokens received"
    
    echo
    echo "4. Testing authenticated endpoints..."
    
    echo -n "   /api/services with auth: "
    auth_response=$(curl -s $API_GATEWAY/api/services \
        -H "Authorization: Bearer $access_token" | jq -r '.success // false')
    if [ "$auth_response" = "true" ]; then
        echo "✅ Services endpoint working"
    else
        echo "❌ Services endpoint failed"
    fi
    
    echo -n "   /api/professionals with auth: "
    prof_response=$(curl -s $API_GATEWAY/api/professionals \
        -H "Authorization: Bearer $access_token" | jq -r '.success // false')
    if [ "$prof_response" = "true" ]; then
        echo "✅ Professionals endpoint working"
    else
        echo "❌ Professionals endpoint failed"
    fi
    
    echo
    echo "5. Testing token refresh..."
    refresh_response=$(curl -s -X POST $API_GATEWAY/api/auth/refresh \
        -H "Content-Type: application/json" \
        -d "{\"refreshToken\": \"$refresh_token\"}")
    
    new_access_token=$(echo "$refresh_response" | jq -r '.data.accessToken // empty')
    new_refresh_token=$(echo "$refresh_response" | jq -r '.data.refreshToken // empty')
    
    if [ -n "$new_access_token" ] && [ -n "$new_refresh_token" ]; then
        echo "✅ Token refresh working - both tokens returned"
    elif [ -n "$new_access_token" ]; then
        echo "⚠️  Token refresh partial - only access token returned"
    else
        echo "❌ Token refresh failed"
        echo "Refresh response: $refresh_response"
    fi
    
else
    echo "❌ Login failed - no tokens received"
    echo "Login response: $login_response"
fi

echo
echo "============================================"
echo "🏁 Authentication tests completed!"