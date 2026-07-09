import { ipcMain, dialog, BrowserWindow } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'

export function downloadHandlers() {
  // Saves a single mod JAR wherever the user picks. The URL is the presigned
  // MinIO link that get_modpack regenerates on every fetch, so it's fresh.
  ipcMain.handle('mods:download', async (event, filename: string, url: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save mod',
      defaultPath: filename,
      filters: [{ name: 'Mod JAR', extensions: ['jar'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    const res = await axios.get(url, { responseType: 'stream' })
    await new Promise<void>((resolve, reject) => {
      const w = fs.createWriteStream(result.filePath!)
      res.data.pipe(w)
      w.on('finish', () => resolve())
      w.on('error', reject)
    })
    return { canceled: false, path: result.filePath }
  })
}
