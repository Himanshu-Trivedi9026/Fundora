#!/bin/sh
# Fundora — Health Check Script
# Used by Docker HEALTHCHECK and Kubernetes liveness/readiness probes

set -e

# Configuration
BASE_URL="${HEALTH_CHECK_URL:-http://localhost:3000}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-5}"

# Check 1: Application responds on HTTP
check_http() {
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
  if [ "${status}" = "200" ] || [ "${status}" = "204" ]; then
    return 0
  fi
  return 1
}

# Check 2: Database connectivity via API
check_database() {
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" "${BASE_URL}/api/health/database" 2>/dev/null || echo "000")
  if [ "${status}" = "200" ]; then
    return 0
  fi
  return 1
}

# Check 3: Memory usage
check_memory() {
  total=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
  available=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "0")
  if [ "${total}" -gt 0 ] && [ "${available}" -gt 0 ]; then
    usage_percent=$(( (total - available) * 100 / total ))
    if [ "${usage_percent}" -lt 95 ]; then
      return 0
    fi
  fi
  return 1
}

# Run all checks
check_http || exit 1
check_database || exit 1
check_memory || exit 1

exit 0
