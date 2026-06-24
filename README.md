# mc-launcher

A custom Minecraft launcher with cloud-synced modpacks.

## Features
- Login with Microsoft account
- Create modpacks with a shareable pack ID
- Upload mod JARs directly — stored in MinIO on homelab
- Auto-sync mods on every launch (adds, updates, removes by SHA-256 diff)
- Friends join with just the pack ID

## Structure
```
mc-launcher/
├── launcher/   # Electron + React + TypeScript desktop app
└── backend/    # FastAPI + MinIO API (self-hosted on harv.com)
```
