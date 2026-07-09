import 'dotenv/config'
import { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { authHandlers } from './ipc/auth'
import { modpackHandlers } from './ipc/modpacks'
import { launchHandlers } from './ipc/launch'
import { memberHandlers } from './ipc/members'
import { updateHandlers } from './ipc/updater'
import { versionHandlers } from './ipc/versions'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const USE_CUSTOM_TITLEBAR = process.platform === 'win32'

function getIconPath(name: 'png' | 'ico' = 'png'): string {
  const isDev = !app.isPackaged
  const filename = `icon.${name}`
  return isDev
    ? join(__dirname, '../../build', filename)
    : join(process.resourcesPath, filename)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 900,
    minHeight: 600,
    frame: !USE_CUSTOM_TITLEBAR,
    titleBarStyle: USE_CUSTOM_TITLEBAR ? 'hidden' : 'default',
    backgroundColor: '#0f1020',
    icon: getIconPath('png'),
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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  return mainWindow
}

function createTray() {
  const iconPath = getIconPath('png')
  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      console.error('[tray] Icon loaded but empty:', iconPath)
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
    { label: 'Open MC Launcher', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function windowControlHandlers() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:useCustomTitleBar', () => USE_CUSTOM_TITLEBAR)
}

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
    updateHandlers()
    versionHandlers()
    windowControlHandlers()
    // NOTE: The renderer's StartupUpdate page now handles the initial update check.
    // Periodic checks are started after the splash screen completes.
  })
}

app.on('before-quit', () => { isQuitting = true })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})
