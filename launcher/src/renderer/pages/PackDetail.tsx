import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ModpackFull } from '../../shared/types'

interface Member {
  id: string
  minecraft_uuid: string
  minecraft_username: string
  role: string
}

interface LaunchOptions {
  min_ram: string
  max_ram: string
  jvm_args: string
  java_path: string
}

const LOADERS = ['neoforge', 'forge', 'fabric', 'quilt']
const MC_VERSIONS = ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2']
const RAM_OPTIONS = ['1G', '2G', '3G', '4G', '6G', '8G', '12G', '16G']

const AIKARS_FLAGS = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1'

type Tab = 'mods' | 'members' | 'settings'

function parseLaunchOpts(raw: string | undefined): LaunchOptions {
  if (!raw) return { min_ram: '2G', max_ram: '4G', jvm_args: '', java_path: '' }
  try {
    const p = JSON.parse(raw)
    return {
      min_ram: p.min_ram || '2G',
      max_ram: p.max_ram || '4G',
      jvm_args: p.jvm_args || '',
      java_path: p.java_path || ''
    }
  } catch {
    return { min_ram: '2G', max_ram: '4G', jvm_args: '', java_path: '' }
  }
}

export default function PackDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [pack, setPack] = useState<ModpackFull | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [log, setLog] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newMember, setNewMember] = useState('')
  const [memberError, setMemberError] = useState('')
  const [session, setSession] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('mods')
  const [modSearch, setModSearch] = useState('')
  const [editForm, setEditForm] = useState({ name: '', description: '', mc_version: '', loader: '', loader_version: '' })
  const [launchOpts, setLaunchOpts] = useState<LaunchOptions>({ min_ram: '2G', max_ram: '4G', jvm_args: '', java_path: '' })
  const [savedMsg, setSavedMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    window.api.getModpack(id).then((p: any) => {
      setPack(p)
      setEditForm({ name: p.name, description: p.description, mc_version: p.mc_version, loader: p.loader, loader_version: p.loader_version })
      setLaunchOpts(parseLaunchOpts(p.launch_options))
    })
    window.api.getMembers(id).then(setMembers)
    window.api.getSession().then(setSession)
    window.api.onLaunchProgress((msg: string) => setLog(l => [...l, msg]))
  }, [id])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const isOwner = pack && session && pack.owner === session.minecraft_uuid

  const handleLaunch = async () => {
    if (!id) return
    setLaunching(true); setLog([])
    try {
      await window.api.syncAndLaunch(id)
    } catch (e: any) {
      setLog(l => [...l, `Error: ${e.message || e}`])
    }
    setLaunching(false)
  }

  const handleUpload = async () => {
    if (!id || uploading) return
    const filePaths: string[] = await window.api.pickModFile()
    if (filePaths.length === 0) return
    setUploading(true)
    for (const filePath of filePaths) {
      try {
        const mod = await window.api.uploadMod(id, filePath)
        setPack(p => p ? { ...p, mods: [...p.mods, mod] } : p)
      } catch {}
    }
    setUploading(false)
  }

  const handleSaveSettings = async () => {
    if (!id) return
    const updated: any = await window.api.updateModpack(id, {
      ...editForm,
      launch_options: JSON.stringify(launchOpts)
    })
    setPack(p => p ? { ...p, ...updated } : p)
    setSavedMsg('Saved!')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const handleDelete = async () => {
    if (!id || !confirm(`Delete "${pack?.name}"? This permanently removes all mods.`)) return
    await window.api.deleteModpack(id)
    nav('/home')
  }

  const handleAddMember = async () => {
    if (!id || !newMember.trim()) return
    setMemberError('')
    try {
      const m = await window.api.addMember(id, newMember.trim())
      setMembers(mm => [...mm, m])
      setNewMember('')
    } catch (e: any) {
      setMemberError(e?.response?.data?.detail || 'Failed to add member')
    }
  }

  const handleRemoveMember = async (uuid: string) => {
    if (!id) return
    await window.api.removeMember(id, uuid)
    setMembers(mm => mm.filter(m => m.minecraft_uuid !== uuid))
  }

  const handleTransfer = async (uuid: string, username: string) => {
    if (!id || !confirm(`Transfer ownership to ${username}?`)) return
    await window.api.transferOwnership(id, uuid)
    setPack(p => p ? { ...p, owner: uuid } : p)
  }

  if (!pack) return <div className="page">Loading...</div>

  const filteredMods = pack.mods.filter(m => m.filename.toLowerCase().includes(modSearch.toLowerCase()))

  return (
    <div className="page">
      <button onClick={() => nav('/home')} className="back-link">← Back</button>

      <div className="pack-header">
        <div>
          <h1>{pack.name}</h1>
          <p className="pack-meta">{pack.mc_version} • {pack.loader} {pack.loader_version}</p>
          {pack.description && <p style={{ color:'#8888aa', fontSize:13, marginTop:4, marginBottom:6 }}>{pack.description}</p>}
          <p className="pack-id">Pack ID: <strong>{pack.id}</strong></p>
        </div>
      </div>

      <div className="action-bar">
        <button onClick={handleLaunch} disabled={launching} className="btn btn-play">
          {launching ? 'Syncing & Launching...' : '▶  Play'}
        </button>
      </div>

      {log.length > 0 && (
        <div className="log-console" ref={logRef} style={{ marginBottom:24 }}>
          {log.map((l, i) => (
            <div key={i} className={`log-line ${l.toLowerCase().includes('error') ? 'error' : ''}`}>{l}</div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:2, borderBottom:'1px solid #22243d', marginBottom:16 }}>
        {(['mods', 'members', 'settings'] as Tab[]).map(t => {
          if ((t === 'settings' || t === 'members') && !isOwner) return null
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding:'10px 20px', background:'none', border:'none',
                borderBottom: tab === t ? '2px solid #4a7ce8' : '2px solid transparent',
                color: tab === t ? '#fff' : '#8888aa',
                cursor:'pointer', textTransform:'capitalize', fontSize:14, fontWeight:600
              }}>
              {t} {t === 'mods' && `(${pack.mods.length})`}{t === 'members' && `(${members.length})`}
            </button>
          )
        })}
      </div>

      {/* MODS TAB */}
      {tab === 'mods' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input className="input" style={{ flex:1 }} placeholder="Search mods..." value={modSearch} onChange={e => setModSearch(e.target.value)} />
            <button onClick={handleUpload} disabled={uploading} className="btn btn-primary">
              {uploading ? 'Uploading...' : '+ Upload'}
            </button>
          </div>

          <div className="mod-list-container">
            {filteredMods.map(mod => (
              <div key={mod.id} className="mod-row">
                <span className="mod-filename">{mod.filename}</span>
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <span style={{ color:'#6b6b8a', fontSize:11 }}>{(mod.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  <button className="icon-btn"
                    onClick={() => id && window.api.removeMod(id, mod.id).then(() => setPack(p => p ? { ...p, mods: p.mods.filter(m => m.id !== mod.id) } : p))}>✕</button>
                </div>
              </div>
            ))}
            {filteredMods.length === 0 && (
              <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>
                {pack.mods.length === 0 ? 'No mods yet. Upload some JARs to get started.' : 'No mods match your search.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && isOwner && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input className="input" style={{ flex:1 }} placeholder="Minecraft username..." value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMember()} />
            <button onClick={handleAddMember} className="btn btn-primary">Add Editor</button>
          </div>
          {memberError && <p style={{ color:'#f87171', fontSize:13, marginBottom:10 }}>{memberError}</p>}

          {members.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>No editors yet.</div>
          )}
          {members.map(mem => (
            <div key={mem.id} className="member-row">
              <div>
                <span style={{ fontWeight:600 }}>{mem.minecraft_username}</span>
                <span className="badge">editor</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => handleTransfer(mem.minecraft_uuid, mem.minecraft_username)} className="btn btn-warning" style={{ padding:'6px 12px', fontSize:12 }}>Transfer Ownership</button>
                <button onClick={() => handleRemoveMember(mem.minecraft_uuid)} className="icon-btn">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && isOwner && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Pack info */}
          <div className="card">
            <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:14 }}>PACK INFO</h3>
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
                  <select className="select" value={editForm.mc_version} onChange={e => setEditForm(f => ({ ...f, mc_version: e.target.value }))}>
                    {MC_VERSIONS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Loader</label>
                  <select className="select" value={editForm.loader} onChange={e => setEditForm(f => ({ ...f, loader: e.target.value }))}>
                    {LOADERS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Loader Version</label>
                  <input className="input" value={editForm.loader_version} onChange={e => setEditForm(f => ({ ...f, loader_version: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* Launch options */}
          <div className="card">
            <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:14 }}>LAUNCH OPTIONS</h3>
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
                <textarea
                  value={launchOpts.jvm_args}
                  onChange={e => setLaunchOpts(o => ({ ...o, jvm_args: e.target.value }))}
                  placeholder="e.g. -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
                  style={{
                    width:'100%', minHeight:80, padding:'10px 14px', borderRadius:8,
                    border:'1px solid #2a2a4a', background:'#0d0d1a', color:'#fff',
                    fontSize:12, fontFamily:'Consolas, monospace', resize:'vertical'
                  }}
                />
                <button
                  onClick={() => setLaunchOpts(o => ({ ...o, jvm_args: AIKARS_FLAGS }))}
                  style={{ marginTop:6, background:'none', border:'none', color:'#4a7ce8', cursor:'pointer', fontSize:12, padding:0 }}>
                  Use Aikar's Flags (recommended for large modpacks)
                </button>
              </div>
              <div>
                <label style={{ display:'block', marginBottom:4, color:'#8888aa', fontSize:12 }}>Custom Java Path <span style={{ color:'#6b6b8a' }}>(optional)</span></label>
                <input
                  className="input"
                  value={launchOpts.java_path}
                  onChange={e => setLaunchOpts(o => ({ ...o, java_path: e.target.value }))}
                  placeholder="Leave blank to use system Java"
                  style={{ fontFamily:'Consolas, monospace', fontSize:12 }}
                />
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={handleSaveSettings} className="btn btn-primary">Save Settings</button>
            {savedMsg && <span style={{ color:'#22c55e', fontSize:13 }}>{savedMsg}</span>}
          </div>

          <div className="card" style={{ borderColor:'#7f1d1d' }}>
            <h3 style={{ color:'#f87171', fontSize:14, marginBottom:8 }}>DANGER ZONE</h3>
            <p style={{ color:'#8888aa', fontSize:13, marginBottom:12 }}>Deleting a pack permanently removes all mods and cannot be undone.</p>
            <button onClick={handleDelete} className="btn btn-danger">Delete Pack</button>
          </div>
        </div>
      )}
    </div>
  )
}
