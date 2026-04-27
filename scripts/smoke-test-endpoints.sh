#!/bin/bash
# scripts/smoke-test-endpoints.sh
# Test all API endpoints

BASE_URL=${1:-http://localhost:5000}
PASS=0
FAIL=0

check() {
  local name=$1
  local url=$2
  local expected=${3:-200}
  
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$status" = "$expected" ]; then
    echo "✅ $name ($status)"
    PASS=$((PASS+1))
  else
    echo "❌ $name (expected $expected, got $status)"
    FAIL=$((FAIL+1))
  fi
}

echo "🔍 MoonShotForge Endpoint Smoke Tests"
echo "Base URL: $BASE_URL"
echo ""

check "GET /health" "$BASE_URL/health"
check "GET /api/health" "$BASE_URL/api/health"
check "GET /api/status" "$BASE_URL/api/status"
check "GET /api/signals" "$BASE_URL/api/signals"
check "GET /api/positions" "$BASE_URL/api/positions"
check "GET /api/paper" "$BASE_URL/api/paper"
check "GET /" "$BASE_URL/"
check "GET /landing.html" "$BASE_URL/landing.html"
check "GET /wallet-connect.html" "$BASE_URL/wallet-connect.html"
check "GET /debug.html" "$BASE_URL/debug.html"
check "GET /debug/status" "$BASE_URL/debug/status"
check "GET /admin/login" "$BASE_URL/admin/login"
check "POST /api/admin/login (no password)" "$BASE_URL/api/admin/login" "401"

echo ""
echo "📊 Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && exit 0 || exit 1
