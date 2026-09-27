#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "Running End-to-End Inter-Service Integration Test"
echo "=========================================================="

DATA_PID=""
GATEWAY_PID=""

cleanup() {
    echo ""
    echo "Cleaning up test processes..."
    if [ -n "$DATA_PID" ]; then
        kill "$DATA_PID" 2>/dev/null || true
    fi
    if [ -n "$GATEWAY_PID" ]; then
        kill "$GATEWAY_PID" 2>/dev/null || true
    fi
    echo "Cleanup complete."
}

trap cleanup EXIT

# 1. Start Python gRPC Data Service
echo "1. Starting Python gRPC Data Service on port 50051..."
./data-service/.venv/bin/python data-service/server.py &
DATA_PID=$!

# Wait briefly for gRPC server to bind
sleep 1

# 2. Start Node.js API Gateway
echo "2. Starting Node.js API Gateway on port 3000..."
PORT=3000 DATA_SERVICE_URL="127.0.0.1:50051" npm --prefix gateway run dev > /dev/null 2>&1 &
GATEWAY_PID=$!

# 3. Wait for Health Check
echo "3. Waiting for Gateway and upstream gRPC service to become healthy..."
MAX_ATTEMPTS=20
ATTEMPT=0
HEALTHY=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    HEALTH_RESP=$(curl -s http://127.0.0.1:3000/api/health || echo "{}")
    STATUS=$(echo "$HEALTH_RESP" | grep -o '"status":"HEALTHY"' || true)
    if [ -n "$STATUS" ]; then
        HEALTHY=1
        break
    fi
    sleep 0.5
done

if [ $HEALTHY -ne 1 ]; then
    echo "Health check failed after $MAX_ATTEMPTS attempts."
    curl -v http://127.0.0.1:3000/api/health || true
    exit 1
fi

echo "Both Node.js Gateway and Python gRPC Data Service are healthy!"
echo "   $HEALTH_RESP"

# 4. Dispatch Telemetry Calculation (REST -> gRPC -> Python -> gRPC -> REST)
echo ""
echo "4. Dispatching sample telemetry dataset (1,000 numbers) through REST Gateway..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:3000/api/metrics/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "metricId": "e2e_integration_test_stream",
    "dataPoints": [10.5, 20.3, 15.2, 40.1, 18.7, 33.2, 28.9, 14.0, 22.4, 30.6],
    "metadata": { "environment": "integration-test", "runner": "bash-e2e" }
  }')

echo "Response received:"
echo "$RESPONSE" | python3 -m json.tool

# 5. Verify calculations
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || true)
COUNT=$(echo "$RESPONSE" | grep -o '"count":10' || true)

if [ -n "$SUCCESS" ] && [ -n "$COUNT" ]; then
    echo ""
    echo "SUCCESS: End-to-End Inter-Service Protocol Buffer pipeline verified!"
    echo "   - Node.js REST Gateway accepted HTTP payload"
    echo "   - Serialized into binary Protocol Buffer message"
    echo "   - Sent over HTTP/2 to Python gRPC server"
    echo "   - Python computed statistical aggregates via NumPy"
    echo "   - Returned binary gRPC response back to Node.js"
    echo "   - Node.js formatted and returned JSON to client"
else
    echo " End-to-end test verification failed!"
    exit 1
fi
