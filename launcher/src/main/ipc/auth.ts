import { ipcMain } from 'electron'
import { PublicClientApplication } from '@azure/msal-node'
import Store from 'electron-store'
import axios from 'axios'
import type { AuthTokens } from '../../shared/types'

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID'
const API = process.env.API_URL || 'https://api.harv.com/mc'

const pca = new PublicClientApplication({
  auth: { clientId: AZURE_CLIENT_ID, authority: 'https://login.microsoftonline.com/consumers' }
})

const store = new Store<{ tokens: AuthTokens }>()

export function authHandlers() {
  ipcMain.handle('auth:login', async () => {
    // Device-code flow: opens browser for user to sign in with Microsoft
    const result = await pca.acquireTokenByDeviceCode({
      scopes: ['XboxLive.signin', 'offline_access'],
      deviceCodeCallback: (res) => {
        // TODO: show res.userCode + res.verificationUri in the renderer
        console.log(res.message)
      }
    })

    if (!result) throw new Error('Login failed')

    // Our backend does the Xbox → XSTS → Minecraft token exchange
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

  ipcMain.handle('auth:logout', () => { store.delete('tokens'); return true })
  ipcMain.handle('auth:getSession', () => store.get('tokens', null))
}
