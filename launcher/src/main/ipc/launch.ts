import { ipcMain, BrowserWindow, app } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import { Client } from 'minecraft-launcher-core'
import { getValidTokens } from './auth'
import { pickBestJava, requiredJavaForMc } from './java-detect'
import type { Mod, ModpackFull } from '../../shared/types'

const API = process.env.API_URL || 'https://mc-api.daboismc.win'
const localOpts = new Store<{ launchOptions?: Record<string, any> }>({ name: 'launch-options' })

// The backend validates pack IDs server-side, but a compromised/rogue
// backend or a stale cached manifest is still untrusted input here — never
// let a pack ID resolve to a path outside the packs root.
function packDir(packId: string) {
  const root = path.join(app.getPath('userData'), 'packs')
  const dir = path.join(root, packId)
  if (dir !== root && !dir.startsWith(root + path.sep)) {
    throw new Error(`Refusing to use unsafe pack directory for id "${packId}"`)
  }
  return dir
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((res, rej) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath).on('data', d => hash.update(d)).on('end', () => res(hash.digest('hex'))).on('error', rej)
  })
}

function progress(win: BrowserWindow | null, msg: string) {
  win?.webContents.send('launch:progress', msg)
}

function syncProgress(win: BrowserWindow | null, current: number, total: number, filename: string) {
  win?.webContents.send('launch:syncProgress', { current, total, filename })
}

interface LaunchOptions {
  min_ram: string; max_ram: string; jvm_args: string; java_path: string
}

function getLocalLaunchOptions(packId: string): LaunchOptions {
  const all = localOpts.get('launchOptions', {}) as Record<string, any>
  const p = all[packId] || {}
  return {
    min_ram: p.min_ram || '2G',
    max_ram: p.max_ram || '4G',
    jvm_args: p.jvm_args || '',
    java_path: p.java_path || ''
  }
}

function defaultJavaExe(): string {
  return process.platform === 'win32' ? 'javaw' : 'java'
}

// Extras: caller can pass a specific server to auto-connect to
interface LaunchExtras {
  serverHost?: string
  serverPort?: number
}

