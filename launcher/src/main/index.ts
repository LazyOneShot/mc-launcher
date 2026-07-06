import 'dotenv/config'
import { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { authHandlers } from './ipc/auth'
import { modpackHandlers } from './ipc/modpacks'
import { launchHandlers } from './ipc/launch'
import { memberHandlers } from './ipc/members'
import { versionHandlers } from './ipc/versions'
import { updateHandlers } from './ipc/updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 900,
    minHeight: 600,
    frame: false,             // hide native frame so we can draw our own
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1020',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Close button hides to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  return mainWindow
}

function createTray() {
  const isDev = !app.isPackaged
  const iconPath = isDev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png')

  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      console.error('[tray] Icon loaded but is empty:', iconPath)
    } else {
      trayIcon = trayIcon.resize({ width: 16, height: 16 })
    }
  } catch (e) {
    console.error('[tray] Failed to load icon:', e)
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('MC Launcher')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open MC Launcher',
      click: () => { mainWindow?.show(); mainWindow?.focus() }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { isQuitting = true; app.quit() }
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// Window control IPC — used by the custom title bar in the renderer
function windowControlHandlers() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
}

// Ensure only one instance can run — clicking the exe again just focuses existing window
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    createTray()
    authHandlers()
    modpackHandlers()
    launchHandlers()
    memberHandlers()
    versionHandlers()
    updateHandlers()
    windowControlHandlers()

    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => console.error('[updater] Auto-check failed:', err))
      }, 3000)
    }
  })
}

app.on('before-quit', () => { isQuitting = true })

app.on('window-all-closed', () => {
  // Don't quit on window close — tray keeps app alive
  // Only quit on non-macOS if user explicitly quits
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})
