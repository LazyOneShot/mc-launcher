import React, { useEffect, useState, useCallback } from 'react'

interface Hit {
  project_id: string
  slug: string
  title: string
  description: string
  downloads: number
  icon_url: string | null
  author: string
}

interface MRFile {
  filename: string
  url: string
  size: number
  primary: boolean
}

interface MRVersion {
  id: string
  name: string
  version_number: string
  version_type: string
  date_published: string
  files: MRFile[]
}

interface Props {
  packId: string
  mcVersion: string
  loader: string
  installedFilenames: string[]
  onClose: () => void
  onInstalled: () => void
}

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export default function ModrinthBrowser({
  packId, mcVersion, loader, installedFilenames, onClose, onInstalled
}: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Hit | null>(null)
  const [versions, setVersions] = useState<MRVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<string[]>(installedFilenames)

  const search = useCallback(async (q: string) => {
    setLoading(true); setError('')
    try {
      const res = await window.api.modrinthSearch(q, mcVersion, loader, 0)
      setHits(res.hits)
    } catch (e: any) {
      setError(e?.message || 'Search failed')
    }
    setLoading(false)
  }, [mcVersion, loader])

  // Debounce so we aren't firing a request per keystroke — Modrinth allows
  // 300 req/min and a fast typist would burn through that.
  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  const openVersions = async (hit: Hit) => {
    setSelected(hit); setVersions([]); setLoadingVersions(true)
    try {
      const vs = await window.api.modrinthVersions(hit.project_id, mcVersion, loader)
      setVersions(vs)
    } catch (e: any) {
      setError(e?.message || 'Could not load versions')
    }
    setLoadingVersions(false)
  }

  const install = async (v: MRVersion) => {
    const file = v.files.find(f => f.primary) || v.files[0]
    if (!file) {
      setError('This version has no downloadable file')
      return
    }
    setInstalling(v.id); setError('')
    try {
      await window.api.modrinthInstall(packId, file.url, file.filename)
      setInstalled(list => [...list, file.filename])
      onInstalled()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Install failed')
    }
    setInstalling(null)
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  }
  const panel: React.CSSProperties = {
    width: 'min(860px, 92vw)', height: 'min(640px, 88vh)',
    background: '#12142a', border: '1px solid #22243d', borderRadius: 12,
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #22243d', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>
              {selected ? selected.title : 'Browse Modrinth'}
            </h2>
            <p style={{ color: '#6b6b8a', fontSize: 12, marginTop: 2 }}>
              {mcVersion} • {loader}
            </p>
          </div>
          {selected && (
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => { setSelected(null); setVersions([]) }}>
              ← Back to search
            </button>
          )}
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '8px 20px', color: '#f87171', fontSize: 13, borderBottom: '1px solid #22243d' }}>
            {error}
          </div>
        )}

        {!selected && (
          <>
            <div style={{ padding: '12px 20px' }}>
              <input className="input" autoFocus placeholder="Search mods..."
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {loading && <p style={{ color: '#6b6b8a', fontSize: 13, padding: 20, textAlign: 'center' }}>Searching...</p>}

              {!loading && hits.length === 0 && (
                <p style={{ color: '#6b6b8a', fontSize: 13, padding: 20, textAlign: 'center' }}>
                  No mods found for {mcVersion} / {loader}.
                </p>
              )}

              {hits.map(hit => (
                <div key={hit.project_id} onClick={() => openVersions(hit)}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'center', padding: 12,
                    borderBottom: '1px solid #1a1b30', cursor: 'pointer'
                  }}>
                  {hit.icon_url
                    ? <img src={hit.icon_url} width={44} height={44} style={{ borderRadius: 6, flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 6, background: '#22243d', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{hit.title}</div>
                    <div style={{
                      color: '#8888aa', fontSize: 12, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {hit.description}
                    </div>
                  </div>
                  <div style={{ color: '#6b6b8a', fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
                    <div>{fmtDownloads(hit.downloads)} ↓</div>
                    <div style={{ marginTop: 2 }}>{hit.author}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selected && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {loadingVersions && <p style={{ color: '#6b6b8a', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading versions...</p>}

            {!loadingVersions && versions.length === 0 && (
              <p style={{ color: '#6b6b8a', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No versions of this mod support {mcVersion} on {loader}.
              </p>
            )}

            {versions.map(v => {
              const file = v.files.find(f => f.primary) || v.files[0]
              const already = file && installed.includes(file.filename)
              return (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  borderBottom: '1px solid #1a1b30'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {v.version_number}
                      <span className="badge" style={{
                        marginLeft: 8,
                        background: v.version_type === 'release' ? '#052e16' : '#3b2708',
                        color: v.version_type === 'release' ? '#4ade80' : '#fbbf24'
                      }}>
                        {v.version_type}
                      </span>
                    </div>
                    <div style={{ color: '#6b6b8a', fontSize: 11, marginTop: 3, fontFamily: 'Consolas, monospace' }}>
                      {file ? file.filename : 'no file'}
                    </div>
                  </div>
                  <button
                    className={already ? 'btn btn-secondary' : 'btn btn-success'}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                    disabled={!file || already || installing === v.id}
                    onClick={() => install(v)}>
                    {already ? 'Installed' : installing === v.id ? 'Installing...' : 'Add to Pack'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
