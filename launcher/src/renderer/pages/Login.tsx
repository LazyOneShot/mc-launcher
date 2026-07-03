import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const nav = useNavigate()
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getSession().then((s: any) => { if (s) nav('/home') })
    window.api.onDeviceCode((d: any) => setDeviceCode(d))
  }, [])

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      await window.api.login()
      nav('/home')
    } catch (e: any) {
      setError(e.message || 'Login failed')
      setLoading(false)
      setDeviceCode(null)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:20, padding:32 }}>
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <h1 style={{ fontSize:38, fontWeight:800, letterSpacing:-1, marginBottom:8 }}>MC Launcher</h1>
        <p style={{ color:'#8888aa', fontSize:14 }}>Cloud-synced modpacks for friends</p>
      </div>

      {!deviceCode && !loading && (
        <>
          <button onClick={handleLogin} className="btn btn-primary" style={{ padding:'12px 32px', fontSize:15 }}>
            Sign in with Microsoft
          </button>
          {error && <p style={{ color:'#f87171', fontSize:13 }}>{error}</p>}
        </>
      )}

      {loading && !deviceCode && <p style={{ color:'#8888aa' }}>Opening browser...</p>}

      {deviceCode && (
        <div className="card" style={{ textAlign:'center', maxWidth:420 }}>
          <p style={{ color:'#a5b4fc', marginBottom:12, fontSize:14 }}>Enter this code at</p>
          <p style={{ color:'#4a7ce8', marginBottom:16, fontSize:13, wordBreak:'break-all' }}>{deviceCode.verificationUri}</p>
          <div style={{ background:'#08091a', padding:'20px 32px', borderRadius:10, marginBottom:12 }}>
            <span style={{ fontSize:32, fontWeight:800, fontFamily:'Consolas, monospace', letterSpacing:8 }}>{deviceCode.userCode}</span>
          </div>
          <p style={{ color:'#6b6b8a', fontSize:12 }}>Waiting for sign-in...</p>
        </div>
      )}
    </div>
  )
}
