import { ipcMain, dialog } from 'electron'
import axios from 'axios'
import * as fs from 'fs-extra'
import FormData from 'form-data'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'
import { getValidTokens } from './auth'

const store = new Store<{ tokens: AuthTokens }>()
const API = process.env.API_URL || 'https://mc-api.daboismc.win'
const MOJANG_API = 'https://api.minecraftservices.com'

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

  ipcMain.handle('account:pickSkinFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Skin PNG',
      filters: [{ name: 'Skin PNG', extensions: ['png'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Talks directly to Mojang's official skin API using the same Minecraft
  // access token the launcher already holds for game auth — no backend
  // involvement, since this writes to the user's real Minecraft account.
  ipcMain.handle('account:uploadSkin', async (_e, filePath: string, variant: 'classic' | 'slim') => {
    const tokens = await getValidTokens()
    if (!tokens) throw new Error('Not logged in')
    const form = new FormData()
    form.append('variant', variant)
    form.append('file', fs.createReadStream(filePath))
    await axios.post(`${MOJANG_API}/minecraft/profile/skins`, form, {
      headers: { Authorization: `Bearer ${tokens.mc_access_token}`, ...form.getHeaders() }
    })
    return true
  })
}
