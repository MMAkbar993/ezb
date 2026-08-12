'use client'

// =============================================================================
// FileTypeBadge + FilePreviewModal + WorkflowButtons — shared building blocks
// for the Financial Files system.
// =============================================================================

import { useEffect, useState } from 'react'
import {
  FileKind, FILE_ICON, FILE_COLOR, FILE_LABEL,
  FinancialCategory, CATEGORY_LABELS, CATEGORY_COLORS,
  FinancialStatus, STATUS_LABELS, STATUS_COLORS,
  previewKind, getSignedFileUrl,
} from '@/lib/financialFiles'

// ---------------------------------------------------------------------------
// File type badge (PDF / Excel / Word / Image / Other)
// ---------------------------------------------------------------------------
export function FileTypeBadge({ kind, size = 'md' }: { kind: FileKind; size?: 'sm' | 'md' }) {
  const fontSize = size === 'sm' ? 10.5 : 12
  const pad = size === 'sm' ? '3px 8px' : '4px 10px'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: `${FILE_COLOR[kind]}14`, color: FILE_COLOR[kind],
        border: `1px solid ${FILE_COLOR[kind]}33`,
        borderRadius: 6, padding: pad, fontSize, fontWeight: 700,
        fontFamily: 'Georgia, serif', letterSpacing: 0.3, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: size === 'sm' ? 11 : 13 }}>{FILE_ICON[kind]}</span>
      {FILE_LABEL[kind]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Category badge (Tax Return / Financial Statement / etc.)
// ---------------------------------------------------------------------------
export function CategoryBadge({ category }: { category: FinancialCategory }) {
  const c = CATEGORY_COLORS[category] || '#7a7a8a'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        background: `${c}14`, color: c,
        border: `1px solid ${c}33`,
        borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600,
        fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
      }}
    >
      {CATEGORY_LABELS[category] || category}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status pill (Pending / Processed / Recast Done / BOV Done / CIM Done)
// ---------------------------------------------------------------------------
export function StatusPill({ status }: { status: FinancialStatus }) {
  const c = STATUS_COLORS[status] || '#7a7a8a'
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${c}14`, color: c,
        border: `1px solid ${c}33`,
        borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600,
        fontFamily: 'Georgia, serif', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Preview modal — renders PDFs in an iframe, images as <img>, and a
// download prompt for Excel/Word/Other.
// ---------------------------------------------------------------------------
export function FilePreviewModal({
  doc, onClose,
}: {
  doc: { file_name: string; file_url: string; file_kind: FileKind; storage_path?: string | null } | null
  onClose: () => void
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Financial documents live in a private bucket — resolve a short-lived
  // signed URL for whichever document is open, rather than relying on the
  // (no longer functional) permanent public URL.
  useEffect(() => {
    let cancelled = false
    setResolvedUrl(null)
    if (!doc) return
    setResolving(true)
    getSignedFileUrl(doc.storage_path).then((url) => {
      if (!cancelled) { setResolvedUrl(url || doc.file_url); setResolving(false) }
    })
    return () => { cancelled = true }
  }, [doc?.storage_path, doc?.file_url])

  if (!doc) return null
  const kind = previewKind(doc.file_kind)
  const url = resolvedUrl || ''

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,20,0.72)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, width: 'min(900px, 100%)',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>
            <span>{FILE_ICON[doc.file_kind]}</span>
            <span style={{ maxWidth: 560 }}>{doc.file_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={url || undefined}
              download={doc.file_name}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!url}
              style={{ background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, fontSize: 12.5, borderRadius: 6, padding: '7px 14px', textDecoration: 'none', opacity: url ? 1 : 0.5, pointerEvents: url ? 'auto' : 'none' }}
            >
              {resolving ? 'Preparing…' : '↓ Download'}
            </a>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f0f0f4' }}>
          {kind === 'pdf' && (
            url ? <iframe src={url} title={doc.file_name} style={{ width: '100%', height: '72vh', border: 'none', background: '#fff' }} /> : <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading preview…</div>
          )}
          {kind === 'img' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url && <img src={url} alt={doc.file_name} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }} />}
            </div>
          )}
          {kind === 'none' && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>
              <div style={{ fontSize: 54, marginBottom: 12 }}>{FILE_ICON[doc.file_kind]}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Preview not available for this file type</div>
              <div style={{ fontSize: 13 }}>Download the file to open it in its native app.</div>
              <a
                href={url || undefined}
                download={doc.file_name}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none', opacity: url ? 1 : 0.5, pointerEvents: url ? 'auto' : 'none' }}
              >
                {resolving ? 'Preparing…' : '↓ Download'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart workflow buttons — shown after upload / per deal.
// ---------------------------------------------------------------------------
export interface WorkflowAction {
  key: string
  label: string
  icon: string
  desc: string
  href: string
  color: string
}

export const WORKFLOW_ACTIONS: WorkflowAction[] = [
  { key: 'recast', label: 'Run Recast', icon: '🔄', desc: 'Recast financials from uploaded docs', href: '/recast', color: '#a8872f' },
  { key: 'bov', label: 'Generate BOV', icon: '⚖️', desc: 'Broker Opinion of Value', href: '/bov', color: '#0f3460' },
  { key: 'cim', label: 'Generate CIM', icon: '📑', desc: 'Confidential Information Memorandum', href: '/cim', color: '#1a3a8f' },
  { key: 'bli', label: 'Generate BLI', icon: '📋', desc: 'Business Listing Information', href: '/dashboard/listings/new', color: '#0e7490' },
  { key: 'sba', label: 'SBA Qualification', icon: '💰', desc: 'Check SBA eligibility', href: '/recast', color: '#16a34a' },
  { key: 'dash', label: 'Financial Dashboard', icon: '📈', desc: 'All financial metrics', href: '/dashboard/financial-files', color: '#dc2626' },
]

export function WorkflowButtons({ dealId, listingId }: { dealId?: string | null; listingId?: string | null }) {
  const target = dealId || listingId || ''
  return (
    <div>
      <div style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--gold-dark)', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 10 }}>
        Smart Workflows
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {WORKFLOW_ACTIONS.map((a) => {
          const href = target ? `${a.href}${a.href.includes('?') ? '&' : '?'}deal=${target}` : a.href
          return (
            <a
              key={a.key}
              href={href}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px',
                background: '#fff', border: '1px solid var(--line)', borderLeft: `4px solid ${a.color}`,
                borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(26,26,46,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif', fontSize: 14 }}>
                <span style={{ fontSize: 17 }}>{a.icon}</span>
                {a.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>{a.desc}</div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
