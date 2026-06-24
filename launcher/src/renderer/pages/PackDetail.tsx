import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ModpackFull } from '../../shared/types'

export default function PackDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [pack, setPack] = useState<ModpackFull | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (id) window.api.getModpack(id).then(setPack)
    window.api.onLaunchProgress((msg: string) => setLog(l => [...l, msg]))
  }, [id])

  const handleLaunch = async () => {
    if (!id) return
    setLaunching(true); setLog([])
    await window.api.syncAndLaunch(id)
    setLaunching(false)
  }

  if (!pack) return <div style={{ padding:32 }}>Loading...</div>
  return (
    <div style={{ padding:32 }}>
      <button onClick={() => nav('/home')} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', marginBottom:16 }}>← Back</button>
      <h1 style={{ marginBottom:6 }}>{pack.name}</h1>
      <p style={{ color:'#888', marginBottom:4 }}>{pack.mc_version} • {pack.loader} {pack.loader_version}</p>
      <p style={{ color:'#444', fontFamily:'monospace', fontSize:13, marginBottom:24 }}>
        Pack ID: <strong style={{ color:'#00b4d8' }}>{pack.id}</strong> — share this with friends
      </p>
      <div style={{ display:'flex', gap:12, marginBottom:24 }}>
        <button onClick={handleLaunch} disabled={launching}
          style={{ padding:'12px 32px', background: launching ? '#555' : '#2ecc71', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:16, cursor:'pointer' }}>
          {launching ? 'Syncing & Launching...' : '▶  Play'}
        </button>
        <button style={{ padding:'12px 20px', background:'#3a3a5c', border:'none', borderRadius:8, color:'#fff', cursor:'pointer' }}>
          + Upload Mod
        </button>
      </div>
      {log.length > 0 && (
        <div style={{ background:'#0d0d1a', borderRadius:8, padding:16, fontFamily:'monospace', fontSize:13, marginBottom:24, lineHeight:1.8 }}>
          {log.map((l, i) => <div key={i} style={{ color: l.includes('Error') ? '#e74c3c' : '#2ecc71' }}>{l}</div>)}
        </div>
      )}
      <h2 style={{ marginBottom:12 }}>Mods ({pack.mods.length})</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {pack.mods.map(mod => (
          <div key={mod.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#16213e', borderRadius:8 }}>
            <span style={{ fontFamily:'monospace', fontSize:14 }}>{mod.filename}</span>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <span style={{ color:'#555', fontSize:12 }}>{(mod.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              <button onClick={() => id && window.api.removeMod(id, mod.id).then(() => setPack(p => p ? { ...p, mods: p.mods.filter(m => m.id !== mod.id) } : p))}
                style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
          </div>
        ))}
        {pack.mods.length === 0 && <p style={{ color:'#555' }}>No mods yet — upload some JARs to get started.</p>}
      </div>
    </div>
  )
}