export function launchHandlers() {
  ipcMain.handle('launch:syncAndLaunch', async (_e, packId: string, extras: LaunchExtras = {}) => {
    const win = BrowserWindow.getFocusedWindow()

    progress(win, 'Checking Minecraft session...')
    const tokens = await getValidTokens()
    if (!tokens) throw new Error('Not logged in')

    progress(win, 'Fetching modpack manifest...')
    const { data: pack }: { data: ModpackFull } = await axios.get(`${API}/modpacks/${packId}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    const root = packDir(packId)
    const modsDir = path.join(root, 'mods')
    await fs.ensureDir(modsDir)

    const remoteMap = new Map<string, Mod>(pack.mods.map(m => [m.filename, m]))
    const localFiles = await fs.readdir(modsDir)
    const localHashes = new Map<string, string>()
    for (const f of localFiles) localHashes.set(f, await sha256File(path.join(modsDir, f)))

    for (const f of localFiles) {
      if (!remoteMap.has(f)) {
        progress(win, `Removing ${f}`)
        await fs.remove(path.join(modsDir, f))
      }
    }

    const toDownload = Array.from(remoteMap.entries()).filter(([filename, mod]) => localHashes.get(filename) !== mod.sha256)
    let downloaded = 0
    for (const [filename, mod] of toDownload) {
      syncProgress(win, downloaded, toDownload.length, filename)
      progress(win, `Downloading ${filename}`)
      const res = await axios.get(mod.download_url, { responseType: 'stream' })
      await new Promise<void>((resolve, reject) => {
        const w = fs.createWriteStream(path.join(modsDir, filename))
        res.data.pipe(w); w.on('finish', () => resolve()); w.on('error', reject)
      })
      downloaded++
      syncProgress(win, downloaded, toDownload.length, filename)
    }
    if (downloaded > 0) progress(win, `Downloaded ${downloaded} mods`)

    const launchOpts = getLocalLaunchOptions(packId)

    let loaderVersion = pack.loader_version?.trim() || ''
    if (!loaderVersion) {
      progress(win, `Fetching latest ${pack.loader} version for MC ${pack.mc_version}...`)
      if (pack.loader === 'forge') loaderVersion = await fetchLatestForge(pack.mc_version)
      else if (pack.loader === 'neoforge') loaderVersion = await fetchLatestNeoForge(pack.mc_version)
      else if (pack.loader === 'fabric') loaderVersion = await fetchLatestFabric()
      if (!loaderVersion) throw new Error(`Could not fetch a default ${pack.loader} version`)
      progress(win, `Using ${pack.loader} ${loaderVersion}`)
    }

    let javaPath: string | undefined
    if (launchOpts.java_path.trim()) {
      javaPath = launchOpts.java_path.trim()
      progress(win, `Using custom Java: ${javaPath}`)
    } else {
      const required = requiredJavaForMc(pack.mc_version)
      progress(win, `Detecting Java ${required}+ install for MC ${pack.mc_version}...`)
      const best = await pickBestJava(pack.mc_version)
      if (best) {
        if (best.majorVersion < required) {
          progress(win, `WARNING: Only found Java ${best.majorVersion}, but MC ${pack.mc_version} needs Java ${required}+.`)
        } else {
          progress(win, `Using Java ${best.majorVersion}: ${best.path}`)
        }
        javaPath = best.path
      } else {
        progress(win, `No Java installs detected. Falling back to system ${defaultJavaExe()}.`)
        javaPath = defaultJavaExe()
      }
    }

    progress(win, `Preparing Minecraft ${pack.mc_version} (${pack.loader} ${loaderVersion})`)
    const launcher = new Client()
    launcher.on('debug', (m: string) => progress(win, m))
    launcher.on('data', (m: string) => progress(win, m.trim()))
    launcher.on('close', (code: number) => progress(win, `Minecraft exited (code ${code})`))

    let versionNumber = pack.mc_version
    if (pack.loader === 'fabric') {
      versionNumber = await ensureFabricProfile(pack.mc_version, loaderVersion, root, win)
    }

    const opts: any = {
      authorization: {
        access_token: tokens.mc_access_token,
        client_token: tokens.mc_access_token,
        uuid: tokens.minecraft_uuid,
        name: tokens.minecraft_username,
        user_properties: '{}',
        meta: { type: 'msa', xuid: '', demo: false }
      },
      root,
      version: pack.loader === 'fabric'
        ? { number: pack.mc_version, type: 'release', custom: versionNumber }
        : { number: pack.mc_version, type: 'release' },
      memory: { max: launchOpts.max_ram, min: launchOpts.min_ram },
      overrides: { gameDirectory: root }
    }

    if (javaPath) opts.javaPath = javaPath
    if (launchOpts.jvm_args.trim()) opts.customArgs = launchOpts.jvm_args.trim().split(/\s+/)

    // If a specific server was requested, auto-connect
    if (extras.serverHost) {
      const port = extras.serverPort || 25565
      progress(win, `Will connect to ${extras.serverHost}:${port} after launch`)
      opts.quickPlay = {
        type: 'multiplayer',
        identifier: `${extras.serverHost}:${port}`
      }
    }

    if (pack.loader === 'forge') {
      opts.forge = await ensureForgeInstaller(pack.mc_version, loaderVersion, root, win)
    } else if (pack.loader === 'neoforge') {
      opts.forge = await ensureNeoForgeInstaller(loaderVersion, root, win)
    }

    progress(win, 'Launching Minecraft')
    await launcher.launch(opts)
    return { success: true, modCount: pack.mods.length }
  })
}

async function fetchLatestForge(mcVersion: string): Promise<string> {
  const { data } = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
  return data.promos?.[`${mcVersion}-recommended`] || data.promos?.[`${mcVersion}-latest`] || ''
}
async function fetchLatestNeoForge(mcVersion: string): Promise<string> {
  const { data } = await axios.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')
  const mcMinor = mcVersion.split('.').slice(1).join('.')
  const matching = (data.versions || []).filter((v: string) => v.startsWith(mcMinor + '.'))
  return matching[matching.length - 1] || ''
}
async function fetchLatestFabric(): Promise<string> {
  const { data } = await axios.get('https://meta.fabricmc.net/v2/versions/loader')
  const stable = data.find((v: any) => v.stable) || data[0]
  return stable?.version || ''
}

async function ensureForgeInstaller(mcVersion: string, forgeVersion: string, packRoot: string, win: BrowserWindow | null): Promise<string> {
  const installerDir = path.join(packRoot, 'forge-installer')
  await fs.ensureDir(installerDir)
  const localPath = path.join(installerDir, `forge-${mcVersion}-${forgeVersion}-installer.jar`)
  if (await fs.pathExists(localPath)) { progress(win, `Using cached Forge installer`); return localPath }
  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`
  progress(win, `Downloading Forge installer`)
  const res = await axios.get(url, { responseType: 'stream' })
  await new Promise<void>((resolve, reject) => {
    const w = fs.createWriteStream(localPath); res.data.pipe(w); w.on('finish', () => resolve()); w.on('error', reject)
  })
  progress(win, 'Forge installer downloaded')
  return localPath
}

async function ensureNeoForgeInstaller(neoforgeVersion: string, packRoot: string, win: BrowserWindow | null): Promise<string> {
  const installerDir = path.join(packRoot, 'neoforge-installer')
  await fs.ensureDir(installerDir)
  const localPath = path.join(installerDir, `neoforge-${neoforgeVersion}-installer.jar`)
  if (await fs.pathExists(localPath)) { progress(win, `Using cached NeoForge installer`); return localPath }
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`
  progress(win, `Downloading NeoForge installer`)
  const res = await axios.get(url, { responseType: 'stream' })
  await new Promise<void>((resolve, reject) => {
    const w = fs.createWriteStream(localPath); res.data.pipe(w); w.on('finish', () => resolve()); w.on('error', reject)
  })
  progress(win, 'NeoForge installer downloaded')
  return localPath
}

async function ensureFabricProfile(mcVersion: string, fabricVersion: string, packRoot: string, win: BrowserWindow | null): Promise<string> {
  const profileName = `fabric-loader-${fabricVersion}-${mcVersion}`
  const versionDir = path.join(packRoot, 'versions', profileName)
  const profilePath = path.join(versionDir, `${profileName}.json`)
  if (await fs.pathExists(profilePath)) { progress(win, `Using cached Fabric profile`); return profileName }
  await fs.ensureDir(versionDir)
  const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${fabricVersion}/profile/json`
  progress(win, `Downloading Fabric profile`)
  const { data } = await axios.get(url)
  await fs.writeJson(profilePath, data, { spaces: 2 })
  progress(win, 'Fabric profile ready')
  return profileName
}
