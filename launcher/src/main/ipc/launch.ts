import { ipcMain, BrowserWindow } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import * as os from 'os'
import Store from 'electron-store'
import { Client } from 'minecraft-launcher-core'
import type { AuthTokens, Mod, ModpackFull } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'http://localhost:8000'

function packDir(packId: string) {
  const base = process.env.APPDATA || path.join(os.homedir(), '.mc-launcher')
  return path.join(base, '.mc-launcher', 'packs', packId)
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

    progress(win, 'Fetching modpack manifest...')
    const { data: pack }: { data: ModpackFull } = await axios.get(`${API}/modpacks/${packId}`)

    const root = packDir(packId)
    const modsDir = path.join(root, 'mods')
    await fs.ensureDir(modsDir)

    const remoteMap = new Map<string, Mod>(pack.mods.map(m => [m.filename, m]))
    const localFiles = await fs.readdir(modsDir)
    const localHashes = new Map<string, string>()
    for (const f of localFiles) {
      localHashes.set(f, await sha256File(path.join(modsDir, f)))
    }

    for (const f of localFiles) {
      if (!remoteMap.has(f)) {
        progress(win, `Removing ${f}`)
        await fs.remove(path.join(modsDir, f))
      }
    }

    let downloaded = 0
    for (const [filename, mod] of remoteMap) {
      if (localHashes.get(filename) === mod.sha256) continue
      progress(win, `Downloading ${filename}`)
      const res = await axios.get(mod.download_url, { responseType: 'stream' })
      await new Promise<void>((resolve, reject) => {
        const w = fs.createWriteStream(path.join(modsDir, filename))
        res.data.pipe(w)
        w.on('finish', () => resolve())
        w.on('error', reject)
      })
      downloaded++
    }
    if (downloaded > 0) progress(win, `Downloaded ${downloaded} mods`)

    progress(win, `Preparing Minecraft ${pack.mc_version} (${pack.loader} ${pack.loader_version})`)
    const launcher = new Client()

    launcher.on('debug', (m: string) => progress(win, m))
    launcher.on('data', (m: string) => progress(win, m.trim()))
    launcher.on('close', (code: number) => progress(win, `Minecraft exited (code ${code})`))

    const opts: any = {
      authorization: {
        access_token: tokens.mc_access_token,
        client_token: tokens.mc_access_token,
        uuid: tokens.minecraft_uuid,          // ← WITH hyphens
        name: tokens.minecraft_username,
        user_properties: '{}',
        meta: { type: 'msa', xuid: '', demo: false }
      },
      root: root,
      version: { number: pack.mc_version, type: 'release' },
      memory: { max: '4G', min: '2G' },
      overrides: { gameDirectory: root }
    }

    if (pack.loader === 'forge') {
      opts.forge = await ensureForgeInstaller(pack.mc_version, pack.loader_version, root, win)
    }

    progress(win, 'Launching Minecraft (first launch downloads ~500MB)')
    await launcher.launch(opts)

    return { success: true, modCount: pack.mods.length }
  })
}

async function ensureForgeInstaller(mcVersion: string, forgeVersion: string, packRoot: string, win: BrowserWindow | null): Promise<string> {
  const installerDir = path.join(packRoot, 'forge-installer')
  await fs.ensureDir(installerDir)
  const filename = `forge-${mcVersion}-${forgeVersion}-installer.jar`
  const localPath = path.join(installerDir, filename)

  if (await fs.pathExists(localPath)) {
    progress(win, `Using cached Forge installer`)
    return localPath
  }

  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`
  progress(win, `Downloading Forge installer`)

  const res = await axios.get(url, { responseType: 'stream' })
  await new Promise<void>((resolve, reject) => {
    const w = fs.createWriteStream(localPath)
    res.data.pipe(w)
    w.on('finish', () => resolve())
    w.on('error', reject)
  })
  progress(win, 'Forge installer downloaded')
  return localPath
}
