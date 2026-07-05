import { ipcMain } from 'electron'
import axios from 'axios'

interface CachedVersions {
  mc?: { data: string[]; fetched: number }
  forge?: Record<string, { data: string[]; fetched: number }>
}

const cache: CachedVersions = { forge: {} }
const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

export function versionHandlers() {
  // Fetch official MC release versions from Mojang manifest
  ipcMain.handle('versions:mc', async () => {
    if (cache.mc && Date.now() - cache.mc.fetched < CACHE_TTL_MS) {
      return cache.mc.data
    }
    try {
      const { data } = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')
      // Only stable releases, in descending order (newest first)
      const releases = data.versions
        .filter((v: any) => v.type === 'release')
        .map((v: any) => v.id)
      cache.mc = { data: releases, fetched: Date.now() }
      return releases
    } catch (e) {
      console.error('[versions] Failed to fetch MC versions:', e)
      // Fallback to a hardcoded list if Mojang is unreachable
      return ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2']
    }
  })

  // Fetch available Forge versions for a specific MC version
  ipcMain.handle('versions:forge', async (_e, mcVersion: string) => {
    if (cache.forge?.[mcVersion] && Date.now() - cache.forge[mcVersion].fetched < CACHE_TTL_MS) {
      return cache.forge[mcVersion].data
    }
    try {
      // Forge publishes a JSON list of all promotions
      const { data } = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
      const promos = data.promos || {}
      // e.g. "1.20.1-latest": "47.4.0", "1.20.1-recommended": "47.3.0"
      const versions: string[] = []
      const latest = promos[`${mcVersion}-latest`]
      const recommended = promos[`${mcVersion}-recommended`]
      if (recommended && recommended !== latest) versions.push(recommended)
      if (latest) versions.push(latest)
      if (cache.forge) cache.forge[mcVersion] = { data: versions, fetched: Date.now() }
      return versions
    } catch (e) {
      console.error('[versions] Failed to fetch Forge versions:', e)
      return []
    }
  })

  // Get the recommended (default) Forge version for an MC version
  ipcMain.handle('versions:forge:latest', async (_e, mcVersion: string) => {
    try {
      const { data } = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
      const promos = data.promos || {}
      return promos[`${mcVersion}-recommended`] || promos[`${mcVersion}-latest`] || null
    } catch (e) {
      console.error('[versions] Failed to fetch latest Forge:', e)
      return null
    }
  })
}
