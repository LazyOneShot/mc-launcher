import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { PublicClientApplication, ICachePlugin, TokenCacheContext } from '@azure/msal-node'
import Store from 'electron-store'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import type { AuthTokens } from '../../shared/types'

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '5ff67b64-68cd-4547-b472-2ab00c27152f'
const API = process.env.API_URL || 'https://mc-api.daboismc.win'

const SCOPES = ['XboxLive.signin', 'offline_access']
const REFRESH_BUFFER_MS = 5 * 60 * 1000

const store = new Store<{ tokens?: AuthTokens }>()

// ── MSAL token cache persistence ──────────────────────────────────────────────
// Save MSAL's cache to disk so refresh tokens survive app restarts.
const cacheFilePath = path.join(app.getPath('userData'), 'msal-cache.json')

const cachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx: TokenCacheContext) {
    if (fs.existsSync(cacheFilePath)) {
      try {
        const data = fs.readFileSync(cacheFilePath, 'utf-8')
        ctx.tokenCache.deserialize(data)
      } catch (e) {
        console.error('[auth] Failed to read MSAL cache:', e)
      }
    }
  },
  async afterCacheAccess(ctx: TokenCacheContext) {
    if (ctx.cacheHasChanged) {
      try {
        fs.writeFileSync(cacheFilePath, ctx.tokenCache.serialize(), 'utf-8')
      } catch (e) {
        console.error('[auth] Failed to write MSAL cache:', e)
      }
    }
  }
}

const pca = new PublicClientApplication({
  auth: { clientId: AZURE_CLIENT_ID, authority: 'https://login.microsoftonline.com/consumers' },
  cache: { cachePlugin }
})

async function tryRefresh(): Promise<AuthTokens | null> {
  const existing = store.get('tokens') as AuthTokens | undefined
  if (!existing?.ms_home_account_id) {
    console.log('[auth] No stored home_account_id, cannot refresh')
    return null
  }

  try {
    const accounts = await pca.getTokenCache().getAllAccounts()
    console.log(`[auth] MSAL cache has ${accounts.length} accounts`)
    const account = accounts.find(a => a.homeAccountId === existing.ms_home_account_id)
    if (!account) {
      console.log('[auth] Account not found in MSAL cache')
      return null
    }

    const result = await pca.acquireTokenSilent({ scopes: SCOPES, account })
    if (!result) return null

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

export async function getValidTokens(): Promise<AuthTokens | null> {
  const existing = store.get('tokens') as AuthTokens | undefined
  if (!existing) return null

  const timeLeft = (existing.mc_expires_at || 0) - Date.now()
  if (timeLeft > REFRESH_BUFFER_MS) return existing

  console.log(`[auth] MC token expires in ${Math.round(timeLeft / 1000)}s, refreshing...`)
  const refreshed = await tryRefresh()
  return refreshed || existing
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
    // Also nuke the on-disk cache file
    try {
      if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath)
    } catch {}
    return true
  })

  ipcMain.handle('auth:getSession', async () => {
    return await getValidTokens()
  })
}