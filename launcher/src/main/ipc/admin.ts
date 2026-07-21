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

export function adminHandlers() {
  ipcMain.handle('admin:checkAccess', async () => {
    try {
      await axios.get(`${API}/admin/check`, { headers: authHeader() })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('admin:listBans', async () => {
    const { data } = await axios.get(`${API}/admin/bans`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('admin:banUser', async (_e, minecraftUsername: string, reason: string) => {
    const { data } = await axios.post(
      `${API}/admin/bans`,
      { minecraft_username: minecraftUsername, reason },
      { headers: authHeader() }
    )
    return data
  })

  ipcMain.handle('admin:unbanUser', async (_e, minecraftUuid: string) => {
    await axios.delete(`${API}/admin/bans/${minecraftUuid}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('admin:listReports', async (_e, status = 'open') => {
    const { data } = await axios.get(`${API}/admin/reports`, { params: { status }, headers: authHeader() })
    return data
  })

  ipcMain.handle('admin:resolveReport', async (_e, reportId: string) => {
    await axios.post(`${API}/admin/reports/${reportId}/resolve`, {}, { headers: authHeader() })
    return true
  })

  ipcMain.handle('admin:dismissReport', async (_e, reportId: string) => {
    await axios.post(`${API}/admin/reports/${reportId}/dismiss`, {}, { headers: authHeader() })
    return true
  })

  ipcMain.handle('admin:forcePrivatePack', async (_e, packId: string) => {
    await axios.post(`${API}/admin/packs/${packId}/force-private`, {}, { headers: authHeader() })
    return true
  })

  ipcMain.handle('admin:forceDeletePack', async (_e, packId: string) => {
    await axios.delete(`${API}/admin/packs/${packId}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('modpacks:reportPack', async (_e, packId: string, reason: string) => {
    await axios.post(`${API}/modpacks/${packId}/report`, { reason }, { headers: authHeader() })
    return true
  })
}
