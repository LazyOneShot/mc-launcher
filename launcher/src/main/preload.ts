import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  login:          ()                          => ipcRenderer.invoke('auth:login'),
  logout:         ()                          => ipcRenderer.invoke('auth:logout'),
  getSession:     ()                          => ipcRenderer.invoke('auth:getSession'),

  getModpack:     (id: string)                => ipcRenderer.invoke('modpacks:get', id),
  listMyModpacks: ()                          => ipcRenderer.invoke('modpacks:listMine'),
  createModpack:  (meta: object)              => ipcRenderer.invoke('modpacks:create', meta),
  uploadMod:      (packId: string, fp: string) => ipcRenderer.invoke('modpacks:uploadMod', packId, fp),
  removeMod:      (packId: string, modId: string) => ipcRenderer.invoke('modpacks:removeMod', packId, modId),

  syncAndLaunch:  (packId: string)            => ipcRenderer.invoke('launch:syncAndLaunch', packId),
  onLaunchProgress: (cb: (msg: string) => void) => ipcRenderer.on('launch:progress', (_e, msg) => cb(msg)),
  onDeviceCode: (cb: (data: { userCode: string; verificationUri: string }) => void) =>
  ipcRenderer.on('auth:deviceCode', (_e, data) => cb(data)),
})
