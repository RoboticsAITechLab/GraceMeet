#!/bin/bash
set -ex

echo "=== 1. Installing Docker ==="
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "=== 2. Setting up GraceMeet directory and configs ==="
mkdir -p /opt/gracemeet
cd /opt/gracemeet

cat << 'EOF' > /opt/gracemeet/livekit.yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true

keys:
  devkey: secret

logging:
  level: info
EOF

cat << 'EOF' > /opt/gracemeet/Caddyfile
gracemeet-sfu-46131.centralindia.cloudapp.azure.com {
  reverse_proxy 127.0.0.1:7880
}
EOF

cat << 'EOF' > /opt/gracemeet/docker-compose.yml
services:
  livekit:
    image: livekit/livekit-server:v1.8.0
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - /opt/gracemeet/livekit.yaml:/etc/livekit.yaml:ro
    command: --config /etc/livekit.yaml

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - /opt/gracemeet/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
EOF

echo "=== 3. Starting Services with Docker Compose ==="
cd /opt/gracemeet
docker compose pull
docker compose up -d

echo "=== 4. Verifying Containers ==="
sleep 5
docker compose ps

echo "=== LiveKit & Caddy deployment complete! ==="
