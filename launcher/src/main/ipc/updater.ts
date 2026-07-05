import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { autoUpdater } from 'electron-updater'

export function updateHandlers() {
  // Configure — pulls from GitHub releases on the repo declared in package.json
  autoUpdater.autoDownload = false          // ask user first
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
    // Skip in dev
    if (!app.isPackaged) {
      console.log('[updater] Skipping check in dev mode')
      return { skipped: true }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { version: result?.updateInfo?.version, currentVersion: app.getVersion() }
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
}

function sendToRenderer(channel: string, data: any) {
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, data))
}
