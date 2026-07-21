import React, { useState } from 'react'

interface Props {
  title: string
  onSubmit: (reason: string) => Promise<void>
  onClose: () => void
}

export default function ReportModal({ title, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please describe the issue'); return }
    setSubmitting(true); setError('')
    try {
      await onSubmit(reason.trim())
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to submit report')
    }
    setSubmitting(false)
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  }
  const panel: React.CSSProperties = {
    width: 'min(440px, 92vw)',
    background: '#12142a', border: '1px solid #22243d', borderRadius: 12,
    padding: 20
  }

  return (
    <div style={overlay} onClick={submitting ? undefined : onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
        {done ? (
          <p style={{ color: '#4ade80', fontSize: 14 }}>Reported. Thanks for flagging it.</p>
        ) : (
          <>
            <textarea
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="What's wrong?"
              style={{
                width: '100%', minHeight: 90, padding: '10px 14px', borderRadius: 8,
                border: '1px solid #2a2a4a', background: '#0d0d1a', color: '#fff',
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit'
              }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={onClose} className="btn btn-secondary" disabled={submitting}>Cancel</button>
              <button onClick={handleSubmit} className="btn btn-danger" disabled={submitting}>
                {submitting ? 'Reporting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
