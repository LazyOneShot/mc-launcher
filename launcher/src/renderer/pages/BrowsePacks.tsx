import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PublicPack } from '../../shared/types'
import ReportModal from '../components/ReportModal'

export default function BrowsePacks() {
  const nav = useNavigate()
  const [packs, setPacks] = useState<PublicPack[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [reportPack, setReportPack] = useState<PublicPack | null>(null)

  useEffect(() => {
    window.api.listPublicModpacks().then((rows: PublicPack[]) => {
      setPacks(rows)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const handleJoin = async (pack: PublicPack) => {
    setBusyId(pack.id)
    setMsgs(m => ({ ...m, [pack.id]: '' }))
    try {
      const res: any = await window.api.joinModpack(pack.id)
      if (res?.status === 'pending') {
        setMsgs(m => ({ ...m, [pack.id]: 'Request sent — waiting for approval.' }))
      } else {
        nav(`/pack/${pack.id}`)
      }
    } catch (e: any) {
      setMsgs(m => ({ ...m, [pack.id]: e?.response?.data?.detail || 'Failed to join' }))
    }
    setBusyId(null)
  }


  return (
    <div className="page">
      <button onClick={() => nav('/home')} className="back-link">← Back</button>
      <h1 style={{ marginBottom:8, fontSize:24 }}>Browse Public Packs</h1>
      <p style={{ color:'#8888aa', fontSize:13, marginBottom:16 }}>Packs anyone can find and join, without needing the pack ID.</p>

      <input className="input" style={{ marginBottom:20 }} placeholder="Search by name or description..."
        value={search} onChange={e => setSearch(e.target.value)} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
        {packs.filter(p =>
          !search.trim() ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
        ).map(pack => (
          <div key={pack.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <h3 style={{ marginBottom:6, fontSize:16 }}>{pack.name}</h3>
              <button className="icon-btn" title="Report this pack" onClick={() => setReportPack(pack)}>⚑</button>
            </div>
            <p style={{ color:'#8888aa', fontSize:13 }}>{pack.mc_version} • {pack.loader}</p>
            {pack.description && <p style={{ color:'#6b6b8a', fontSize:12, marginTop:8 }}>{pack.description}</p>}
            <p style={{ color:'#4a4a63', fontSize:11, marginTop:10 }}>by {pack.owner_username}</p>
            <button
              onClick={() => handleJoin(pack)}
              disabled={busyId === pack.id}
              className="btn btn-success"
              style={{ marginTop:12, width:'100%' }}>
              {pack.join_mode === 'request' ? 'Request to Join' : 'Join'}
            </button>
            {msgs[pack.id] && <p style={{ color:'#4ade80', fontSize:12, marginTop:8 }}>{msgs[pack.id]}</p>}
          </div>
        ))}
        {loaded && packs.length === 0 && (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:40, color:'#6b6b8a' }}>
            No public packs right now.
          </div>
        )}
        {loaded && packs.length > 0 && search.trim() && !packs.some(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
        ) && (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:40, color:'#6b6b8a' }}>
            No packs match "{search}".
          </div>
        )}
      </div>

      {reportPack && (
        <ReportModal
          title={`Report "${reportPack.name}"`}
          onSubmit={reason => window.api.reportPack(reportPack.id, reason)}
          onClose={() => setReportPack(null)}
        />
      )}
    </div>
  )
}
