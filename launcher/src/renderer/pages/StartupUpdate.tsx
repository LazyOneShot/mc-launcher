import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Phase =
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'error'
  | 'ready'

export default function StartupUpdate() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')
  const [updateVersion, setUpdateVersion] = useState('')
  const [currentVersion, setCurrentVersion] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    window.api.currentVersion().then(setCurrentVersion)

    let handledDone = false
    const proceed = () => {
      if (handledDone) return
      handledDone = true
      // Start the 5-min periodic check for mid-session updates
      window.api.startPeriodicCheck()
      nav('/login')
    }

    // Set up listeners. The actual download/install calls now live in the
    // main process (gated on being within the startup window) — this just
    // reflects that state, so there's no risk of double-triggering.
    window.api.onUpdateAvailable((d: { version: string }) => {
      setUpdateVersion(d.version)
      setPhase('downloading')
    })

    window.api.onUpdateProgress((d: { percent: number }) => {
      setPercent(d.percent)
    })

    window.api.onUpdateDownloaded(() => {
      setPhase('installing')
    })

    window.api.onUpdateNone(() => {
      proceed()
    })

    window.api.onUpdateError((d: { message: string }) => {
      // On update errors, don't block startup — just proceed to app
      console.error('Update error:', d.message)
      proceed()
    })

    // Kick off the check
    ;(async () => {
      const supported = await window.api.updateSupported()
      const isDev = !((await window.api.checkForUpdate()) as any).skipped

      // If update system isn't supported (Linux) or dev mode, skip straight to login
      if (!supported) {
        proceed()
        return
      }

      // In dev mode, checkForUpdate returns { skipped: true }, so onUpdateNone won't fire
      // Handle that:
      if (!isDev) {
        proceed()
      }
      // Otherwise, wait for one of the update events (available/none/error) to fire
    })()

    // Safety net — if 30 seconds pass with no event, proceed anyway
    const timeout = setTimeout(() => proceed(), 30000)
    return () => clearTimeout(timeout)
  }, [nav])

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 40,
    textAlign: 'center'
  }

  return (
    <div style={cardStyle}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>MC Launcher</h1>
      {currentVersion && <p style={{ color:'#6b6b8a', fontSize:12, marginBottom:32 }}>v{currentVersion}</p>}

      {phase === 'checking' && (
        <>
          <div className="spinner" style={{
            width: 40, height: 40, borderRadius:'50%',
            border: '3px solid #22243d', borderTop: '3px solid #4a7ce8',
            animation: 'spin 1s linear infinite', marginBottom: 20
          }} />
          <p style={{ color:'#a5b4fc', fontSize:15 }}>Checking for updates...</p>
        </>
      )}

      {phase === 'downloading' && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <p style={{ color:'#a5b4fc', fontSize:15, marginBottom: 20 }}>
            Downloading update {updateVersion && <>v{updateVersion}</>}
          </p>
          <div style={{
            width: '100%', height: 8, background:'#22243d',
            borderRadius: 4, overflow:'hidden'
          }}>
            <div style={{
              width: `${percent}%`, height: '100%',
              background: 'linear-gradient(90deg, #4a7ce8 0%, #22c55e 100%)',
              transition: 'width 0.3s'
            }} />
          </div>
          <p style={{ color:'#6b6b8a', fontSize:12, marginTop: 12 }}>{percent}%</p>
        </div>
      )}

      {phase === 'installing' && (
        <>
          <div className="spinner" style={{
            width: 40, height: 40, borderRadius:'50%',
            border: '3px solid #22243d', borderTop: '3px solid #22c55e',
            animation: 'spin 1s linear infinite', marginBottom: 20
          }} />
          <p style={{ color:'#22c55e', fontSize:15 }}>Installing update, restarting...</p>
        </>
      )}

      {phase === 'error' && (
        <>
          <p style={{ color:'#f87171', fontSize:15, marginBottom: 12 }}>Update failed: {error}</p>
          <button className="btn btn-secondary" onClick={() => nav('/login')}>Continue anyway</button>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
