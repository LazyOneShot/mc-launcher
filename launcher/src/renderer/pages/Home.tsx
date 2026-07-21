import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModpackMeta, MyJoinRequest } from '../../shared/types'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner: { bg: '#3b0764', color: '#c084fc' },
  editor: { bg: '#052e16', color: '#4ade80' },
  viewer: { bg: '#1e293b', color: '#8888aa' },
}

export default function Home() {
  const [packs, setPacks] = useState<ModpackMeta[]>([])
  const [myRequests, setMyRequests] = useState<MyJoinRequest[]>([])
  const [joinId, setJoinId] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [session, setSession] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    window.api.listMyModpacks().then(setPacks)
    window.api.listMyJoinRequests().then(setMyRequests)
    window.api.getSession().then(setSession)
    window.api.checkAdminAccess().then(setIsAdmin)
    // Picks up newly-approved join requests and role changes without a restart.
    const interval = setInterval(() => {
      window.api.listMyModpacks().then(setPacks)
      window.api.listMyJoinRequests().then(setMyRequests)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleJoin = async () => {
    if (!joinId.trim()) return
    setJoinError(''); setJoinMsg('')
    try {
      const res: any = await window.api.joinModpack(joinId.trim())
      if (res?.status === 'pending') {
        setJoinMsg('Request sent — waiting for the owner to approve.')
        setJoinId('')
        window.api.listMyJoinRequests().then(setMyRequests)
      } else {
        nav(`/pack/${joinId.trim()}`)
      }
    } catch (e: any) {
      setJoinError(e?.response?.data?.detail || 'Failed to join pack')
    }
  }

  const handleCancelRequest = async (req: MyJoinRequest) => {
    await window.api.cancelJoinRequest(req.pack_id)
    setMyRequests(rr => rr.filter(r => r.id !== req.id))
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
          {isAdmin && <button onClick={() => nav('/admin')} className="btn btn-warning">Admin</button>}
          <button onClick={() => nav('/browse')} className="btn btn-secondary">Browse Public Packs</button>
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
        {joinMsg && <p style={{ color:'#4ade80', fontSize:13, marginTop:8 }}>{joinMsg}</p>}
      </div>

      {myRequests.length > 0 && (
        <div className="card" style={{ marginBottom:24, borderColor:'#4a2f04' }}>
          <h3 style={{ fontSize:14, color:'#fbbf24', marginBottom:12 }}>PENDING REQUESTS ({myRequests.length})</h3>
          {myRequests.map(req => (
            <div key={req.id} className="member-row">
              <span style={{ fontWeight:600 }}>{req.pack_name}</span>
              <button onClick={() => handleCancelRequest(req)} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
        {packs.map(pack => {
          const roleStyle = pack.my_role ? ROLE_COLORS[pack.my_role] || ROLE_COLORS.viewer : ROLE_COLORS.viewer
          return (
            <div key={pack.id} onClick={() => nav(`/pack/${pack.id}`)} className="card" style={{ cursor:'pointer', transition:'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#4a7ce8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#22243d'}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <h3 style={{ marginBottom:6, fontSize:16 }}>{pack.name}</h3>
                {pack.my_role && (
                  <span className="badge" style={{ background:roleStyle.bg, color:roleStyle.color, flexShrink:0 }}>{pack.my_role}</span>
                )}
              </div>
              <p style={{ color:'#8888aa', fontSize:13 }}>{pack.mc_version} • {pack.loader}</p>
              {pack.description && <p style={{ color:'#6b6b8a', fontSize:12, marginTop:6 }}>{pack.description}</p>}
              <p style={{ color:'#6b6b8a', fontSize:11, marginTop:10, fontFamily:'Consolas, monospace' }}>ID: {pack.id}</p>
              {!!pack.pending_request_count && (
                <p style={{ color:'#fbbf24', fontSize:12, marginTop:8, fontWeight:600 }}>
                  🔔 {pack.pending_request_count} pending request{pack.pending_request_count === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )
        })}
        {packs.length === 0 && (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:40, color:'#6b6b8a' }}>
            No modpacks yet — create one or join a friend's.
          </div>
        )}
      </div>
    </div>
  )
}
