'use client'

import { useMemo, useState } from 'react'
import { DOCUMENT_CATEGORIES } from '@/lib/documents'

export interface UploadTargetOption {
  id: string
  source: 'deal' | 'listing'
  name: string
}

interface UploadModalProps {
  targets: UploadTargetOption[]
  onClose: () => void
  onSubmit: (
    target: UploadTargetOption,
    files: File[],
    category: string
  ) => Promise<void>
}

export default function UploadModal({ targets, onClose, onSubmit }: UploadModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>(targets[0]?.id || '')
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const target = useMemo(
    () => targets.find((t) => t.id === selectedTarget) || targets[0],
    [targets, selectedTarget]
  )

  const handleFiles = (list: FileList | null) => {
    if (!list) return
    setFiles(Array.from(list))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) {
      setError('Select a deal or listing to attach the document to.')
      return
    }
    if (files.length === 0) {
      setError('Choose at least one file to upload.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(target, files, category)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#334155' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '16px', maxWidth: '540px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Upload Document</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Target */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Attach to</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              style={inputStyle}
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.source === 'deal' ? '🤝 ' : '🏢 '}{t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Category</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: category === c ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: category === c ? '#dbeafe' : '#fff',
                    color: category === c ? '#1d4ed8' : '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Files */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Files (PDF, Word, Excel)</label>
            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              style={{ width: '100%', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}
            />
            {files.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
                {files.length} file{files.length > 1 ? 's' : ''} selected:
                <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                  {files.map((f) => (
                    <li key={f.name + f.size}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', color: '#475569' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 18px', background: submitting ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600 }}
            >
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
