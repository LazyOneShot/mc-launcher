import React, { useEffect, useState } from 'react'

/**
 * Fixed, low-contrast version string in the bottom-right corner.
 * pointerEvents: none so it can never intercept a click on whatever is under it.
 */
export default function VersionBadge() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.currentVersion().then(setVersion).catch(() => {})
  }, [])

  if (!version) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 8,
      right: 12,
      fontSize: 11,
      color: '#4a4a63',
      fontFamily: 'Consolas, monospace',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 50
    }}>
      v{version}
    </div>
  )
}
