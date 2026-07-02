import { ipcMain, BrowserWindow, shell } from 'electron'
import { PublicClientApplication } from '@azure/msal-node'
import Store from 'electron-store'
import axios from 'axios'
import type { AuthTokens } from '../../shared/types'

const AZURE_CLIENT_ID = '5ff67b64-68cd-4547-b472-2ab00c27152f'
const API = process.env.API_URL || 'http://localhost:8000'

const pca = new PublicClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/consumers'
  }
})

const store = new Store<{
  tokens?: AuthTokens
}>()

export function authHandlers() {
  ipcMain.handle('auth:login', async () => {
    const win = BrowserWindow.getFocusedWindow()

    const result = await pca.acquireTokenByDeviceCode({
      scopes: ['XboxLive.signin', 'offline_access'],
      deviceCodeCallback: (res) => {
        // Send the code + URL to the renderer so we can show it in the UI
        win?.webContents.send('auth:deviceCode', {
          userCode: res.userCode,
          verificationUri: res.verificationUri,
          message: res.message
        })

        // Also pop open the browser automatically
        shell.openExternal(res.verificationUri)
      }
    })

    if (!result) {
      throw new Error('Login failed')
    }

    const { data } = await axios.post(`${API}/auth/login`, {
      ms_access_token: result.accessToken
    })

    const tokens: AuthTokens = {
      access_token: data.token,
      minecraft_username: data.minecraft_username,
      minecraft_uuid: data.minecraft_uuid
    }

    store.set('tokens', tokens)

    return tokens
  })

  ipcMain.handle('auth:logout', () => {
    store.delete('tokens')
    return true
  })

  ipcMain.handle('auth:getSession', () => {
    return store.get('tokens')
  })
}