import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ModpackFull, ModpackServer, AuditEntry, JoinRequest } from '../../shared/types'
import ModrinthBrowser from '../components/ModrinthBrowser'
import UpdateChecker from '../components/UpdateChecker'
import ReportModal from '../components/ReportModal'

interface Member {
  id: string
  minecraft_uuid: string
  minecraft_username: string
  role: string
}

interface LaunchOptions {
  min_ram: string; max_ram: string; jvm_args: string; java_path: string
}

interface BulkProgress {
  current: number; total: number; filename: string
  succeeded: number; failed: number; status: 'uploading' | 'done'
}

const LOADERS = ['neoforge', 'forge', 'fabric']
const RAM_OPTIONS = ['1G', '2G', '3G', '4G', '6G', '8G', '12G', '16G']
const FALLBACK_MC_VERSIONS = ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2']
const AIKARS_FLAGS = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1'

type Tab = 'mods' | 'servers' | 'members' | 'activity' | 'settings'

const ACTION_LABELS: Record<string, string> = {
  'pack.create':        'created the pack',
  'pack.update':        'changed pack settings',
  'pack.transfer':      'transferred ownership to',
  'mod.add':            'added mod',
  'mod.remove':         'removed mod',
  'mod.update':         'updated mod',
  'member.add':         'added member',
  'member.remove':      'removed member',
  'member.join':        'joined the pack',
  'member.leave':       'left the pack',
  'member.request':     'requested to join',
  'member.approve':     'approved join request for',
  'member.deny':        'denied join request for',
  'member.role_change': 'changed role for',
  'server.add':         'added server',
  'server.remove':      'removed server',
  'server.update':      'edited server'
}

function actionColor(action: string): string {
  if (action.endsWith('.remove') || action === 'member.leave' || action === 'member.deny') return '#f87171'
  if (action.endsWith('.add') || action === 'member.join' || action === 'member.approve') return '#4ade80'
  if (action === 'member.request') return '#fbbf24'
  if (action.endsWith('.update') || action.endsWith('.role_change')) return '#fbbf24'
  if (action === 'pack.transfer') return '#c084fc'
  return '#8888aa'
}

