import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import Login from './pages/Login'
import Home from './pages/Home'
import PackDetail from './pages/PackDetail'
import CreatePack from './pages/CreatePack'
import UpdateBanner from './components/UpdateBanner'
import TitleBar from './components/TitleBar'

function App() {
  return (
    <>
      <TitleBar />
      <UpdateBanner />
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/pack/:id" element={<PackDetail />} />
          <Route path="/create" element={<CreatePack />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
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
