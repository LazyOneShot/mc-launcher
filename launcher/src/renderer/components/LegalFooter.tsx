import React from 'react'

/**
 * Fixed, low-contrast Terms/Privacy links in the bottom-left corner,
 * present on every page — mirrors VersionBadge's bottom-right placement.
 */
export default function LegalFooter() {
  const linkStyle: React.CSSProperties = { color: '#4a4a63', textDecoration: 'none' }

  return (
    <div style={{
      position: 'fixed',
      bottom: 8,
      left: 12,
      fontSize: 11,
      fontFamily: 'Consolas, monospace',
      zIndex: 50
    }}>
      <a href="https://github.com/LazyOneShot/mc-launcher/blob/main/TERMS.md" target="_blank" rel="noreferrer" style={linkStyle}>Terms</a>
      <span style={{ color: '#4a4a63' }}> · </span>
      <a href="https://github.com/LazyOneShot/mc-launcher/blob/main/PRIVACY.md" target="_blank" rel="noreferrer" style={linkStyle}>Privacy</a>
    </div>
  )
}
