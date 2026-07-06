import React, { useEffect, useState } from 'react'

export default function TitleBar() {
  const [isMax, setIsMax] = useState(false)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    window.api.useCustomTitleBar().then(setEnabled)
    window.api.isMaximized().then(setIsMax)
  }, [])

  // Don't render anything until we know whether to (avoids flash)
  if (enabled === null) return null
  // On Mac/Linux, native chrome handles this — render nothing
  if (!enabled) return null

  const handleMinimize = () => window.api.minimizeWindow()
  const handleMaximize = async () => {
    await window.api.maximizeWindow()
    setIsMax(await window.api.isMaximized())
  }
  const handleClose = () => window.api.closeWindow()

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <span className="titlebar-title">MC Launcher</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title={isMax ? 'Restore' : 'Maximize'}>
          {isMax ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 0h8v8h-2M0 2h8v8H0V2z" stroke="currentColor" strokeWidth="1" fill="none"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0 0h10v10H0V0z" stroke="currentColor" strokeWidth="1" fill="none"/>
            </svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-close" onClick={handleClose} title="Close to tray">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
