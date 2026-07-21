import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import { status } from 'minecraft-server-util'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'https://mc-api.daboismc.win'

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

export function serverHandlers() {
  ipcMain.handle('servers:list', async (_e, packId: string) => {
    const { data } = await axios.get(`${API}/modpacks/${packId}/servers`)
    return data
  })

  ipcMain.handle('servers:add', async (_e, packId: string, server: { name: string, host: string, port: number }) => {
    const { data } = await axios.post(
      `${API}/modpacks/${packId}/servers`,
      server,
      { headers: authHeader() }
    )
    return data
  })

  ipcMain.handle('servers:update', async (_e, packId: string, serverId: string, patch: object) => {
    const { data } = await axios.patch(
      `${API}/modpacks/${packId}/servers/${serverId}`,
      patch,
      { headers: authHeader() }
    )
    return data
  })

  ipcMain.handle('servers:delete', async (_e, packId: string, serverId: string) => {
    await axios.delete(`${API}/modpacks/${packId}/servers/${serverId}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('servers:ping', async (_e, host: string, port: number) => {
    try {
      const res = await status(host, port, { timeout: 3000 })
      return { online: true, players: { online: res.players.online, max: res.players.max } }
    } catch {
      return { online: false }
    }
  })
}
