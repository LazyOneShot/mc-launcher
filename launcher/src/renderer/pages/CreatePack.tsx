import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LOADERS = ['neoforge', 'forge', 'fabric']
const FALLBACK_MC_VERSIONS = ['1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2']

export default function CreatePack() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name:'', id:'', description:'', mc_version:'1.20.1', loader:'forge', loader_version:'' })
  const [error, setError] = useState('')
  const [mcVersions, setMcVersions] = useState<string[]>(FALLBACK_MC_VERSIONS)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    window.api.getMcVersions().then((vs: string[]) => {
      if (vs && vs.length > 0) setMcVersions(vs)
    })
  }, [])

  const handleCreate = async () => {
    setError('')
    try {
      const p: any = await window.api.createModpack(form)
      nav(`/pack/${p.id}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create pack')
    }
  }

  return (
    <div className="page" style={{ maxWidth:560 }}>
      <button onClick={() => nav('/home')} className="back-link">← Back</button>
      <h1 style={{ marginBottom:24, fontSize:24 }}>Create Modpack</h1>
      <div className="card">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>Pack Name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Awesome Pack" />
          </div>
          <div>
            <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>Pack ID <span style={{ color:'#6b6b8a', fontWeight:'normal' }}>(friends use this to join)</span></label>
            <input className="input" value={form.id} onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="my-awesome-pack" />
          </div>
          <div>
            <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>Description</label>
            <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>MC Version</label>
              <select className="select" value={form.mc_version} onChange={e => set('mc_version', e.target.value)}>
                {mcVersions.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>Loader</label>
              <select className="select" value={form.loader} onChange={e => set('loader', e.target.value)}>
                {LOADERS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display:'block', marginBottom:6, color:'#a5b4fc', fontSize:13 }}>
              Loader Version <span style={{ color:'#6b6b8a', fontWeight:'normal' }}>(leave blank for latest)</span>
            </label>
            <input className="input" value={form.loader_version} onChange={e => set('loader_version', e.target.value)} placeholder="Leave blank for latest" />
          </div>
          {error && <p style={{ color:'#f87171', fontSize:13 }}>{error}</p>}
          <button onClick={handleCreate} className="btn btn-primary" style={{ padding:'12px', marginTop:8 }}>Create Pack</button>
        </div>
      </div>
    </div>
  )
}