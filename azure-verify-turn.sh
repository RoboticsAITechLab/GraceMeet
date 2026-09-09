#!/bin/bash
set -e

echo "=== 1. Restarting LiveKit to apply new turn_servers config ==="
cd /opt/gracemeet
docker compose restart livekit
sleep 3

echo "=== 2. Checking Docker containers status ==="
docker compose ps

echo "=== 3. Checking Coturn logs (last 30 lines) ==="
docker logs --tail 30 gracemeet-coturn-1

echo "=== 4. Checking LiveKit logs (last 30 lines) ==="
docker logs --tail 30 gracemeet-livekit-1

echo "=== 5. Checking listening ports for Coturn (3478) and LiveKit (7880, 7881) ==="
ss -tulpn | grep -E '3478|5349|7880|7881|49152' || netstat -tulpn | grep -E '3478|5349|7880|7881|49152'
