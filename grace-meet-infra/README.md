# ☁️ GraceMeet LiveKit SFU Deployment Guide on Microsoft Azure

This guide explains how to deploy the **GraceMeet LiveKit SFU Media Server** on an **Azure Ubuntu Virtual Machine** with full WebRTC UDP performance and automatic SSL/TLS certificates.

---

## 1. Create an Azure Virtual Machine

In the [Azure Portal](https://portal.azure.com):

1. Go to **Virtual Machines** -> **Create** -> **Azure virtual machine**.
2. **Resource Group**: `gracemeet-rg` (or existing).
3. **Image**: `Ubuntu Server 22.04 LTS` or `24.04 LTS - x64 Gen2`.
4. **Size**:
   - For testing / small church groups (up to 50 participants): `Standard_B2s` (2 vCPUs, 4 GiB RAM)
   - For 100+ concurrent participants: `Standard_D2s_v5` or `Standard_D4s_v5`.
5. **Authentication**: SSH Public Key.
6. Under **Networking**:
   - Ensure a **Public IP** is assigned.
   - Configure a **DNS name label** under the Public IP resource (e.g., `gracemeet-sfu.eastus.cloudapp.azure.com`).

---

## 2. Configure Azure Network Security Group (NSG) Inbound Rules

In the Azure Portal, open your VM's **Network Security Group** and add the following **Inbound Security Rules**:

| Priority | Name | Port(s) | Protocol | Destination | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100** | `SSH` | `22` | TCP | Any | Remote SSH Access |
| **110** | `HTTP` | `80` | TCP | Any | Let's Encrypt SSL Validation |
| **120** | `HTTPS_WSS` | `443` | TCP | Any | Secure HTTPS & WSS Signaling |
| **130** | `LiveKit_Signaling` | `7880` | TCP | Any | Direct LiveKit Signaling |
| **140** | `LiveKit_RTC_TCP` | `7881` | TCP | Any | WebRTC TCP Fallback |
| **150** | `LiveKit_RTC_UDP` | `7882` | UDP | Any | Primary WebRTC UDP Media Stream |
| **160** | `LiveKit_UDP_Range` | `50000-60000` | UDP | Any | WebRTC Media UDP Stream Range |

> **⚠️ Critical:** Make sure the **UDP rules** (7882 and 50000-60000) are explicitly set to `UDP` or `Any`. Without UDP, WebRTC video/audio cannot stream in real-time.

---

## 3. Deploy LiveKit on the Azure VM

SSH into your Azure VM:

```bash
ssh azureuser@<YOUR_AZURE_PUBLIC_IP_OR_DNS>
```

Clone the GraceMeet repository:

```bash
git clone --recurse-submodules https://github.com/RoboticsAITechLab/GraceMeet.git
cd GraceMeet/grace-meet-infra
```

Run the automated setup script:

```bash
chmod +x azure-setup.sh
./azure-setup.sh
```

Configure your domain name in `.env` (or export it):

```bash
echo "LIVEKIT_DOMAIN=gracemeet-sfu.eastus.cloudapp.azure.com" > .env
```

Start LiveKit and Caddy:

```bash
sudo docker compose up -d
```

Verify everything is running:

```bash
sudo docker compose logs -f
```

---

## 4. Connect Vercel to Your Azure LiveKit Server

Once your Azure server is running, go to your **Vercel Dashboard**:

1. Open **grace-meet-web** project on Vercel.
2. Navigate to **Settings** -> **Environment Variables**.
3. Add the following variables:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `LIVEKIT_URL` | `wss://<YOUR_AZURE_DOMAIN>` | Example: `wss://gracemeet-sfu.eastus.cloudapp.azure.com` |
| `LIVEKIT_API_KEY` | `devkey` | (Or custom key defined in `livekit.yaml`) |
| `LIVEKIT_API_SECRET` | `secret` | (Or custom secret defined in `livekit.yaml`) |

4. Trigger a **Redeploy** on Vercel.

Your GraceMeet video meeting platform is now fully deployed and functional worldwide with production-grade WebRTC!
