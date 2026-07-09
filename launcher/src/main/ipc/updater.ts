import { ipcMain, BrowserWindow, app } from 'electron'
import { autoUpdater } from 'electron-updater'

// Auto-updates run only on Windows and macOS.
// Linux users update by re-running the install script (AppImages can't safely self-update).
const AUTO_UPDATE_SUPPORTED = process.platform === 'win32' || process.platform === 'darwin'

const CHECK_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

let periodicCheckTimer: NodeJS.Timeout | null = null

export function updateHandlers() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...')
    sendToRenderer('update:checking', {})
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version)
    sendToRenderer('update:available', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No updates available')
    sendToRenderer('update:none', {})
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err)
    sendToRenderer('update:error', { message: err.message })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version)
    sendToRenderer('update:downloaded', { version: info.version })
  })

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      console.log('[updater] Skipping check in dev mode')
      return { skipped: true, reason: 'dev' }
    }
    if (!AUTO_UPDATE_SUPPORTED) {
      console.log('[updater] Auto-update not supported on this platform')
      return { skipped: true, reason: 'platform' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        version: result?.updateInfo?.version,
        currentVersion: app.getVersion(),
        updateAvailable: !!result?.updateInfo && result.updateInfo.version !== app.getVersion()
      }
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    await autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('update:currentVersion', () => app.getVersion())

  ipcMain.handle('update:isSupported', () => AUTO_UPDATE_SUPPORTED)

  // Start the periodic background check
  ipcMain.handle('update:startPeriodicCheck', () => {
    if (periodicCheckTimer) return
    if (!app.isPackaged || !AUTO_UPDATE_SUPPORTED) return

    periodicCheckTimer = setInterval(() => {
      console.log('[updater] Periodic check')
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[updater] Periodic check failed:', err)
      })
    }, CHECK_INTERVAL_MS)
  })

  ipcMain.handle('update:stopPeriodicCheck', () => {
    if (periodicCheckTimer) {
      clearInterval(periodicCheckTimer)
      periodicCheckTimer = null
    }
  })
}

function sendToRenderer(channel: string, data: any) {
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, data))
}
