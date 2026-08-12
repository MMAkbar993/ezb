'use client'

// =============================================================================
// AllDocumentsView — unified table of ALL financial documents (source uploads
// + auto-generated Recast/BOV/CIM/BLI) with status, download-all ZIP, and
// per-file preview/download.
// =============================================================================

import { useMemo, useState } from 'react'
import type { FinancialDoc, FinancialStatus } from '@/lib/financialFiles'
import { formatBytes, getSignedFileUrl } from '@/lib/financialFiles'
import { FileTypeBadge, CategoryBadge, StatusPill } from '@/components/financial/FilesUI'
import { downloadDocsAsZip } from '@/lib/zip'

interface Props {
  docs: FinancialDoc[]
  onRefresh: () => void
  onDelete: (doc: FinancialDoc) => void
  dealTitle: (id: string | null) => string
}

type Filter = 'all' | 'uploaded' | 'generated' | FinancialStatus

export default function AllDocumentsView({ docs, onRefresh, onDelete, dealTitle }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [zipping, setZipping] = useState(false)
  const [zipMsg, setZipMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return docs
    if (filter === 'uploaded') return docs.filter((d) => d.category !== 'generated_document')
    if (filter === 'generated') return docs.filter((d) => d.category === 'generated_document')
    return docs.filter((d) => d.status === filter)
  }, [docs, filter])

  const generated = docs.filter((d) => d.category === 'generated_document')
  const uploaded = docs.filter((d) => d.category !== 'generated_document')

  // Financial documents live in a private bucket — resolve a fresh signed
  // URL right before opening/downloading rather than using the stored
  // (no longer publicly accessible) file_url directly.
  const openDoc = async (d: FinancialDoc) => {
    const url = await getSignedFileUrl(d.storage_path)
    if (url) window.open(url, '_blank', 'noreferrer')
  }
  const downloadDoc = async (d: FinancialDoc) => {
    const url = await getSignedFileUrl(d.storage_path)
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = d.file_name
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const onZip = async () => {
    const targets = filtered.length ? filtered : docs
    if (!targets.length) return
    setZipping(true)
    setZipMsg(null)
    const res = await downloadDocsAsZip(
      targets.map((d) => ({ file_name: d.file_name, file_url: d.file_url, storage_path: d.storage_path })),
      `financial-documents-${new Date().toISOString().slice(0, 10)}.zip`,
      (m) => setZipMsg(m),
      async (d) => getSignedFileUrl(d.storage_path),
    )
    setZipMsg(`ZIP: ${res.ok} downloaded, ${res.failed} failed`)
    setZipping(false)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['all', `All (${docs.length})`],
            ['uploaded', `Uploaded (${uploaded.length})`],
            ['generated', `Generated (${generated.length})`],
            ['recast_done', 'Recast'],
            ['bov_done', 'BOV'],
            ['cim_done', 'CIM'],
            ['bli_done', 'BLI'],
            ['failed', 'Failed'],
          ] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === key ? 'var(--navy)' : '#fff',
                color: filter === key ? 'var(--gold-light)' : 'var(--muted)',
                border: `1px solid ${filter === key ? 'var(--navy)' : 'var(--line)'}`,
                fontFamily: 'Georgia, serif',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
          <button
            onClick={onZip}
            disabled={zipping || !filtered.length}
            className="btn-primary"
            style={{ fontWeight: 700 }}
          >
            {zipping ? '⏳ Zipping…' : '⬇️ Download ZIP'}
          </button>
        </div>
      </div>

      {zipMsg && (
        <div style={{ margin: '0 0 12px', padding: '9px 12px', background: '#fdf3e3', border: '1px solid #b4530955', borderRadius: 8, fontSize: 12.5, color: 'var(--text)', fontFamily: 'Georgia, serif' }}>
          {zipMsg}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            No documents in this view. Upload files or run auto-generation to populate it.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Georgia, serif', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--gold-dark)', textAlign: 'left', background: '#faf9f5' }}>
                {['Document', 'Deal / Listing', 'Category', 'Status', 'Size', 'Modified', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--navy)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const generated = f.category === 'generated_document'
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--line)', background: generated ? 'rgba(201,168,76,0.04)' : '#fff' }}>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 280 }}>
                        <span style={{ fontSize: 19 }}>{generated ? (f.file_name.includes('Recast') ? '🔄' : f.file_name.includes('BOV') ? '⚖️' : f.file_name.includes('CIM') ? '📑' : f.file_name.includes('BLI') ? '📋' : '📄') : '📎'}</span>
                        <div style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() => openDoc(f)}
                            style={{ fontWeight: 600, color: 'var(--navy)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                            title={f.file_name}
                          >
                            {f.file_name}
                          </button>
                          <div style={{ marginTop: 3 }}><FileTypeBadge kind={f.file_kind as any} size="sm" /></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px', color: 'var(--text)', maxWidth: 150 }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={dealTitle(f.deal_id || f.listing_id)}>
                        {dealTitle(f.deal_id || f.listing_id)}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px' }}><CategoryBadge category={f.category as any} /></td>
                    <td style={{ padding: '11px 12px' }}><StatusPill status={(f.status || 'pending') as FinancialStatus} /></td>
                    <td style={{ padding: '11px 12px', color: 'var(--muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{formatBytes(f.file_size)}</td>
                    <td style={{ padding: '11px 12px', color: 'var(--muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      {f.uploaded_at ? new Date(f.uploaded_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          title="Download"
                          onClick={() => downloadDoc(f)}
                          className="btn-ghost"
                          style={{ padding: '5px 9px', fontSize: 13, display: 'inline-flex', alignItems: 'center' }}
                        >⬇️</button>
                        <button
                          title="Delete"
                          onClick={() => onDelete(f)}
                          className="btn-danger"
                          style={{ padding: '5px 9px', fontSize: 13 }}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
