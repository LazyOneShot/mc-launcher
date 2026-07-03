import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Auth
  login:              ()                                    => ipcRenderer.invoke('auth:login'),
  logout:             ()                                    => ipcRenderer.invoke('auth:logout'),
  getSession:         ()                                    => ipcRenderer.invoke('auth:getSession'),
  onDeviceCode:       (cb: (d: { userCode: string; verificationUri: string }) => void) =>
                        ipcRenderer.on('auth:deviceCode', (_e, d) => cb(d)),

  // Modpacks
  getModpack:         (id: string)                          => ipcRenderer.invoke('modpacks:get', id),
  listMyModpacks:     ()                                    => ipcRenderer.invoke('modpacks:listMine'),
  createModpack:      (meta: object)                        => ipcRenderer.invoke('modpacks:create', meta),
  updateModpack:      (id: string, data: object)            => ipcRenderer.invoke('modpacks:update', id, data),
  deleteModpack:      (id: string)                          => ipcRenderer.invoke('modpacks:delete', id),
  uploadMod:          (packId: string, fp: string)          => ipcRenderer.invoke('modpacks:uploadMod', packId, fp),
  removeMod:          (packId: string, modId: string)       => ipcRenderer.invoke('modpacks:removeMod', packId, modId),
  pickModFile:        ()                                    => ipcRenderer.invoke('modpacks:pickModFile'),

  // Members
  getMembers:         (packId: string)                      => ipcRenderer.invoke('members:get', packId),
  addMember:          (packId: string, username: string)    => ipcRenderer.invoke('members:add', packId, username),
  removeMember:       (packId: string, uuid: string)        => ipcRenderer.invoke('members:remove', packId, uuid),
  transferOwnership:  (packId: string, uuid: string)        => ipcRenderer.invoke('members:transfer', packId, uuid),

  // Launch
  syncAndLaunch:      (packId: string)                      => ipcRenderer.invoke('launch:syncAndLaunch', packId),
  onLaunchProgress:   (cb: (msg: string) => void)           => ipcRenderer.on('launch:progress', (_e, msg) => cb(msg))
})
