import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LOADERS = ['neoforge', 'forge', 'fabric', 'quilt']
const MC_VERSIONS = ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2']

export default function CreatePack() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name:'', id:'', description:'', mc_version:'1.21.1', loader:'neoforge', loader_version:'' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inp: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #333', background:'#0d0d1a', color:'#fff', fontSize:15 }
  return (
    <div style={{ maxWidth:540, margin:'40px auto', padding:32 }}>
      <button onClick={() => nav('/home')} style={{ background:'none', border:'none', color:'#888', cursor:'pointer', marginBottom:20 }}>← Back</button>
      <h1 style={{ marginBottom:32 }}>Create Modpack</h1>
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div>
          <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>Pack Name</label>
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Luke's Survival Pack" />
        </div>
        <div>
          <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>Pack ID <span style={{ color:'#555' }}>(friends use this to join)</span></label>
          <input style={inp} value={form.id} onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="lukes-survival" />
        </div>
        <div>
          <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>Description</label>
          <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" />
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>MC Version</label>
            <select style={inp} value={form.mc_version} onChange={e => set('mc_version', e.target.value)}>
              {MC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>Mod Loader</label>
            <select style={inp} value={form.loader} onChange={e => set('loader', e.target.value)}>
              {LOADERS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ display:'block', marginBottom:6, color:'#aaa', fontSize:14 }}>Loader Version</label>
          <input style={inp} value={form.loader_version} onChange={e => set('loader_version', e.target.value)} placeholder="e.g. 21.1.0" />
        </div>
        <button onClick={() => window.api.createModpack(form).then((p: { id: string }) => nav(`/pack/${p.id}`))}
          style={{ padding:'13px 0', background:'#00b4d8', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:16, cursor:'pointer', marginTop:8 }}>
          Create Pack
        </button>
      </div>
    </div>
  )
}
