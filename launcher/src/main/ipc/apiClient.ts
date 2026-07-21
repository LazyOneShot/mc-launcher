import axios from 'axios'
import { BrowserWindow } from 'electron'
import Store from 'electron-store'
import type { AuthTokens } from '../../shared/types'

const store = new Store<{ tokens?: AuthTokens }>()

// Any backend call that comes back 401 means the JWT is no longer valid
// (secret rotated, corrupt store, etc). Clear it and bounce the renderer
// to /login instead of leaving every call site to fail silently.
export function installAuthInterceptor() {
  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error?.response?.status === 401) {
        store.delete('tokens')
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('auth:sessionExpired')
        }
      }
      return Promise.reject(error)
    }
  )
}
