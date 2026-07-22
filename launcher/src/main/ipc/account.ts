import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'https://mc-api.daboismc.win'

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

export function accountHandlers() {
  ipcMain.handle('account:delete', async () => {
    await axios.delete(`${API}/account/me`, { headers: authHeader() })
    return true
  })
}
