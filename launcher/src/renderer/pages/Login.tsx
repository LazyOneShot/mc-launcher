import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const nav = useNavigate()
  useEffect(() => {
    window.api.getSession().then((s: unknown) => { if (s) nav('/home') })
  }, [])
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:24 }}>
      <h1 style={{ fontSize:36, fontWeight:700 }}>MC Launcher</h1>
      <p style={{ color:'#888' }}>Sign in with your Microsoft account to continue</p>
      <button
        onClick={() => window.api.login().then(() => nav('/home'))}
        style={{ padding:'12px 32px', borderRadius:8, border:'none', background:'#00b4d8', color:'#fff', fontSize:16, cursor:'pointer', fontWeight:600 }}
      >
        Sign in with Microsoft
      </button>
    </div>
  )
}
