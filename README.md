# ✝ GraceMeet

**GraceMeet** is a modern, open-source, church-focused video meeting platform designed as a self-hosted alternative to commercial conferencing tools for church congregations, prayer cells, and Bible study groups.

> **Meet. Pray. Learn. Fellowship.**

---

## 🌟 Key Features

- **📱 Mobile-First Priority**: Custom UI engineered specifically for smartphones (320px–414px) with safe-area support (`100dvh`), large touch targets, and automatic vertical stacking for 2-participant mobile calls (FaceTime/WhatsApp style).
- **🔗 One-Tap Shareable Links**: Instant meeting generation with clean URLs (`/meeting/<meetingId>`), direct join without entering codes, and native Web Share integration (WhatsApp, Telegram, SMS, Email).
- **🎙️ Pre-Join Studio**: Live camera preview, real-time Web Audio API speech volume meter, and microphone/camera toggles before entering the room.
- **⚡ High Performance SFU**: Powered by LiveKit WebRTC media routing for ultra-low latency audio and video.
- **👥 Flexible Layouts**: Adaptive participant grid and dedicated active speaker view with horizontal filmstrip.
- **🛡️ Self-Hosted & Private**: Complete data ownership for churches and ministries. Never exposes media server credentials to client browsers.

---

## 🏗️ Architecture

```text
GraceMeet (Root)
│
├── grace-meet-web/          # Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
│   ├── src/app/             # Meeting routes, landing page, token API
│   ├── src/components/      # PreJoin, VideoStage, ParticipantGrid, SpeakerView, Controls
│   └── src/lib/             # Meeting utilities and LiveKit helpers
│
└── grace-meet-livekit/      # LiveKit SFU WebRTC Media Server (compiled from source)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** >= 20.x
- **Go** >= 1.22 (for LiveKit server)
- **Git**

### 1. Start LiveKit SFU Media Server

In a dedicated terminal:

```powershell
cd d:\GraceMeet\grace-meet-livekit
.\bin\livekit-server.exe --dev
```

The media server will start on `ws://localhost:7880`.

### 2. Configure Environment Variables

Create `.env.local` inside `grace-meet-web/`:

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

> **Note:** `.env.local` is strictly ignored by Git to protect secrets.

### 3. Start GraceMeet Web Application

In a second terminal:

```powershell
cd d:\GraceMeet\grace-meet-web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Testing Direct Join & WhatsApp Sharing

1. **Host**: Navigate to `http://localhost:3000`, enter your name, and click **Start Meeting**.
2. **Share**: On the Pre-Join screen, click **Share Link** or copy the generated meeting link (`http://localhost:3000/meeting/fellowship-xxxx`).
3. **Guest**: Open the link in another browser or incognito window. The guest is taken directly to the Pre-Join screen with device preview without needing to enter a meeting code.
4. **Join**: Both participants connect to the LiveKit room with real-time video, audio, and mute controls.

---

## 📜 License

Apache 2.0 / Open Source for the Global Church.
