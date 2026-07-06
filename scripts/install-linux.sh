#!/bin/bash
# MC Launcher - Linux Setup Script (CachyOS / Arch)
# Removes any previous installation, installs deps, clones fresh repo,
# builds AppImage, and integrates as a desktop application.
#
# Usage: bash install-linux.sh

set -e  # exit on error

REPO_URL="https://github.com/LazyOneShot/mc-launcher.git"
BUILD_DIR="$HOME/mc-launcher-build"
APP_DIR="$HOME/Applications"
DESKTOP_FILE="$HOME/.local/share/applications/mc-launcher.desktop"
ICON_PATH="$APP_DIR/mc-launcher-icon.png"

# ── Colors for readability ────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }

# ── 1. Cleanup previous installations ────────────────────────────────────────
step "Cleaning up previous MC Launcher installations..."

# Kill any running instances
pkill -f "MC Launcher" 2>/dev/null || true
pkill -f "mc-launcher" 2>/dev/null || true

# Remove desktop entries
rm -f "$HOME/.local/share/applications/mc-launcher.desktop"
rm -f "$HOME/.local/share/applications/appimagekit-mc-launcher.desktop"
rm -f "$HOME/.local/share/applications/AppImage"*mc-launcher*.desktop 2>/dev/null || true

# Remove installed AppImages
rm -f "$APP_DIR"/*mc-launcher* 2>/dev/null || true
rm -f "$APP_DIR"/MC*Launcher* 2>/dev/null || true
rm -f "$HOME/Downloads"/*mc-launcher*.AppImage 2>/dev/null || true

# Remove cached user data (WARNING: this wipes signed-in state + downloaded mods)
# Comment out if you want to preserve existing pack downloads
read -p "Wipe user data too (signed-in session + downloaded mods)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.config/mc-launcher"
    warn "User data wiped — you'll need to sign in again"
fi

# Remove old build directory
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
fi

update-desktop-database "$HOME/.local/share/applications/" 2>/dev/null || true

# ── 2. Install system dependencies ───────────────────────────────────────────
step "Installing system dependencies (may prompt for sudo password)..."

sudo pacman -S --needed --noconfirm \
    nodejs npm git fuse2 \
    jre-openjdk \
    nss atk at-spi2-core libcups libdrm gtk3 alsa-lib libxkbcommon \
    libappindicator-gtk3 libnotify

# ── 3. Clone repo ────────────────────────────────────────────────────────────
step "Cloning launcher source..."
git clone --depth 1 "$REPO_URL" "$BUILD_DIR"
cd "$BUILD_DIR/launcher"

# ── 4. Install npm deps ──────────────────────────────────────────────────────
step "Installing npm dependencies..."
npm install --silent

# ── 5. Build ─────────────────────────────────────────────────────────────────
step "Compiling TypeScript..."
npm run build

step "Packaging AppImage..."
npm run package

# ── 6. Locate the built AppImage ─────────────────────────────────────────────
APPIMAGE=$(find dist -maxdepth 1 -name "*.AppImage" | head -n 1)
if [ -z "$APPIMAGE" ]; then
    err "Build succeeded but no AppImage found in dist/"
    exit 1
fi
step "Built: $APPIMAGE"

# ── 7. Install to ~/Applications and register desktop entry ──────────────────
step "Installing to $APP_DIR..."
mkdir -p "$APP_DIR"
cp "$APPIMAGE" "$APP_DIR/mc-launcher.AppImage"
chmod +x "$APP_DIR/mc-launcher.AppImage"

# Copy icon if present
if [ -f "build/icon.png" ]; then
    cp "build/icon.png" "$ICON_PATH"
else
    warn "No icon.png found — desktop entry will use a default icon"
    ICON_PATH="applications-games"  # generic games icon fallback
fi

# ── 8. Create desktop entry ──────────────────────────────────────────────────
step "Creating desktop entry..."
mkdir -p "$(dirname "$DESKTOP_FILE")"
cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=MC Launcher
Comment=Cloud-synced Minecraft mod launcher
Exec=$APP_DIR/mc-launcher.AppImage %U
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Game;
StartupWMClass=MC Launcher
DESKTOP

chmod +x "$DESKTOP_FILE"

# Refresh application database
update-desktop-database "$HOME/.local/share/applications/" 2>/dev/null || true

# Refresh icon cache so the icon shows up in the menu immediately
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/" 2>/dev/null || true

# ── 9. Cleanup build directory (optional) ────────────────────────────────────
step "Cleanup..."
read -p "Remove build directory at $BUILD_DIR? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    rm -rf "$BUILD_DIR"
    step "Build directory removed"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  MC Launcher installed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "Launch it from:"
echo "  • Your application menu (search 'MC Launcher')"
echo "  • Command line: $APP_DIR/mc-launcher.AppImage"
echo ""
echo "If the icon doesn't appear immediately, try logging out and back in."
