'use client'

import { useState } from 'react'
import {
  DocumentItem,
  fileKind,
  fileIcon,
  getDownloadUrl,
  deleteDocument,
} from '@/lib/documents'

interface DocumentRowProps {
  doc: DocumentItem
  onDeleted: (id: string) => void
}

const SOURCE_BADGE: Record<DocumentItem['source'], { label: string; color: string; bg: string }> = {
  financial: { label: 'FINANCIAL', color: '#1d4ed8', bg: '#dbeafe' },
  deal: { label: 'DEAL', color: '#a16207', bg: '#fef3c7' },
  listing: { label: 'LEGAL', color: '#15803d', bg: '#dcfce7' },
  seller_form: { label: 'SELLER FORM', color: '#15803d', bg: '#dcfce7' },
  buyer_form: { label: 'BUYER FORM', color: '#7c3aed', bg: '#ede9fe' },
}

const READ_ONLY_SOURCES: DocumentItem['source'][] = ['seller_form', 'buyer_form']

export default function DocumentRow({ doc, onDeleted }: DocumentRowProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(doc.fileUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const kind = fileKind(doc.fileUrl || doc.fileName)
  const badge = SOURCE_BADGE[doc.source]

  const openPreview = async () => {
    setPreviewOpen(true)
    if (!doc.fileUrl) {
      const url = await getDownloadUrl(doc)
      setPreviewUrl(url)
    }
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    const url = await getDownloadUrl(doc)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = doc.fileName || 'document'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.fileName}"?`)) return
    setBusy(true)
    setError('')
    const result = await deleteDocument(doc)
    if (result.success) {
      onDeleted(doc.id)
    } else {
      setError(result.error || 'Failed to delete document')
    }
    setBusy(false)
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>{fileIcon(kind)}</span>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', cursor: 'pointer' }} onClick={openPreview}>
              {doc.fileName}
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: badge.color, background: badge.bg, padding: '1px 7px', borderRadius: '999px' }}>{badge.label}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {doc.category || 'General'} · {formatDate(doc.createdAt)}
            {doc.uploadedByName && doc.uploadedByName !== '—' && ` · by ${doc.uploadedByName}`}
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={openPreview}
            style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#334155' }}
          >
            Preview
          </button>
          <button
            onClick={handleDownload}
            style={{ padding: '6px 12px', background: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: '#fff' }}
          >
            Download
          </button>
          {!READ_ONLY_SOURCES.includes(doc.source) && (
            <button
              onClick={handleDelete}
              disabled={busy}
              style={{ padding: '6px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', cursor: busy ? 'not-allowed' : 'pointer', color: '#b91c1c' }}
            >
              {busy ? '…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '760px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{doc.fileName}</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#fff' }}>
              {previewUrl ? (
                kind === 'image' ? (
                  <img src={previewUrl} alt={doc.fileName || ''} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                ) : kind === 'pdf' ? (
                  <iframe src={previewUrl} title={doc.fileName || ''} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>{fileIcon(kind)}</div>
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Preview not available for this file type.</p>
                    <p style={{ margin: '0 0 16px', fontSize: '14px' }}>Download it to open in its native application.</p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
                    >
                      ⬇ Download
                    </a>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Loading preview…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
