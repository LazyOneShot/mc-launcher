import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeleteAccountModal from '../components/DeleteAccountModal'

export default function Account() {
  const nav = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [skinPath, setSkinPath] = useState<string | null>(null)
  const [variant, setVariant] = useState<'classic' | 'slim'>('classic')
  const [uploading, setUploading] = useState(false)
  const [skinMsg, setSkinMsg] = useState('')
  const [skinError, setSkinError] = useState('')
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)

  useEffect(() => {
    window.api.getSession().then(setSession)
  }, [])

  const handleLogout = async () => {
    await window.api.logout()
    nav('/login')
  }

  const handleAccountDeleted = async () => {
    await window.api.logout()
    nav('/login')
  }

  const handlePickSkin = async () => {
    const path = await window.api.pickSkinFile()
    if (path) { setSkinPath(path); setSkinMsg(''); setSkinError('') }
  }

  const handleUploadSkin = async () => {
    if (!skinPath) return
    setUploading(true); setSkinMsg(''); setSkinError('')
    try {
      await window.api.uploadSkin(skinPath, variant)
      setSkinMsg('Skin updated — it may take a minute to show up in-game.')
      setSkinPath(null)
    } catch (e: any) {
      setSkinError(e?.response?.data?.errorMessage || e?.response?.data?.error || 'Failed to upload skin')
    }
    setUploading(false)
  }

  return (
    <div className="page" style={{ maxWidth:560 }}>
      <button onClick={() => nav('/home')} className="back-link">← Back</button>
      <h1 style={{ marginBottom:24, fontSize:24 }}>Account</h1>

      <div className="card" style={{ marginBottom:20 }}>
        <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:12 }}>PROFILE</h3>
        {session && <p style={{ fontSize:15, marginBottom:16 }}>Signed in as <strong>{session.minecraft_username}</strong></p>}
        <button onClick={handleLogout} className="btn btn-secondary">Sign out</button>
      </div>

      <div className="card" style={{ marginBottom:20 }}>
        <h3 style={{ fontSize:14, color:'#a5b4fc', marginBottom:4 }}>SKIN</h3>
        <p style={{ color:'#8888aa', fontSize:13, marginBottom:12 }}>
          Upload a custom skin PNG. This updates your real Minecraft account and applies everywhere, not just this launcher.
        </p>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
          <button onClick={handlePickSkin} className="btn btn-secondary">Choose PNG...</button>
          {skinPath && <span style={{ fontSize:12, color:'#8888aa', fontFamily:'Consolas, monospace' }}>{skinPath.split(/[\\/]/).pop()}</span>}
        </div>
        <div style={{ display:'flex', gap:16, marginBottom:16, fontSize:13 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="radio" checked={variant === 'classic'} onChange={() => setVariant('classic')} />
            Classic
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="radio" checked={variant === 'slim'} onChange={() => setVariant('slim')} />
            Slim (Alex-style arms)
          </label>
        </div>
        <button onClick={handleUploadSkin} className="btn btn-primary" disabled={!skinPath || uploading}>
          {uploading ? 'Uploading...' : 'Upload Skin'}
        </button>
        {skinMsg && <p style={{ color:'#4ade80', fontSize:13, marginTop:10 }}>{skinMsg}</p>}
        {skinError && <p style={{ color:'#f87171', fontSize:13, marginTop:10 }}>{skinError}</p>}
      </div>

      <div className="card" style={{ borderColor:'#4a1f1f' }}>
        <h3 style={{ fontSize:14, color:'#f87171', marginBottom:12 }}>DANGER ZONE</h3>
        <button onClick={() => setShowDeleteAccount(true)} className="btn btn-danger">Delete My Account</button>
      </div>

      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onDeleted={handleAccountDeleted}
        />
      )}

      <p style={{ color:'#6b6b8a', fontSize:12, marginTop:20, textAlign:'center' }}>
        <a href="https://github.com/LazyOneShot/mc-launcher/blob/main/TERMS.md" target="_blank" rel="noreferrer" style={{ color:'#8888aa' }}>Terms of Service</a>
        {' '}·{' '}
        <a href="https://github.com/LazyOneShot/mc-launcher/blob/main/PRIVACY.md" target="_blank" rel="noreferrer" style={{ color:'#8888aa' }}>Privacy Policy</a>
      </p>
    </div>
  )
}
