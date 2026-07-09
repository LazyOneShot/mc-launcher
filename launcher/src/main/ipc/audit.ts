import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'

const API = process.env.API_URL || 'https://mc-api.daboismc.win'
const store = new Store<{ tokens: AuthTokens }>()

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

export function auditHandlers() {
  ipcMain.handle('audit:list', async (_e, packId: string, limit = 100) => {
    const { data } = await axios.get(`${API}/modpacks/${packId}/audit`, {
      params: { limit },
      headers: authHeader()
    })
    return data
  })
}
