import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModpackMeta } from '../../shared/types'

export default function Home() {
  const [packs, setPacks] = useState<ModpackMeta[]>([])
  const [joinId, setJoinId] = useState('')
  const nav = useNavigate()
  useEffect(() => { window.api.listMyModpacks().then(setPacks) }, [])
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h1 style={{ fontSize:28 }}>My Modpacks</h1>
        <button onClick={() => nav('/create')} style={{ padding:'10px 20px', background:'#00b4d8', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600 }}>+ Create Pack</button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:32 }}>
        <input placeholder="Enter pack ID to join a friend's pack..." value={joinId} onChange={e => setJoinId(e.target.value)}
          style={{ flex:1, padding:'10px 14px', borderRadius:8, border:'1px solid #333', background:'#0d0d1a', color:'#fff', fontSize:15 }} />
        <button onClick={() => joinId && nav(`/pack/${joinId}`)}
          style={{ padding:'10px 20px', background:'#2ecc71', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600 }}>Join</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
        {packs.map(pack => (
          <div key={pack.id} onClick={() => nav(`/pack/${pack.id}`)}
            style={{ padding:20, borderRadius:10, background:'#16213e', cursor:'pointer', border:'1px solid #1a1a40' }}>
            <h3 style={{ marginBottom:6 }}>{pack.name}</h3>
            <p style={{ color:'#888', fontSize:14 }}>{pack.mc_version} • {pack.loader}</p>
            <p style={{ color:'#444', fontSize:12, marginTop:8, fontFamily:'monospace' }}>ID: {pack.id}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
