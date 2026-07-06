# MC Launcher

Custom Minecraft mod launcher with cloud-synced modpacks. Sign in with your Microsoft/Minecraft account, join a pack, hit Play. Mods sync automatically across every machine you use.

## Features

- 🔐 **Microsoft sign-in** with silent token refresh (no 24-hour re-login pain)
- ☁️ **Cloud-synced modpacks** — one person uploads, everyone auto-syncs on Play
- 🎮 **Forge / NeoForge / Fabric** support with auto-fetching of latest loader versions
- 🧠 **Auto-detects Java** based on MC version (Java 17 for 1.20.4-, Java 21 for 1.20.5+)
- 👥 **Role system** — owner / editor / viewer permissions per pack
- 🔄 **Auto-updates** from GitHub releases
- 🖥️ **Cross-platform** — Windows + Linux

## Install

### Windows

1. Download the latest `.exe` from [Releases](https://github.com/LazyOneShot/mc-launcher/releases/latest)
2. Run the installer
3. Launch from Start Menu

Auto-updates happen automatically on startup.

### Linux

**Option A — Pre-built AppImage (any distro):**

1. Download the `.AppImage` from [Releases](https://github.com/LazyOneShot/mc-launcher/releases/latest)
2. Install FUSE if needed: `sudo pacman -S fuse2` (Arch) or `sudo apt install libfuse2` (Debian/Ubuntu)
3. Run:
   ```bash
   chmod +x "MC Launcher-X.Y.Z.AppImage"
   "./MC Launcher-X.Y.Z.AppImage"
   ```

**Option B — Build from source with desktop integration (Arch/CachyOS):**

One-line install that clones, builds, and registers as a desktop app:

```bash
curl -O https://raw.githubusercontent.com/LazyOneShot/mc-launcher/main/scripts/install-linux.sh
chmod +x install-linux.sh
./install-linux.sh
```

### macOS

Not yet supported — coming soon.

## Requirements

- Minecraft Java Edition account
- Java 17 (for MC 1.17–1.20.4) or Java 21 (for MC 1.20.5+)
  - Download from [Adoptium](https://adoptium.net/temurin/releases/)

## First-time setup

1. Open the launcher and click **Sign in with Microsoft**
2. A browser opens — enter the code shown in the launcher
3. Back in the launcher, either:
   - **Join** a friend's pack by pasting their pack ID
   - **+ Create Pack** to make your own

First launch of a pack downloads Minecraft, the mod loader, and all mods (~500MB, 5–15 min). Subsequent launches are near instant.

## Roles

- **Owner** — full control (edit, delete, transfer, manage members)
- **Editor** — can add/remove mods
- **Viewer** — can join and play, but not modify

New joiners start as Viewers. The owner can promote to Editor from the Members tab.

## Troubleshooting

**"Failed to log in: Invalid session"**
→ Sign out and sign back in. Minecraft token expired.

**Minecraft crashes with "class file version XX.0"**
→ Wrong Java version. Install the version matching your MC version (see Requirements) and set Custom Java Path under Pack → Settings.

**Linux: "libfuse.so.2 error"**
→ Install FUSE: `sudo pacman -S fuse2` or `sudo apt install libfuse2`

---

## Development

### Launcher (Electron)

**Dev:**
```bash
cd launcher
npm install
npm run dev
```

**Build installer:**
```bash
npm run build && npm run package
```

**Env vars:**
- `API_URL` — backend URL (default: `https://mc-api.daboismc.win`)
- `AZURE_CLIENT_ID` — from Azure App Registration

### Backend (FastAPI)

Deployed at `mc-api.daboismc.win` (production).

**Local dev:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Env vars** (see `backend/.env.example`):
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
- `JWT_SECRET`
- `MS_CLIENT_ID`

### Stack

- **Frontend:** Electron 30, React 18, TypeScript, minecraft-launcher-core
- **Backend:** FastAPI, SQLModel + SQLite, MinIO
- **Auth:** MSAL device-code flow → Xbox Live → Minecraft services
- **Deploy:** Docker Compose on Proxmox LXC, Nginx Proxy Manager, Let's Encrypt