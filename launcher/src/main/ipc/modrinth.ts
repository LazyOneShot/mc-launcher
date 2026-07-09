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

export interface ModrinthHit {
  project_id: string
  slug: string
  title: string
  description: string
  downloads: number
  icon_url: string | null
  author: string
  categories: string[]
  versions: string[]
}

export interface ModrinthFile {
  filename: string
  url: string
  size: number
  primary: boolean
}

export interface ModrinthVersion {
  id: string
  name: string
  version_number: string
  version_type: string   // release | beta | alpha
  game_versions: string[]
  loaders: string[]
  date_published: string
  files: ModrinthFile[]
}

/**
 * Facets are arrays of arrays: inner arrays OR together, outer arrays AND.
 * Note that mod loaders live under `categories` for the search index,
 * not under a `loaders` facet — that only exists on version objects.
 */
function buildFacets(mcVersion: string, loader: string): string {
  const facets: string[][] = [
    ['project_type:mod'],
    [`versions:${mcVersion}`],
    [`categories:${loader}`]
  ]
  return JSON.stringify(facets)
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
      return {
        hits: data.hits as ModrinthHit[],
        total: data.total_hits as number,
        offset: data.offset as number
      }
    }
  )

  // Versions of one project, already narrowed to the pack's MC version + loader.
  ipcMain.handle(
    'modrinth:versions',
    async (_e, projectId: string, mcVersion: string, loader: string) => {
      const { data } = await mr.get(`/project/${projectId}/version`, {
        params: {
          game_versions: JSON.stringify([mcVersion]),
          loaders: JSON.stringify([loader])
        }
      })
      return data as ModrinthVersion[]
    }
  )

  // Hand the CDN URL to our backend, which does the actual fetch + MinIO put.
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
}
