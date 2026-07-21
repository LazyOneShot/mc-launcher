import React, { useEffect, useState } from 'react'

type State =
  | { kind: 'idle' }
  | { kind: 'available'; version: string; releaseNotes: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

function notesToText(releaseNotes: any): string {
  if (typeof releaseNotes === 'string') return releaseNotes
  if (Array.isArray(releaseNotes)) return releaseNotes.map(n => n.note).filter(Boolean).join('\n\n')
  return ''
}

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    window.api.onUpdateAvailable((d: { version: string; releaseNotes: any }) =>
      setState({ kind: 'available', version: d.version, releaseNotes: notesToText(d.releaseNotes) }))
    window.api.onUpdateProgress((d: { percent: number }) => setState({ kind: 'downloading', percent: d.percent }))
    window.api.onUpdateDownloaded((d: { version: string }) => setState({ kind: 'ready', version: d.version }))
    window.api.onUpdateError((d: { message: string }) => setState({ kind: 'error', message: d.message }))
  }, [])

  if (state.kind === 'idle' || state.kind === 'error') return null

  const bannerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: state.kind === 'ready' ? '#16a34a' : '#4a7ce8',
    color: '#fff',
    padding: '10px 24px',
    fontSize: 13,
    fontWeight: 600
  }

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }

  const btn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12
  }

  const linkBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)',
    cursor: 'pointer', fontWeight: 600, fontSize: 11, padding: 0, textDecoration: 'underline'
  }

  if (state.kind === 'available') return (
    <div style={bannerStyle}>
      <div style={row}>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          Update available: v{state.version}
          {state.releaseNotes && (
            <button style={linkBtn} onClick={() => setShowNotes(s => !s)}>
              {showNotes ? "Hide what's new" : "What's new"}
            </button>
          )}
        </span>
        <button style={btn} onClick={() => window.api.downloadUpdate()}>Download now</button>
      </div>
      {showNotes && state.releaseNotes && (
        <div style={{
          marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 6,
          fontWeight: 'normal', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto'
        }}>
          {state.releaseNotes}
        </div>
      )}
    </div>
  )

  if (state.kind === 'downloading') return (
    <div style={bannerStyle}>
      <div style={row}>
        <span>Downloading update... {state.percent}%</span>
      </div>
    </div>
  )

  if (state.kind === 'ready') return (
    <div style={bannerStyle}>
      <div style={row}>
        <span>✓ Update v{state.version} ready — restart to install</span>
        <button style={btn} onClick={() => window.api.installUpdate()}>Restart now</button>
      </div>
    </div>
  )

  return null
}
