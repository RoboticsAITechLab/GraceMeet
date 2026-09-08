#!/bin/bash
set -e

echo "=== GraceMeet LiveKit SFU Setup on Azure Ubuntu VM ==="

# 1. Update system packages
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Docker & Docker Compose plugin
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw

sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 3. Configure VM Firewall (UFW)
echo "Configuring firewall ports..."
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # HTTP (Cert challenge)
sudo ufw allow 443/tcp         # HTTPS / WSS (Secure WebSocket)
sudo ufw allow 7880/tcp        # LiveKit Signaling
sudo ufw allow 7881/tcp        # LiveKit RTC TCP Fallback
sudo ufw allow 7882/udp        # LiveKit Primary RTC UDP
sudo ufw allow 50000:60000/udp # LiveKit WebRTC Media UDP Range
sudo ufw --force enable

echo "=== Setup complete! ==="
echo "To start LiveKit and Caddy, run:"
echo "  sudo docker compose up -d"
