import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './styles.css'
import StartupUpdate from './pages/StartupUpdate'
import Login from './pages/Login'
import Home from './pages/Home'
import PackDetail from './pages/PackDetail'
import CreatePack from './pages/CreatePack'
import BrowsePacks from './pages/BrowsePacks'
import AdminPanel from './pages/AdminPanel'
import Account from './pages/Account'
import UpdateBanner from './components/UpdateBanner'
import TitleBar from './components/TitleBar'
import VersionBadge from './components/VersionBadge'

function App() {
  const nav = useNavigate()

  useEffect(() => {
    window.api.onSessionExpired(() => nav('/login'))
  }, [])

  return (
    <>
      <TitleBar />
      <UpdateBanner />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<StartupUpdate />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/pack/:id" element={<PackDetail />} />
          <Route path="/create" element={<CreatePack />} />
          <Route path="/browse" element={<BrowsePacks />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <VersionBadge />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
