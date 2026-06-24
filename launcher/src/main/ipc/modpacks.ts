import { ipcMain } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import * as fs from 'fs-extra'
import FormData from 'form-data'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'https://api.harv.com/mc'

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

export function modpackHandlers() {
  ipcMain.handle('modpacks:get', async (_e, id: string) => {
    const { data } = await axios.get(`${API}/modpacks/${id}`)
    return data
  })

  ipcMain.handle('modpacks:listMine', async () => {
    const { data } = await axios.get(`${API}/modpacks/mine`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:create', async (_e, meta: object) => {
    const { data } = await axios.post(`${API}/modpacks`, meta, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:uploadMod', async (_e, packId: string, filePath: string) => {
    const form = new FormData()
    form.append('file', fs.createReadStream(filePath))
    const { data } = await axios.post(
      `${API}/modpacks/${packId}/mods`,
      form,
      { headers: { ...authHeader(), ...form.getHeaders() } }
    )
    return data
  })

  ipcMain.handle('modpacks:removeMod', async (_e, packId: string, modId: string) => {
    await axios.delete(`${API}/modpacks/${packId}/mods/${modId}`, { headers: authHeader() })
    return true
  })
}
