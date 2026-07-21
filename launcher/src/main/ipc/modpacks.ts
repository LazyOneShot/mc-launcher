import { ipcMain, dialog, BrowserWindow } from 'electron'
import axios from 'axios'
import Store from 'electron-store'
import * as fs from 'fs-extra'
import FormData from 'form-data'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens: AuthTokens }>()
const localOpts = new Store<{ launchOptions?: Record<string, any> }>({ name: 'launch-options' })

const API = process.env.API_URL || 'https://mc-api.daboismc.win'

function authHeader() {
  const t = store.get('tokens') as AuthTokens | undefined
  if (!t) throw new Error('Not logged in')
  return { Authorization: `Bearer ${t.access_token}` }
}

function progressToRenderer(win: BrowserWindow | null, evt: string, data: any) {
  win?.webContents.send(evt, data)
}

export function modpackHandlers() {
  ipcMain.handle('modpacks:get', async (_e, id: string) => {
    const { data } = await axios.get(`${API}/modpacks/${id}`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:listMine', async () => {
    const { data } = await axios.get(`${API}/modpacks/mine`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:listPublic', async () => {
    const { data } = await axios.get(`${API}/modpacks/public`)
    return data
  })

  ipcMain.handle('modpacks:create', async (_e, meta: object) => {
    const { data } = await axios.post(`${API}/modpacks`, meta, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:join', async (_e, id: string) => {
    const { data } = await axios.post(`${API}/modpacks/${id}/join`, {}, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:update', async (_e, id: string, updateData: object) => {
    const { data } = await axios.patch(`${API}/modpacks/${id}`, updateData, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:delete', async (_e, id: string) => {
    await axios.delete(`${API}/modpacks/${id}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('modpacks:leave', async (_e, id: string) => {
    await axios.post(`${API}/modpacks/${id}/leave`, {}, { headers: authHeader() })
    return true
  })

  ipcMain.handle('modpacks:listJoinRequests', async (_e, packId: string) => {
    const { data } = await axios.get(`${API}/modpacks/${packId}/join-requests`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:approveJoinRequest', async (_e, packId: string, requestId: string) => {
    const { data } = await axios.post(`${API}/modpacks/${packId}/join-requests/${requestId}/approve`, {}, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:denyJoinRequest', async (_e, packId: string, requestId: string) => {
    await axios.post(`${API}/modpacks/${packId}/join-requests/${requestId}/deny`, {}, { headers: authHeader() })
    return true
  })

  ipcMain.handle('modpacks:listMyJoinRequests', async () => {
    const { data } = await axios.get(`${API}/modpacks/requests/mine`, { headers: authHeader() })
    return data
  })

  ipcMain.handle('modpacks:cancelJoinRequest', async (_e, packId: string) => {
    await axios.delete(`${API}/modpacks/${packId}/join-requests/mine`, { headers: authHeader() })
    return true
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

  // Bulk upload — takes a list of file paths and streams progress events
  ipcMain.handle('modpacks:uploadModsBulk', async (event, packId: string, filePaths: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const total = filePaths.length
    const results: any[] = []
    let succeeded = 0
    let failed = 0

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const filename = filePath.split(/[\\/]/).pop() || filePath

      progressToRenderer(win, 'modpacks:bulkProgress', {
        current: i + 1,
        total,
        filename,
        succeeded,
        failed,
        status: 'uploading'
      })

      try {
        const form = new FormData()
        form.append('file', fs.createReadStream(filePath))
        const { data } = await axios.post(
          `${API}/modpacks/${packId}/mods`,
          form,
          { headers: { ...authHeader(), ...form.getHeaders() } }
        )
        results.push({ filename, success: true, mod: data })
        succeeded++
      } catch (e: any) {
        results.push({ filename, success: false, error: e?.response?.data?.detail || e.message })
        failed++
      }
    }

    progressToRenderer(win, 'modpacks:bulkProgress', {
      current: total,
      total,
      filename: '',
      succeeded,
      failed,
      status: 'done'
    })

    return { results, succeeded, failed, total }
  })

  ipcMain.handle('modpacks:removeMod', async (_e, packId: string, modId: string) => {
    await axios.delete(`${API}/modpacks/${packId}/mods/${modId}`, { headers: authHeader() })
    return true
  })

  ipcMain.handle('modpacks:pickModFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Mod JAR(s)',
      filters: [{ name: 'Mod JAR', extensions: ['jar'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle('launchOpts:get', (_e, packId: string) => {
    const all = localOpts.get('launchOptions', {}) as Record<string, any>
    return all[packId] || null
  })

  ipcMain.handle('launchOpts:set', (_e, packId: string, opts: any) => {
    const all = localOpts.get('launchOptions', {}) as Record<string, any>
    all[packId] = opts
    localOpts.set('launchOptions', all)
    return true
  })
}
