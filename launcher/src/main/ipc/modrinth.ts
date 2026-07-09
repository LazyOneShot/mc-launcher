import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'

const MODRINTH = 'https://api.modrinth.com/v2'
const API = process.env.API_URL || 'https://mc-api.daboismc.win'

// Modrinth requires a uniquely-identifying User-Agent. Generic ones
// (axios defaults, bare library names) are liable to get blocked.
const UA = 'LazyOneShot/mc-launcher (github.com/LazyOneShot/mc-launcher)'

const store = new Store<{ tokens: AuthTokens }>()

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

const mr = axios.create({
  baseURL: MODRINTH,
  headers: { 'User-Agent': UA },
  timeout: 15000
})

/**
 * Facets are arrays of arrays: inner arrays OR together, outer arrays AND.
 * Mod loaders live under `categories` in the search index — the `loaders`
 * facet only exists on version objects.
 */
function buildFacets(mcVersion: string, loader: string): string {
  return JSON.stringify([
    ['project_type:mod'],
    [`versions:${mcVersion}`],
    [`categories:${loader}`]
  ])
}

export function modrinthHandlers() {
  ipcMain.handle(
    'modrinth:search',
    async (_e, query: string, mcVersion: string, loader: string, offset = 0) => {
      const { data } = await mr.get('/search', {
        params: {
          query: query || '',
          facets: buildFacets(mcVersion, loader),
          index: query ? 'relevance' : 'downloads',
          limit: 20,
          offset
        }
      })
      return { hits: data.hits, total: data.total_hits, offset: data.offset }
    }
  )

  ipcMain.handle(
    'modrinth:versions',
    async (_e, projectId: string, mcVersion: string, loader: string) => {
      const { data } = await mr.get(`/project/${projectId}/version`, {
        params: {
          game_versions: JSON.stringify([mcVersion]),
          loaders: JSON.stringify([loader])
        }
      })
      return data
    }
  )

  // Hand the CDN URL to our backend, which does the fetch and the MinIO put.
  // Downloading here and re-uploading would push the bytes over the user's
  // home connection twice for no reason.
  ipcMain.handle(
    'modrinth:install',
    async (_e, packId: string, url: string, filename: string) => {
      const { data } = await axios.post(
        `${API}/modpacks/${packId}/mods/from-url`,
        { url, filename },
        { headers: authHeader() }
      )
      return data
    }
  )

  // The backend does the hash lookup — it holds the sha1s and can backfill
  // any that are missing straight from MinIO.
  ipcMain.handle('modrinth:checkUpdates', async (_e, packId: string) => {
    const { data } = await axios.post(
      `${API}/modpacks/${packId}/check-updates`,
      {},
      { headers: authHeader(), timeout: 120000 }
    )
    return data
  })

  ipcMain.handle(
    'modrinth:applyUpdate',
    async (_e, packId: string, modId: string, url: string, filename: string) => {
      const { data } = await axios.post(
        `${API}/modpacks/${packId}/mods/${modId}/update`,
        { url, filename },
        { headers: authHeader(), timeout: 120000 }
      )
      return data
    }
  )
}
