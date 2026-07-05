import React, { useEffect, useState } from 'react'

type State =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    window.api.onUpdateAvailable((d: { version: string }) => setState({ kind: 'available', version: d.version }))
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600
  }

  const btn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12
  }

  if (state.kind === 'available') return (
    <div style={bannerStyle}>
      <span>Update available: v{state.version}</span>
      <button style={btn} onClick={() => window.api.downloadUpdate()}>Download now</button>
    </div>
  )

  if (state.kind === 'downloading') return (
    <div style={bannerStyle}>
      <span>Downloading update... {state.percent}%</span>
    </div>
  )

  if (state.kind === 'ready') return (
    <div style={bannerStyle}>
      <span>✓ Update v{state.version} ready — restart to install</span>
      <button style={btn} onClick={() => window.api.installUpdate()}>Restart now</button>
    </div>
  )

  return null
}
