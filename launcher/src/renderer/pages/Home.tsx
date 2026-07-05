import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModpackMeta } from '../../shared/types'

export default function Home() {
  const [packs, setPacks] = useState<ModpackMeta[]>([])
  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [session, setSession] = useState<any>(null)
  const nav = useNavigate()

  useEffect(() => {
    window.api.listMyModpacks().then(setPacks)
    window.api.getSession().then(setSession)
  }, [])

  const handleJoin = async () => {
    if (!joinId.trim()) return
    setJoinError('')
    try {
      await window.api.joinModpack(joinId.trim())
      nav(`/pack/${joinId.trim()}`)
    } catch (e: any) {
      setJoinError(e?.response?.data?.detail || 'Failed to join pack')
    }
  }

  const handleLogout = async () => {
    await window.api.logout()
    nav('/login')
  }

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700 }}>Modpacks</h1>
          {session && <p style={{ color:'#8888aa', fontSize:13, marginTop:2 }}>Signed in as {session.minecraft_username}</p>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => nav('/create')} className="btn btn-primary">+ Create Pack</button>
          <button onClick={handleLogout} className="btn btn-secondary">Sign out</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom:24 }}>
        <label style={{ display:'block', marginBottom:8, color:'#8888aa', fontSize:13 }}>Join a friend's pack</label>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input" style={{ flex:1 }} placeholder="Enter pack ID..." value={joinId} onChange={e => setJoinId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
          <button onClick={handleJoin} className="btn btn-success">Join</button>
        </div>
        {joinError && <p style={{ color:'#f87171', fontSize:13, marginTop:8 }}>{joinError}</p>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
        {packs.map(pack => (
          <div key={pack.id} onClick={() => nav(`/pack/${pack.id}`)} className="card" style={{ cursor:'pointer', transition:'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#4a7ce8'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#22243d'}>
            <h3 style={{ marginBottom:6, fontSize:16 }}>{pack.name}</h3>
            <p style={{ color:'#8888aa', fontSize:13 }}>{pack.mc_version} • {pack.loader}</p>
            <p style={{ color:'#6b6b8a', fontSize:11, marginTop:10, fontFamily:'Consolas, monospace' }}>ID: {pack.id}</p>
          </div>
        ))}
        {packs.length === 0 && (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:40, color:'#6b6b8a' }}>
            No modpacks yet — create one or join a friend's.
          </div>
        )}
      </div>
    </div>
  )
}
