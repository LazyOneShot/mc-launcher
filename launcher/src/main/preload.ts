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
  joinModpack:        (id: string)                          => ipcRenderer.invoke('modpacks:join', id),
  updateModpack:      (id: string, data: object)            => ipcRenderer.invoke('modpacks:update', id, data),
  deleteModpack:      (id: string)                          => ipcRenderer.invoke('modpacks:delete', id),
  uploadMod:          (packId: string, fp: string)          => ipcRenderer.invoke('modpacks:uploadMod', packId, fp),
  uploadModsBulk:     (packId: string, fps: string[])       => ipcRenderer.invoke('modpacks:uploadModsBulk', packId, fps),
  onBulkUploadProgress: (cb: (d: any) => void)              => ipcRenderer.on('modpacks:bulkProgress', (_e, d) => cb(d)),
  removeMod:          (packId: string, modId: string)       => ipcRenderer.invoke('modpacks:removeMod', packId, modId),
  pickModFile:        ()                                    => ipcRenderer.invoke('modpacks:pickModFile'),

  // Local launch options
  getLaunchOptions:   (packId: string)                      => ipcRenderer.invoke('launchOpts:get', packId),
  setLaunchOptions:   (packId: string, opts: any)           => ipcRenderer.invoke('launchOpts:set', packId, opts),

  // Members
  getMembers:         (packId: string)                      => ipcRenderer.invoke('members:get', packId),
  addMember:          (packId: string, username: string)    => ipcRenderer.invoke('members:add', packId, username),
  changeRole:         (packId: string, uuid: string, role: string) => ipcRenderer.invoke('members:changeRole', packId, uuid, role),
  removeMember:       (packId: string, uuid: string)        => ipcRenderer.invoke('members:remove', packId, uuid),
  transferOwnership:  (packId: string, uuid: string)        => ipcRenderer.invoke('members:transfer', packId, uuid),

  // Servers
  listServers:        (packId: string)                      => ipcRenderer.invoke('servers:list', packId),
  addServer:          (packId: string, server: object)      => ipcRenderer.invoke('servers:add', packId, server),
  updateServer:       (packId: string, id: string, patch: object) => ipcRenderer.invoke('servers:update', packId, id, patch),
  deleteServer:       (packId: string, id: string)          => ipcRenderer.invoke('servers:delete', packId, id),

  // Versions
  getMcVersions:      ()                                    => ipcRenderer.invoke('versions:mc'),
  getForgeVersions:   (mc: string)                          => ipcRenderer.invoke('versions:forge', mc),
  getLatestForge:     (mc: string)                          => ipcRenderer.invoke('versions:forge:latest', mc),

  // Launch
  syncAndLaunch:      (packId: string, extras?: object)     => ipcRenderer.invoke('launch:syncAndLaunch', packId, extras || {}),
  onLaunchProgress:   (cb: (msg: string) => void)           => ipcRenderer.on('launch:progress', (_e, msg) => cb(msg)),

  // Updater
  checkForUpdate:     ()                                    => ipcRenderer.invoke('update:check'),
  downloadUpdate:     ()                                    => ipcRenderer.invoke('update:download'),
  installUpdate:      ()                                    => ipcRenderer.invoke('update:install'),
  currentVersion:     ()                                    => ipcRenderer.invoke('update:currentVersion'),
  updateSupported:    ()                                    => ipcRenderer.invoke('update:isSupported'),
  startPeriodicCheck: ()                                    => ipcRenderer.invoke('update:startPeriodicCheck'),
  stopPeriodicCheck:  ()                                    => ipcRenderer.invoke('update:stopPeriodicCheck'),
  onUpdateChecking:   (cb: () => void)                      => ipcRenderer.on('update:checking', () => cb()),
  onUpdateAvailable:  (cb: (d: any) => void)                => ipcRenderer.on('update:available', (_e, d) => cb(d)),
  onUpdateProgress:   (cb: (d: any) => void)                => ipcRenderer.on('update:progress', (_e, d) => cb(d)),
  onUpdateDownloaded: (cb: (d: any) => void)                => ipcRenderer.on('update:downloaded', (_e, d) => cb(d)),
  onUpdateError:      (cb: (d: any) => void)                => ipcRenderer.on('update:error', (_e, d) => cb(d)),
  onUpdateNone:       (cb: () => void)                      => ipcRenderer.on('update:none', () => cb()),

  // Window controls
  minimizeWindow:     ()                                    => ipcRenderer.invoke('window:minimize'),
  maximizeWindow:     ()                                    => ipcRenderer.invoke('window:maximize'),
  closeWindow:        ()                                    => ipcRenderer.invoke('window:close'),
  isMaximized:        ()                                    => ipcRenderer.invoke('window:isMaximized'),
  useCustomTitleBar:  ()                                    => ipcRenderer.invoke('window:useCustomTitleBar'),

  // Modrinth
  modrinthSearch:   (q: string, mc: string, loader: string, offset?: number)              => ipcRenderer.invoke('modrinth:search', q, mc, loader, offset || 0),
  modrinthVersions: (projectId: string, mc: string, loader: string)                       => ipcRenderer.invoke('modrinth:versions', projectId, mc, loader),
  modrinthInstall:  (packId: string, url: string, filename: string)                       => ipcRenderer.invoke('modrinth:install', packId, url, filename)
})
