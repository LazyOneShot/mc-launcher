import React, { useEffect, useState } from 'react'
import type { CheckUpdatesResponse, UpdateCandidate } from '../../shared/types'

interface Props {
  packId: string
  onClose: () => void
  onApplied: () => void
}

type Phase = 'checking' | 'results' | 'applying' | 'done' | 'error'

export default function UpdateChecker({ packId, onClose, onApplied }: Props) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [result, setResult] = useState<CheckUpdatesResponse | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState<string | null>(null)
  const [applied, setApplied] = useState<string[]>([])
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r: CheckUpdatesResponse = await window.api.checkModUpdates(packId)
        if (cancelled) return
        setResult(r)
        setPhase('results')
      } catch (e: any) {
        if (cancelled) return
        setError(e?.response?.data?.detail || e?.message || 'Update check failed')
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [packId])

  const applyOne = async (u: UpdateCandidate) => {
    setApplying(u.mod_id)
    try {
      await window.api.applyModUpdate(packId, u.mod_id, u.url, u.new_filename)
      setApplied(a => [...a, u.mod_id])
      onApplied()
    } catch (e: any) {
      setFailed(f => ({ ...f, [u.mod_id]: e?.response?.data?.detail || e?.message || 'failed' }))
    }
    setApplying(null)
  }

  const downloadOne = async (u: UpdateCandidate) => {
    setDownloading(u.mod_id)
    try {
      await window.api.downloadMod(u.new_filename, u.url)
    } catch {
      // user cancelled, or the presigned URL expired — nothing worth surfacing
    }
    setDownloading(null)
  }

  const applyAll = async () => {
    if (!result) return
    const pending = result.updates.filter(u => !applied.includes(u.mod_id))
    if (!confirm(`Update ${pending.length} mod${pending.length === 1 ? '' : 's'}? This replaces the files for everyone in the pack.`)) return

    setPhase('applying')
    for (const u of pending) {
      await applyOne(u)
    }
    setPhase('done')
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  }
  const panel: React.CSSProperties = {
    width: 'min(720px, 92vw)', maxHeight: 'min(600px, 88vh)',
    background: '#12142a', border: '1px solid #22243d', borderRadius: 12,
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  }

  const pending = result ? result.updates.filter(u => !applied.includes(u.mod_id)) : []

  return (
    <div style={overlay} onClick={phase === 'applying' ? undefined : onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22243d', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Mod Updates</h2>
          {phase !== 'applying' && <button className="icon-btn" onClick={onClose}>✕</button>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {phase === 'checking' && (
            <p style={{ color: '#a5b4fc', fontSize: 13, textAlign: 'center', padding: 30 }}>
              Checking Modrinth for newer versions...
              <br />
              <span style={{ color: '#6b6b8a', fontSize: 12 }}>
                The first check on a pack is slow — it hashes every mod.
              </span>
            </p>
          )}

          {phase === 'error' && (
            <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', padding: 30 }}>{error}</p>
          )}

          {result && phase !== 'checking' && phase !== 'error' && (
            <>
              <p style={{ color: '#6b6b8a', fontSize: 12, marginBottom: 16 }}>
                Checked {result.checked} mod{result.checked === 1 ? '' : 's'}.
                {result.unmatched > 0 && ` ${result.unmatched} not found on Modrinth (skipped).`}
              </p>

              {result.updates.length === 0 && (
                <p style={{ color: '#22c55e', fontSize: 14, textAlign: 'center', padding: 20 }}>
                  Everything is up to date.
                </p>
              )}

              {result.updates.map(u => {
                const isApplied = applied.includes(u.mod_id)
                const err = failed[u.mod_id]
                return (
                  <div key={u.mod_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, borderBottom: '1px solid #1a1b30'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {u.new_version_number}
                        <span className="badge" style={{
                          marginLeft: 8,
                          background: u.new_version_type === 'release' ? '#052e16' : '#3b2708',
                          color: u.new_version_type === 'release' ? '#4ade80' : '#fbbf24'
                        }}>
                          {u.new_version_type}
                        </span>
                      </div>
                      <div style={{ color: '#6b6b8a', fontSize: 11, marginTop: 3, fontFamily: 'Consolas, monospace' }}>
                        {u.current_filename}
                      </div>
                      <div style={{ color: '#4ade80', fontSize: 11, marginTop: 1, fontFamily: 'Consolas, monospace' }}>
                        → {u.new_filename}
                      </div>
                      {err && <div style={{ color: '#f87171', fontSize: 11, marginTop: 3 }}>{err}</div>}
                    </div>
                    <button className="icon-btn" title="Download updated mod"
                      disabled={downloading === u.mod_id}
                      onClick={() => downloadOne(u)}>
                      {downloading === u.mod_id
                        ? '…'
                        : <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ display:'block' }}>
                            <path d="M8 1v9M8 10L4.5 6.5M8 10l3.5-3.5M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                      }
                    </button>
                    <button
                      className={isApplied ? 'btn btn-secondary' : 'btn btn-success'}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      disabled={isApplied || applying === u.mod_id || phase === 'applying'}
                      onClick={() => applyOne(u)}>
                      {isApplied ? 'Updated' : applying === u.mod_id ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {result && pending.length > 0 && phase !== 'checking' && phase !== 'error' && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #22243d', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={phase === 'applying'}>
              Close
            </button>
            <button className="btn btn-primary" onClick={applyAll} disabled={phase === 'applying'}>
              {phase === 'applying' ? 'Updating...' : `Update All (${pending.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
