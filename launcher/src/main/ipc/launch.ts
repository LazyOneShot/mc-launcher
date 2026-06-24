import { ipcMain, BrowserWindow } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import Store from 'electron-store'
import type { AuthTokens, Mod, ModpackFull } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'https://api.harv.com/mc'

function modsDir(packId: string) {
  const base = process.env.APPDATA || process.env.HOME || ''
  return path.join(base, '.mc-launcher', 'packs', packId, 'mods')
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', d => hash.update(d))
      .on('end', () => res(hash.digest('hex')))
      .on('error', rej)
  })
}

function progress(win: BrowserWindow | null, msg: string) {
  win?.webContents.send('launch:progress', msg)
}

export function launchHandlers() {
  ipcMain.handle('launch:syncAndLaunch', async (_e, packId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const tokens = store.get('tokens') as AuthTokens | undefined
    if (!tokens) throw new Error('Not logged in')

    // 1. Fetch remote manifest
    progress(win, 'Fetching modpack manifest...')
    const { data: pack }: { data: ModpackFull } = await axios.get(`${API}/modpacks/${packId}`)

    const dir = modsDir(packId)
    await fs.ensureDir(dir)

    // 2. Build maps
    const remoteMap = new Map<string, Mod>(pack.mods.map(m => [m.filename, m]))
    const localFiles = await fs.readdir(dir)
    const localHashes = new Map<string, string>()
    for (const f of localFiles) {
      localHashes.set(f, await sha256File(path.join(dir, f)))
    }

    // 3. Remove stale mods
    for (const f of localFiles) {
      if (!remoteMap.has(f)) {
        progress(win, `Removing ${f}`)
        await fs.remove(path.join(dir, f))
      }
    }

    // 4. Download new / updated mods
    for (const [filename, mod] of remoteMap) {
      if (localHashes.get(filename) === mod.sha256) continue
      progress(win, `Downloading ${filename}...`)
      const res = await axios.get(mod.download_url, { responseType: 'stream' })
      await new Promise<void>((resolve, reject) => {
        const w = fs.createWriteStream(path.join(dir, filename))
        res.data.pipe(w)
        w.on('finish', resolve)
        w.on('error', reject)
      })
    }

    // 5. TODO: invoke java with correct MC version + loader
    progress(win, `Launching Minecraft ${pack.mc_version} (${pack.loader})...`)

    return { success: true, modCount: pack.mods.length }
  })
}
