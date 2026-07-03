import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'http://localhost:8000'

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

export function memberHandlers() {
  ipcMain.handle('members:get', async (_e, packId: string) => {
    const { data } = await axios.get(`${API}/modpacks/${packId}/members`)
    return data
  })

  ipcMain.handle('members:add', async (_e, packId: string, username: string) => {
    const { data } = await axios.post(
      `${API}/modpacks/${packId}/members`,
      { minecraft_username: username },
      { headers: authHeader() }
    )
    return data
  })

  ipcMain.handle('members:remove', async (_e, packId: string, uuid: string) => {
    await axios.delete(`${API}/modpacks/${packId}/members/${uuid}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('members:transfer', async (_e, packId: string, uuid: string) => {
    const { data } = await axios.post(
      `${API}/modpacks/${packId}/transfer`,
      { minecraft_uuid: uuid },
      { headers: authHeader() }
    )
    return data
  })
}

// These go in modpackHandlers() in modpacks.ts but added here for convenience
// Wire updateModpack and deleteModpack into modpacks.ts instead
