#!/bin/bash
set -e

echo "=== 1. Writing Coturn configuration with external-ip mapping ==="
cat << 'EOF' > /opt/gracemeet/turnserver.conf
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=49252
listening-ip=10.0.0.4
listening-ip=127.0.0.1
external-ip=20.198.93.222/10.0.0.4
relay-ip=10.0.0.4
realm=gracemeet-sfu-46131.centralindia.cloudapp.azure.com
fingerprint
lt-cred-mech
user=gracemeet:4c3ee17b380bca6bb602772f99e6db22
no-cli
no-tls
log-file=stdout
verbose
EOF

echo "=== 2. Writing LiveKit configuration with Coturn TURN ==="
cat << 'EOF' > /opt/gracemeet/livekit.yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: false
  node_ip: 20.198.93.222
  turn_servers:
    - host: gracemeet-sfu-46131.centralindia.cloudapp.azure.com
      port: 3478
      protocol: tcp
      username: gracemeet
      credential: 4c3ee17b380bca6bb602772f99e6db22
    - host: gracemeet-sfu-46131.centralindia.cloudapp.azure.com
      port: 3478
      protocol: udp
      username: gracemeet
      credential: 4c3ee17b380bca6bb602772f99e6db22

keys:
  devkey: secret

logging:
  level: info
EOF

cd /opt/gracemeet
docker compose restart coturn
docker compose restart livekit
sleep 3
docker compose ps
echo "=== Coturn external IP mapping updated successfully ==="
