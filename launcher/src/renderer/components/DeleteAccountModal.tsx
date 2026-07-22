import React, { useState } from 'react'

interface Props {
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteAccountModal({ onClose, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE'

  const handleDelete = async () => {
    if (!canDelete) return
    setSubmitting(true); setError('')
    try {
      await window.api.deleteAccount()
      onDeleted()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to delete account')
      setSubmitting(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
  }
  const panel: React.CSSProperties = {
    width: 'min(480px, 92vw)',
    background: '#12142a', border: '1px solid #22243d', borderRadius: 12,
    padding: 20
  }

  return (
    <div style={overlay} onClick={submitting ? undefined : onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#f87171' }}>Delete My Account</h2>
        <p style={{ fontSize: 13, color: '#c0c0d8', lineHeight: 1.5 }}>
          This removes your membership from every pack you belong to and permanently deletes your account.
          It can't be undone. If you own any packs, you'll need to transfer or delete them first.
        </p>
        <p style={{ fontSize: 13, color: '#c0c0d8', lineHeight: 1.5, marginTop: 8 }}>
          Type <strong>DELETE</strong> to confirm.
        </p>
        <input
          autoFocus
          className="input"
          style={{ width: '100%', marginTop: 10 }}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder="DELETE"
        />
        {error && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={submitting}>Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger" disabled={submitting || !canDelete}>
            {submitting ? 'Deleting...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
