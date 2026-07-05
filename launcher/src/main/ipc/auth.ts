import { ipcMain, BrowserWindow, shell } from 'electron'
import { PublicClientApplication } from '@azure/msal-node'
import Store from 'electron-store'
import axios from 'axios'
import type { AuthTokens } from '../../shared/types'

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '5ff67b64-68cd-4547-b472-2ab00c27152f'
const API = process.env.API_URL || 'https://mc-api.daboismc.win'

const pca = new PublicClientApplication({
  auth: { clientId: AZURE_CLIENT_ID, authority: 'https://login.microsoftonline.com/consumers' }
})

const store = new Store<{ tokens?: AuthTokens }>()

const SCOPES = ['XboxLive.signin', 'offline_access']

// Refresh if token has less than 5 minutes left
const REFRESH_BUFFER_MS = 5 * 60 * 1000

async function tryRefresh(): Promise<AuthTokens | null> {
  const existing = store.get('tokens') as AuthTokens | undefined
  if (!existing?.ms_home_account_id) return null

  try {
    // Find the account in MSAL's cache
    const accounts = await pca.getTokenCache().getAllAccounts()
    const account = accounts.find(a => a.homeAccountId === existing.ms_home_account_id)
    if (!account) return null

    // Silent — no browser popup, uses stored refresh token
    const result = await pca.acquireTokenSilent({
      scopes: SCOPES,
      account
    })
    if (!result) return null

    // Exchange for new MC token via backend
    const { data } = await axios.post(`${API}/auth/refresh`, {
      ms_access_token: result.accessToken
    })

    const tokens: AuthTokens = {
      access_token: data.token,
      mc_access_token: data.mc_access_token,
      mc_expires_at: Date.now() + (data.mc_expires_in * 1000),
      minecraft_username: data.minecraft_username,
      minecraft_uuid: data.minecraft_uuid,
      ms_home_account_id: existing.ms_home_account_id
    }
    store.set('tokens', tokens)
    console.log('[auth] Silently refreshed MC token')
    return tokens
  } catch (e) {
    console.error('[auth] Silent refresh failed:', e)
    return null
  }
}

/**
 * Public helper for other IPC handlers (like launch) to get a valid token,
 * refreshing automatically if needed. Returns null if user needs to sign in.
 */
export async function getValidTokens(): Promise<AuthTokens | null> {
  const existing = store.get('tokens') as AuthTokens | undefined
  if (!existing) return null

  const timeLeft = (existing.mc_expires_at || 0) - Date.now()
  if (timeLeft > REFRESH_BUFFER_MS) return existing

  console.log(`[auth] MC token expires in ${Math.round(timeLeft / 1000)}s, refreshing...`)
  const refreshed = await tryRefresh()
  return refreshed || existing  // fall back to existing token if refresh fails
}

export function authHandlers() {
  ipcMain.handle('auth:login', async () => {
    const win = BrowserWindow.getFocusedWindow()

    const result = await pca.acquireTokenByDeviceCode({
      scopes: SCOPES,
      deviceCodeCallback: (res) => {
        win?.webContents.send('auth:deviceCode', {
          userCode: res.userCode,
          verificationUri: res.verificationUri,
          message: res.message
        })
        shell.openExternal(res.verificationUri)
      }
    })

    if (!result) throw new Error('Login failed')

    const { data } = await axios.post(`${API}/auth/login`, {
      ms_access_token: result.accessToken
    })

    const tokens: AuthTokens = {
      access_token: data.token,
      mc_access_token: data.mc_access_token,
      mc_expires_at: Date.now() + (data.mc_expires_in * 1000),
      minecraft_username: data.minecraft_username,
      minecraft_uuid: data.minecraft_uuid,
      ms_home_account_id: result.account?.homeAccountId
    }
    store.set('tokens', tokens)
    return tokens
  })

  ipcMain.handle('auth:logout', async () => {
    // Clear MSAL cache so refresh tokens are truly gone
    const existing = store.get('tokens') as AuthTokens | undefined
    if (existing?.ms_home_account_id) {
      try {
        const cache = pca.getTokenCache()
        const accounts = await cache.getAllAccounts()
        for (const acc of accounts) {
          await cache.removeAccount(acc)
        }
      } catch (e) {
        console.error('[auth] Failed to clear MSAL cache:', e)
      }
    }
    store.delete('tokens')
    return true
  })

  ipcMain.handle('auth:getSession', async () => {
    // Auto-refresh on session check if needed
    return await getValidTokens()
  })
}