function timeAgo(iso: string): string {
  // Backend stores naive UTC. Without the Z, the browser reads it as local time
  // and every entry looks hours off.
  const then = new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
  const secs = Math.floor((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`
  return new Date(then).toLocaleDateString()
}

export default function PackDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [pack, setPack] = useState<ModpackFull | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [servers, setServers] = useState<ModpackServer[]>([])
  const [serverStatus, setServerStatus] = useState<Record<string, { online: boolean; players?: { online: number; max: number } }>>({})
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null)
  const [newMember, setNewMember] = useState('')
  const [memberError, setMemberError] = useState('')
  const [session, setSession] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('mods')
  const [modSearch, setModSearch] = useState('')
  const [editForm, setEditForm] = useState({ name: '', description: '', mc_version: '', loader: '', loader_version: '', visibility: 'private', join_mode: 'open' })
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [joinRequestsLoaded, setJoinRequestsLoaded] = useState(false)
  const [launchOpts, setLaunchOpts] = useState<LaunchOptions>({ min_ram: '2G', max_ram: '4G', jvm_args: '', java_path: '' })
  const [savedMsg, setSavedMsg] = useState('')
  const [mcVersions, setMcVersions] = useState<string[]>(FALLBACK_MC_VERSIONS)
  const [forgeVersions, setForgeVersions] = useState<string[]>([])
  const [loadingForge, setLoadingForge] = useState(false)
  const [newServer, setNewServer] = useState({ name: '', host: '', port: 25565 })
  const [serverError, setServerError] = useState('')
  const [showModrinth, setShowModrinth] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ kind: 'pack' } | { kind: 'member'; uuid: string; name: string } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set())
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; filename: string } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    window.api.getModpack(id).then((p: any) => {
      setPack(p)
      setEditForm({ name: p.name, description: p.description, mc_version: p.mc_version, loader: p.loader, loader_version: p.loader_version, visibility: p.visibility, join_mode: p.join_mode })
    })
    window.api.getMembers(id).then(setMembers)
    window.api.listServers(id).then(setServers)
    window.api.getSession().then(setSession)
    window.api.getLaunchOptions(id).then((opts: LaunchOptions | null) => { if (opts) setLaunchOpts(opts) })
    window.api.onLaunchProgress((msg: string) => setLog(l => [...l, msg]))
    window.api.onSyncProgress((d: any) => setSyncProgress(d))
    window.api.onBulkUploadProgress((p: BulkProgress) => setBulkProgress(p))
    window.api.getMcVersions().then((vs: string[]) => { if (vs?.length > 0) setMcVersions(vs) })
  }, [id])

  // Keep mods/members/servers fresh while someone's sitting on the page —
  // deliberately doesn't touch editForm so it can't clobber an in-progress edit.
  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      window.api.getModpack(id).then((p: any) => setPack(pk => pk ? { ...pk, ...p } : p))
      window.api.getMembers(id).then(setMembers)
      window.api.listServers(id).then(setServers)
    }, 30000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    if (!editForm.mc_version || editForm.loader !== 'forge') { setForgeVersions([]); return }
    setLoadingForge(true)
    window.api.getForgeVersions(editForm.mc_version).then((vs: string[]) => {
      setForgeVersions(vs); setLoadingForge(false)
    })
  }, [editForm.mc_version, editForm.loader])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const isOwner = pack && session && pack.owner === session.minecraft_uuid
  const myMembership = members.find(m => session && m.minecraft_uuid === session.minecraft_uuid)
  const myRole = isOwner ? 'owner' : myMembership?.role || 'viewer'
  const canEdit = myRole === 'owner' || myRole === 'editor'

  // Ping each server whenever the tab is opened (including switching back to it).
  useEffect(() => {
    if (tab !== 'servers') return
    servers.forEach(s => {
      window.api.pingServer(s.host, s.port).then((res: any) => {
        setServerStatus(prev => ({ ...prev, [s.id]: res }))
      })
    })
  }, [tab, servers])

  // Only fetch the log when the tab is actually opened.
  useEffect(() => {
    if (tab !== 'activity' || !id || !canEdit || auditLoaded) return
    window.api.getAudit(id).then((rows: AuditEntry[]) => {
      setAudit(rows)
      setAuditLoaded(true)
    }).catch(() => setAuditLoaded(true))
  }, [tab, id, canEdit, auditLoaded])

  useEffect(() => {
    if (tab !== 'members' || !id || !isOwner || pack?.join_mode !== 'request' || joinRequestsLoaded) return
    window.api.listJoinRequests(id).then((rows: JoinRequest[]) => {
      setJoinRequests(rows)
      setJoinRequestsLoaded(true)
    }).catch(() => setJoinRequestsLoaded(true))
  }, [tab, id, isOwner, pack?.join_mode, joinRequestsLoaded])

  const refreshPack = async () => {
    if (!id) return
    const fresh: any = await window.api.getModpack(id)
    setPack(fresh)
    setAuditLoaded(false)   // the action we just took belongs in the log
  }

  const handleLaunch = async (server?: ModpackServer) => {
    if (!id) return
    setLaunching(true); setLog([]); setSyncProgress(null)
    try {
      const extras = server ? { serverHost: server.host, serverPort: server.port } : {}
      await window.api.syncAndLaunch(id, extras)
    } catch (e: any) {
      setLog(l => [...l, `Error: ${e.message || e}`])
    }
    setSyncProgress(null)
    setLaunching(false)
  }

  const handleRemoveMod = async (modId: string, filename: string) => {
    if (!id || !confirm(`Remove "${filename}" from this pack?`)) return
    await window.api.removeMod(id, modId)
    setPack(p => p ? { ...p, mods: p.mods.filter(m => m.id !== modId) } : p)
    setSelectedMods(s => { const next = new Set(s); next.delete(modId); return next })
    setAuditLoaded(false)
  }

  const handleRemoveSelected = async () => {
    if (!id || selectedMods.size === 0) return
    if (!confirm(`Remove ${selectedMods.size} mod${selectedMods.size === 1 ? '' : 's'} from this pack?`)) return
    const ids = Array.from(selectedMods)
    for (const modId of ids) {
      await window.api.removeMod(id, modId)
    }
    setPack(p => p ? { ...p, mods: p.mods.filter(m => !selectedMods.has(m.id)) } : p)
    setSelectedMods(new Set())
    setAuditLoaded(false)
  }

  const toggleModSelected = (modId: string) => {
    setSelectedMods(s => {
      const next = new Set(s)
      if (next.has(modId)) next.delete(modId); else next.add(modId)
      return next
    })
  }

  const handleUpload = async () => {
    if (!id) return
    const filePaths: string[] = await window.api.pickModFile()
    if (filePaths.length === 0) return
    setBulkProgress({ current: 0, total: filePaths.length, filename: '', succeeded: 0, failed: 0, status: 'uploading' })
    const result = await window.api.uploadModsBulk(id, filePaths)
    await refreshPack()
    if (result.failed === 0) setTimeout(() => setBulkProgress(null), 3000)
  }

  const handleDownloadMod = async (filename: string, url: string) => {
    setDownloading(filename)
    try {
      await window.api.downloadMod(filename, url)
    } catch {
      // user cancelled, or the presigned URL expired — nothing worth surfacing
    }
    setDownloading(null)
  }

  const handleSaveSettings = async () => {
    if (!id) return
    if (isOwner) {
      const updated: any = await window.api.updateModpack(id, editForm)
      setPack(p => p ? { ...p, ...updated } : p)
      setAuditLoaded(false)
    }
    await window.api.setLaunchOptions(id, launchOpts)
    setSavedMsg('Saved!')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const handleDelete = async () => {
    if (!id || !confirm(`Delete "${pack?.name}"? This permanently removes all mods.`)) return
    await window.api.deleteModpack(id)
    nav('/home')
  }

  const handleLeave = async () => {
    if (!id || !confirm(`Leave "${pack?.name}"?`)) return
    await window.api.leaveModpack(id)
    nav('/home')
  }

  const submitReport = async (reason: string) => {
    if (!id || !reportTarget) return
    if (reportTarget.kind === 'pack') {
      await window.api.reportPack(id, reason)
    } else {
      await window.api.reportMember(id, reportTarget.uuid, reason)
    }
  }

  const handleAddServer = async () => {
    if (!id || !newServer.name.trim() || !newServer.host.trim()) return
    setServerError('')
    try {
      const s = await window.api.addServer(id, {
        name: newServer.name.trim(),
        host: newServer.host.trim(),
        port: newServer.port || 25565
      })
      setServers(ss => [...ss, s])
      setNewServer({ name: '', host: '', port: 25565 })
      setAuditLoaded(false)
    } catch (e: any) {
      setServerError(e?.response?.data?.detail || 'Failed to add server')
    }
  }

  const handleDeleteServer = async (serverId: string) => {
    if (!id) return
    await window.api.deleteServer(id, serverId)
    setServers(ss => ss.filter(s => s.id !== serverId))
    setAuditLoaded(false)
  }

  const handleAddMember = async () => {
    if (!id || !newMember.trim()) return
    setMemberError('')
    try {
      const m = await window.api.addMember(id, newMember.trim())
      setMembers(mm => [...mm, m])
      setNewMember('')
      setAuditLoaded(false)
    } catch (e: any) {
      setMemberError(e?.response?.data?.detail || 'Failed to add member')
    }
  }

  const handleChangeRole = async (uuid: string, role: string) => {
    if (!id) return
    const updated: any = await window.api.changeRole(id, uuid, role)
    setMembers(mm => mm.map(m => m.minecraft_uuid === uuid ? { ...m, role: updated.role } : m))
    setAuditLoaded(false)
  }

  const handleRemoveMember = async (uuid: string) => {
    if (!id) return
    await window.api.removeMember(id, uuid)
    setMembers(mm => mm.filter(m => m.minecraft_uuid !== uuid))
    setAuditLoaded(false)
  }

  const handleTransfer = async (uuid: string, username: string) => {
    if (!id || !confirm(`Transfer ownership to ${username}?`)) return
    await window.api.transferOwnership(id, uuid)
    setPack(p => p ? { ...p, owner: uuid } : p)
    setAuditLoaded(false)
  }

  const handleApproveRequest = async (req: JoinRequest) => {
    if (!id) return
    const member: any = await window.api.approveJoinRequest(id, req.id)
    setMembers(mm => [...mm, member])
    setJoinRequests(rr => rr.filter(r => r.id !== req.id))
    setAuditLoaded(false)
  }

  const handleDenyRequest = async (req: JoinRequest) => {
    if (!id) return
    await window.api.denyJoinRequest(id, req.id)
    setJoinRequests(rr => rr.filter(r => r.id !== req.id))
    setAuditLoaded(false)
  }

  if (!pack) return <div className="page">Loading...</div>

  const filteredMods = pack.mods.filter(m => m.filename.toLowerCase().includes(modSearch.toLowerCase()))

  return (
    <div className="page">
      <button onClick={() => nav('/home')} className="back-link">← Back</button>

      <div className="pack-header">
        <div>
          <h1>{pack.name}</h1>
          <p className="pack-meta">
            {pack.mc_version} • {pack.loader} {pack.loader_version || <span style={{ color:'#6b6b8a' }}>(latest)</span>}
            <span className="badge" style={{ marginLeft:8 }}>{myRole}</span>
          </p>
          {pack.description && <p style={{ color:'#8888aa', fontSize:13, marginTop:4, marginBottom:6 }}>{pack.description}</p>}
          <p className="pack-id">
            Pack ID: <strong>{pack.id}</strong>
            <button className="icon-btn" title="Copy pack ID" style={{ marginLeft:6, padding:'2px 4px' }}
              onClick={() => navigator.clipboard.writeText(pack.id)}>⧉</button>
          </p>
        </div>
        <button onClick={() => setReportTarget({ kind: 'pack' })} className="icon-btn" title="Report this pack">⚑</button>
      </div>

      <div className="action-bar" style={{ flexWrap:'wrap' }}>
        <button onClick={() => handleLaunch()} disabled={launching} className="btn btn-play">
          {launching ? 'Syncing & Launching...' : '▶  Play'}
        </button>
        {servers.map(s => (
          <button key={s.id} onClick={() => handleLaunch(s)} disabled={launching} className="btn btn-play"
            style={{ background: 'linear-gradient(135deg, #4a7ce8 0%, #6366f1 100%)' }}>
            {launching ? '...' : `▶  ${s.name}`}
          </button>
        ))}
      </div>

      {syncProgress && syncProgress.total > 0 && syncProgress.current < syncProgress.total && (
        <div style={{ marginBottom:12, padding:'10px 14px', background:'#0d0e1e', border:'1px solid #22243d', borderRadius:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
            <span style={{ color:'#a5b4fc' }}>
              Syncing mods — {syncProgress.current} of {syncProgress.total} — {syncProgress.filename}
            </span>
            <span style={{ color:'#6b6b8a' }}>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
          </div>
          <div style={{ width:'100%', height:6, background:'#22243d', borderRadius:3, overflow:'hidden' }}>
            <div style={{
              width: `${(syncProgress.current / syncProgress.total) * 100}%`,
              height:'100%', background:'#4a7ce8', transition:'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="log-console" ref={logRef} style={{ marginBottom:24 }}>
          {log.map((l, i) => (
            <div key={i} className={`log-line ${l.toLowerCase().includes('error') ? 'error' : ''}`}>{l}</div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:2, borderBottom:'1px solid #22243d', marginBottom:16 }}>
        {(['mods', 'servers', 'members', 'activity', 'settings'] as Tab[]).filter(t => t !== 'activity' || canEdit).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding:'10px 20px', background:'none', border:'none',
              borderBottom: tab === t ? '2px solid #4a7ce8' : '2px solid transparent',
              color: tab === t ? '#fff' : '#8888aa',
              cursor:'pointer', textTransform:'capitalize', fontSize:14, fontWeight:600
            }}>
            {t} {t === 'mods' && `(${pack.mods.length})`}
            {t === 'servers' && `(${servers.length})`}
            {t === 'members' && `(${members.length + 1})`}
          </button>
        ))}
      </div>

      {/* MODS */}
      {tab === 'mods' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input className="input" style={{ flex:1 }} placeholder="Search mods..." value={modSearch} onChange={e => setModSearch(e.target.value)} />
            {canEdit && (
              <>
                <button onClick={() => setShowUpdates(true)} className="btn btn-secondary"
                  disabled={pack.mods.length === 0}>
                  Check Updates
                </button>
                <button onClick={() => setShowModrinth(true)} className="btn btn-secondary">
                  Browse Modrinth
                </button>
                <button onClick={handleUpload} disabled={bulkProgress?.status === 'uploading'} className="btn btn-primary">
                  {bulkProgress?.status === 'uploading' ? 'Uploading...' : '+ Upload'}
                </button>
                {selectedMods.size > 0 && (
                  <button onClick={handleRemoveSelected} className="btn btn-danger">
                    Remove Selected ({selectedMods.size})
                  </button>
                )}
              </>
            )}
          </div>

          {bulkProgress && (
            <div style={{ marginBottom:12, padding:'10px 14px', background:'#0d0e1e', border:'1px solid #22243d', borderRadius:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                <span style={{ color:'#a5b4fc' }}>
                  {bulkProgress.status === 'done'
                    ? `Done — ${bulkProgress.succeeded} succeeded${bulkProgress.failed ? `, ${bulkProgress.failed} failed` : ''}`
                    : `${bulkProgress.current} of ${bulkProgress.total} — ${bulkProgress.filename}`
                  }
                </span>
                <span style={{ color:'#6b6b8a' }}>{Math.round((bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}%</span>
              </div>
              <div style={{ width:'100%', height:6, background:'#22243d', borderRadius:3, overflow:'hidden' }}>
                <div style={{
                  width: `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%`,
                  height:'100%',
                  background: bulkProgress.status === 'done'
                    ? (bulkProgress.failed > 0 ? '#f59e0b' : '#22c55e')
                    : '#4a7ce8',
                  transition:'width 0.3s'
                }} />
              </div>
            </div>
          )}

          {canEdit && filteredMods.length > 0 && (
            <label style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, fontSize:12, color:'#8888aa', cursor:'pointer' }}>
              <input type="checkbox"
                checked={filteredMods.every(m => selectedMods.has(m.id))}
                onChange={e => setSelectedMods(e.target.checked ? new Set(filteredMods.map(m => m.id)) : new Set())} />
              Select all
            </label>
          )}

          <div className="mod-list-container">
            {filteredMods.map(mod => (
              <div key={mod.id} className="mod-row">
                <span className="mod-filename" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {canEdit && (
                    <input type="checkbox" checked={selectedMods.has(mod.id)} onChange={() => toggleModSelected(mod.id)} />
                  )}
                  {mod.filename}
                </span>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ color:'#6b6b8a', fontSize:11 }}>{(mod.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  <button className="icon-btn" title="Download"
                    disabled={downloading === mod.filename}
                    onClick={() => handleDownloadMod(mod.filename, mod.download_url)}>
                    {downloading === mod.filename
                      ? '…'
                      : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ display:'block' }}>
                          <path d="M8 1v9M8 10L4.5 6.5M8 10l3.5-3.5M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    }
                  </button>
                  {canEdit && (
                    <button className="icon-btn" title="Remove" onClick={() => handleRemoveMod(mod.id, mod.filename)}>✕</button>
                  )}
                </div>
              </div>
            ))}
            {filteredMods.length === 0 && (
              <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>
                {pack.mods.length === 0 ? 'No mods yet.' : 'No mods match your search.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SERVERS */}
      {tab === 'servers' && (
        <div>
          {canEdit && (
            <div className="card" style={{ marginBottom:16 }}>
              <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:12 }}>ADD SERVER</h3>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:2 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Server Name</label>
                  <input className="input" value={newServer.name}
                    onChange={e => setNewServer(s => ({ ...s, name: e.target.value }))}
                    placeholder="e.g. Main SMP" />
                </div>
                <div style={{ flex:3 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Host</label>
                  <input className="input" value={newServer.host}
                    onChange={e => setNewServer(s => ({ ...s, host: e.target.value }))}
                    placeholder="mc.example.com" />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Port</label>
                  <input className="input" type="number" value={newServer.port}
                    onChange={e => setNewServer(s => ({ ...s, port: parseInt(e.target.value) || 25565 }))} />
                </div>
                <button onClick={handleAddServer} className="btn btn-primary">Add</button>
              </div>
              {serverError && <p style={{ color:'#f87171', fontSize:13, marginTop:8 }}>{serverError}</p>}
            </div>
          )}

          {servers.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13, background:'#0d0e1e', border:'1px solid #22243d', borderRadius:8 }}>
              No servers added yet.{canEdit ? ' Add one above to enable one-click join buttons.' : ''}
            </div>
          )}

          {servers.map(s => {
            const status = serverStatus[s.id]
            return (
              <div key={s.id} className="member-row">
                <div>
                  <span style={{ fontWeight:600 }}>{s.name}</span>
                  <span style={{ color:'#8888aa', fontSize:12, marginLeft:8, fontFamily:'Consolas, monospace' }}>
                    {s.host}:{s.port}
                  </span>
                  <button className="icon-btn" title="Copy address" style={{ marginLeft:4, padding:'2px 4px' }}
                    onClick={() => navigator.clipboard.writeText(`${s.host}:${s.port}`)}>⧉</button>
                  {status && (
                    <span style={{
                      marginLeft:10, fontSize:11, fontWeight:600,
                      color: status.online ? '#4ade80' : '#6b6b8a'
                    }}>
                      ● {status.online ? `Online${status.players ? ` (${status.players.online}/${status.players.max})` : ''}` : 'Offline'}
                    </span>
                  )}
                </div>
                {canEdit && <button onClick={() => handleDeleteServer(s.id)} className="icon-btn">✕</button>}
              </div>
            )
          })}
        </div>
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <div>
          {isOwner && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <input className="input" style={{ flex:1 }} placeholder="Minecraft username..." value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMember()} />
                <button onClick={handleAddMember} className="btn btn-primary">Add Editor</button>
              </div>
              {memberError && <p style={{ color:'#f87171', fontSize:13, marginBottom:10 }}>{memberError}</p>}
            </>
          )}

          {isOwner && pack.join_mode === 'request' && joinRequests.length > 0 && (
            <div className="card" style={{ marginBottom:16, borderColor:'#4a2f04' }}>
              <h3 style={{ fontSize:14, color:'#fbbf24', marginBottom:12 }}>PENDING REQUESTS ({joinRequests.length})</h3>
              {joinRequests.map(req => (
                <div key={req.id} className="member-row">
                  <span style={{ fontWeight:600 }}>{req.minecraft_username}</span>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => handleApproveRequest(req)} className="btn btn-success" style={{ padding:'6px 12px', fontSize:12 }}>Approve</button>
                    <button onClick={() => handleDenyRequest(req)} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>Deny</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="member-row" style={{ borderColor:'#4a7ce8' }}>
            <div>
              <span style={{ fontWeight:600 }}>
                {isOwner ? session?.minecraft_username : (pack.owner_username || 'Owner')}
              </span>
              <span className="badge" style={{ background:'#3b0764', color:'#c084fc' }}>owner</span>
            </div>
            {!isOwner && pack.owner && (
              <button className="icon-btn" title="Report this player"
                onClick={() => setReportTarget({ kind: 'member', uuid: pack.owner, name: pack.owner_username || 'the owner' })}>⚑</button>
            )}
          </div>

          {members.length === 0 && !isOwner && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>Just you and the owner.</div>
          )}

          {members.map(mem => (
            <div key={mem.id} className="member-row">
              <div>
                <span style={{ fontWeight:600 }}>{mem.minecraft_username}</span>
                <span className="badge">{mem.role}</span>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {isOwner && (
                  <>
                    {mem.role === 'viewer' ? (
                      <button onClick={() => handleChangeRole(mem.minecraft_uuid, 'editor')}
                        className="btn btn-success" style={{ padding:'6px 12px', fontSize:12 }}>Promote to Editor</button>
                    ) : (
                      <>
                        <button onClick={() => handleChangeRole(mem.minecraft_uuid, 'viewer')}
                          className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>Demote to Viewer</button>
                        <button onClick={() => handleTransfer(mem.minecraft_uuid, mem.minecraft_username)}
                          className="btn btn-warning" style={{ padding:'6px 12px', fontSize:12 }}>Transfer Ownership</button>
                      </>
                    )}
                    <button onClick={() => handleRemoveMember(mem.minecraft_uuid)} className="icon-btn">✕</button>
                  </>
                )}
                {session && mem.minecraft_uuid !== session.minecraft_uuid && (
                  <button className="icon-btn" title="Report this player"
                    onClick={() => setReportTarget({ kind: 'member', uuid: mem.minecraft_uuid, name: mem.minecraft_username })}>⚑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTIVITY */}
      {tab === 'activity' && canEdit && (
        <div>
          {!auditLoaded && (
            <p style={{ color:'#6b6b8a', fontSize:13, textAlign:'center', padding:24 }}>Loading activity...</p>
          )}
          {auditLoaded && audit.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13, background:'#0d0e1e', border:'1px solid #22243d', borderRadius:8 }}>
              Nothing here yet. Actions taken from now on will show up.
            </div>
          )}
          {audit.map(e => (
            <div key={e.id} style={{
              display:'flex', alignItems:'baseline', gap:8,
              padding:'10px 12px', borderBottom:'1px solid #1a1b30', fontSize:13
            }}>
              <span style={{ fontWeight:600, minWidth:0 }}>{e.actor_username}</span>
              <span style={{ color: actionColor(e.action) }}>
                {ACTION_LABELS[e.action] || e.action}
              </span>
              {e.target && (
                <span style={{ color:'#e0e0e0', fontFamily:'Consolas, monospace', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {e.target}
                </span>
              )}
              {e.detail && <span style={{ color:'#6b6b8a', fontSize:11 }}>({e.detail})</span>}
              <span style={{ marginLeft:'auto', color:'#4a4a63', fontSize:11, flexShrink:0 }}>
                {timeAgo(e.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {isOwner && (
            <div className="card">
              <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:14 }}>PACK INFO <span style={{ color:'#6b6b8a', fontWeight:'normal', fontSize:12 }}>(shared)</span></h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Pack Name</label>
                  <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Description</label>
                  <input className="input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>MC Version</label>
                    <select className="select" value={editForm.mc_version} onChange={e => setEditForm(f => ({ ...f, mc_version: e.target.value, loader_version: '' }))}>
                      {mcVersions.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Loader</label>
                    <select className="select" value={editForm.loader} onChange={e => setEditForm(f => ({ ...f, loader: e.target.value, loader_version: '' }))}>
                      {LOADERS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>
                      Loader Version <span style={{ color:'#6b6b8a' }}>(blank = latest)</span>
                    </label>
                    {editForm.loader === 'forge' && forgeVersions.length > 0 ? (
                      <select className="select" value={editForm.loader_version} onChange={e => setEditForm(f => ({ ...f, loader_version: e.target.value }))}>
                        <option value="">Latest</option>
                        {forgeVersions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input className="input" value={editForm.loader_version} onChange={e => setEditForm(f => ({ ...f, loader_version: e.target.value }))} placeholder={loadingForge ? 'Loading...' : 'Leave blank for latest'} />
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Visibility</label>
                    <select className="select" value={editForm.visibility} onChange={e => setEditForm(f => ({ ...f, visibility: e.target.value }))}>
                      <option value="private">Private — share the pack ID to invite</option>
                      <option value="public">Public — listed in Browse Packs</option>
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Join Mode</label>
                    <select className="select" value={editForm.join_mode} onChange={e => setEditForm(f => ({ ...f, join_mode: e.target.value }))}>
                      <option value="open">Open — join instantly</option>
                      <option value="request">Request — you approve each join</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:14 }}>LAUNCH OPTIONS <span style={{ color:'#6b6b8a', fontWeight:'normal', fontSize:12 }}>(local to you)</span></h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Min RAM</label>
                  <select className="select" value={launchOpts.min_ram} onChange={e => setLaunchOpts(o => ({ ...o, min_ram: e.target.value }))}>
                    {RAM_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Max RAM</label>
                  <select className="select" value={launchOpts.max_ram} onChange={e => setLaunchOpts(o => ({ ...o, max_ram: e.target.value }))}>
                    {RAM_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Custom JVM Args <span style={{ color:'#6b6b8a' }}>(advanced)</span></label>
                <textarea value={launchOpts.jvm_args} onChange={e => setLaunchOpts(o => ({ ...o, jvm_args: e.target.value }))}
                  placeholder="e.g. -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
                  style={{ width:'100%', minHeight:80, padding:'10px 14px', borderRadius:8, border:'1px solid #2a2a4a', background:'#0d0d1a', color:'#fff', fontSize:12, fontFamily:'Consolas, monospace', resize:'vertical' }} />
                <button onClick={() => setLaunchOpts(o => ({ ...o, jvm_args: AIKARS_FLAGS }))}
                  style={{ marginTop:6, background:'none', border:'none', color:'#4a7ce8', cursor:'pointer', fontSize:12, padding:0 }}>
                  Use Aikar's Flags (recommended for large modpacks)
                </button>
              </div>
              <div>
                <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Custom Java Path <span style={{ color:'#6b6b8a' }}>(auto-detected if blank)</span></label>
                <input className="input" value={launchOpts.java_path} onChange={e => setLaunchOpts(o => ({ ...o, java_path: e.target.value }))}
                  placeholder="Leave blank to auto-detect" style={{ fontFamily:'Consolas, monospace', fontSize:12 }} />
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={handleSaveSettings} className="btn btn-primary">Save Settings</button>
            {savedMsg && <span style={{ color:'#22c55e', fontSize:13 }}>{savedMsg}</span>}
          </div>

          {isOwner ? (
            <div className="card" style={{ borderColor:'#7f1d1d' }}>
              <h3 style={{ color:'#f87171', fontSize:14, marginBottom:8 }}>DANGER ZONE</h3>
              <p style={{ color:'#8888aa', fontSize:13, marginBottom:12 }}>Deleting a pack permanently removes all mods and cannot be undone.</p>
              <button onClick={handleDelete} className="btn btn-danger">Delete Pack</button>
            </div>
          ) : (
            <div className="card" style={{ borderColor:'#7f1d1d' }}>
              <h3 style={{ color:'#f87171', fontSize:14, marginBottom:8 }}>LEAVE PACK</h3>
              <p style={{ color:'#8888aa', fontSize:13, marginBottom:12 }}>You can rejoin anytime with the pack ID.</p>
              <button onClick={handleLeave} className="btn btn-danger">Leave Modpack</button>
            </div>
          )}
        </div>
      )}

      {showModrinth && (
        <ModrinthBrowser
          packId={pack.id}
          mcVersion={pack.mc_version}
          loader={pack.loader}
          installedFilenames={pack.mods.map(m => m.filename)}
          onClose={() => setShowModrinth(false)}
          onInstalled={refreshPack}
        />
      )}

      {showUpdates && (
        <UpdateChecker
          packId={pack.id}
          onClose={() => setShowUpdates(false)}
          onApplied={refreshPack}
        />
      )}

      {reportTarget && (
        <ReportModal
          title={reportTarget.kind === 'pack' ? `Report "${pack.name}"` : `Report ${reportTarget.name}`}
          onSubmit={submitReport}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  )
}
