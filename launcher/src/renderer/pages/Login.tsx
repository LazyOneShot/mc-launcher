import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const nav = useNavigate()
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getSession().then((s: unknown) => { if (s) nav('/home') })
    window.api.onDeviceCode((data: { userCode: string; verificationUri: string }) => setDeviceCode(data))
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:24, padding:32 }}>
      <h1 style={{ fontSize:36, fontWeight:700 }}>MC Launcher</h1>

      {!deviceCode && !loading && (
        <>
          <p style={{ color:'#888' }}>Sign in with your Microsoft account to continue</p>
          <button
            onClick={handleLogin}
            style={{ padding:'12px 32px', borderRadius:8, border:'none', background:'#00b4d8', color:'#fff', fontSize:16, cursor:'pointer', fontWeight:600 }}
          >
            Sign in with Microsoft
          </button>
          {error && <p style={{ color:'#e74c3c', fontSize:14 }}>{error}</p>}
        </>
      )}

      {loading && !deviceCode && (
        <p style={{ color:'#888' }}>Opening browser...</p>
      )}

      {deviceCode && (
        <div style={{ textAlign:'center', background:'#16213e', padding:32, borderRadius:12, maxWidth:420 }}>
          <p style={{ color:'#aaa', marginBottom:16 }}>Your browser should have opened. Enter this code at:</p>
          <p style={{ color:'#00b4d8', marginBottom:16 }}>{deviceCode.verificationUri}</p>
          <div style={{ background:'#0d0d1a', padding:'16px 32px', borderRadius:8, marginBottom:16 }}>
            <span style={{ fontSize:32, fontWeight:700, fontFamily:'monospace', letterSpacing:8 }}>
              {deviceCode.userCode}
            </span>
          </div>
          <p style={{ color:'#555', fontSize:13 }}>Waiting for you to sign in...</p>
        </div>
      )}
    </div>
  )
}