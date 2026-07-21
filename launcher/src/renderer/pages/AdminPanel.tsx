import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BannedUser, Report } from '../../shared/types'

type Tab = 'reports' | 'bans'

export default function AdminPanel() {
  const nav = useNavigate()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('reports')
  const [reports, setReports] = useState<Report[]>([])
  const [bans, setBans] = useState<BannedUser[]>([])
  const [banUsername, setBanUsername] = useState('')
  const [banReason, setBanReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.checkAdminAccess().then((ok: boolean) => setAuthorized(ok))
  }, [])

  useEffect(() => {
    if (!authorized) return
    if (tab === 'reports') window.api.listReports('open').then(setReports)
    if (tab === 'bans') window.api.listBans().then(setBans)
  }, [authorized, tab])

  const handleResolve = async (r: Report) => {
    await window.api.resolveReport(r.id)
    setReports(rr => rr.filter(x => x.id !== r.id))
  }

  const handleDismiss = async (r: Report) => {
    await window.api.dismissReport(r.id)
    setReports(rr => rr.filter(x => x.id !== r.id))
  }

  const handleForcePrivate = async (r: Report) => {
    await window.api.forcePrivatePack(r.pack_id)
    alert(`"${r.pack_name}" is now private.`)
  }

  const handleForceDelete = async (r: Report) => {
    if (!confirm(`Permanently delete "${r.pack_name}"? This removes all its mods too.`)) return
    await window.api.forceDeletePack(r.pack_id)
    setReports(rr => rr.filter(x => x.id !== r.id))
  }

  const handleBanFromReport = async (r: Report) => {
    if (!r.reported_username) return
    if (!confirm(`Ban ${r.reported_username}?\n\nReason: "${r.reason}"`)) return
    await window.api.banUser(r.reported_username, r.reason)
    await window.api.resolveReport(r.id)
    setReports(rr => rr.filter(x => x.id !== r.id))
  }

  const handleBan = async () => {
    if (!banUsername.trim()) return
    setError('')
    try {
      const b = await window.api.banUser(banUsername.trim(), banReason.trim())
      setBans(bb => [...bb, b])
      setBanUsername(''); setBanReason('')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to ban user')
    }
  }

  const handleUnban = async (b: BannedUser) => {
    if (!confirm(`Unban ${b.minecraft_username}?`)) return
    await window.api.unbanUser(b.minecraft_uuid)
    setBans(bb => bb.filter(x => x.id !== b.id))
  }

  if (authorized === null) return <div className="page">Loading...</div>

  if (!authorized) return (
    <div className="page">
      <button onClick={() => nav('/home')} className="back-link">← Back</button>
      <div style={{ textAlign:'center', padding:60, color:'#6b6b8a' }}>Not authorized.</div>
    </div>
  )

  return (
    <div className="page">
      <button onClick={() => nav('/home')} className="back-link">← Back</button>
      <h1 style={{ marginBottom:24, fontSize:24 }}>Admin</h1>

      <div style={{ display:'flex', gap:2, borderBottom:'1px solid #22243d', marginBottom:16 }}>
        {(['reports', 'bans'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding:'10px 20px', background:'none', border:'none',
              borderBottom: tab === t ? '2px solid #4a7ce8' : '2px solid transparent',
              color: tab === t ? '#fff' : '#8888aa',
              cursor:'pointer', textTransform:'capitalize', fontSize:14, fontWeight:600
            }}>
            {t} {t === 'reports' && `(${reports.length})`}
            {t === 'bans' && `(${bans.length})`}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div>
          {reports.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>No open reports.</div>
          )}
          {reports.map(r => (
            <div key={r.id} className="card" style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  {r.reported_username ? (
                    <>
                      <h3 style={{ fontSize:15, marginBottom:4 }}>
                        <span className="badge" style={{ background:'#3b0e0e', color:'#f87171', marginRight:8 }}>player</span>
                        {r.reported_username}
                      </h3>
                      <p style={{ color:'#8888aa', fontSize:12 }}>in "{r.pack_name}" — reported by {r.reporter_username}</p>
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize:15, marginBottom:4 }}>
                        <span className="badge" style={{ marginRight:8 }}>pack</span>
                        {r.pack_name}
                      </h3>
                      <p style={{ color:'#8888aa', fontSize:12 }}>Reported by {r.reporter_username}</p>
                    </>
                  )}
                  <p style={{ color:'#e0e0e0', fontSize:13, marginTop:8 }}>{r.reason}</p>
                </div>
                <span style={{ color:'#4a4a63', fontSize:11 }}>{new Date(r.created_at.endsWith('Z') ? r.created_at : r.created_at + 'Z').toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                <button onClick={() => handleDismiss(r)} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>Dismiss</button>
                {r.reported_username && (
                  <button onClick={() => handleBanFromReport(r)} className="btn btn-danger" style={{ padding:'6px 12px', fontSize:12 }}>Ban Player</button>
                )}
                <button onClick={() => handleForcePrivate(r)} className="btn btn-warning" style={{ padding:'6px 12px', fontSize:12 }}>Make Pack Private</button>
                <button onClick={() => handleForceDelete(r)} className="btn btn-danger" style={{ padding:'6px 12px', fontSize:12 }}>Delete Pack</button>
                <button onClick={() => handleResolve(r)} className="btn btn-success" style={{ padding:'6px 12px', fontSize:12 }}>Mark Resolved</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'bans' && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:12 }}>BAN A PLAYER</h3>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" style={{ flex:1 }} placeholder="Minecraft username..." value={banUsername} onChange={e => setBanUsername(e.target.value)} />
              <input className="input" style={{ flex:2 }} placeholder="Reason (optional)" value={banReason} onChange={e => setBanReason(e.target.value)} />
              <button onClick={handleBan} className="btn btn-danger">Ban</button>
            </div>
            {error && <p style={{ color:'#f87171', fontSize:13, marginTop:8 }}>{error}</p>}
          </div>

          {bans.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'#6b6b8a', fontSize:13 }}>No banned players.</div>
          )}
          {bans.map(b => (
            <div key={b.id} className="member-row">
              <div>
                <span style={{ fontWeight:600 }}>{b.minecraft_username}</span>
                {b.reason && <span style={{ color:'#8888aa', fontSize:12, marginLeft:8 }}>({b.reason})</span>}
              </div>
              <button onClick={() => handleUnban(b)} className="btn btn-secondary" style={{ padding:'6px 12px', fontSize:12 }}>Unban</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
