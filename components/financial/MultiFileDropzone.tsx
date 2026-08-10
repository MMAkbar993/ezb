'use client'

// =============================================================================
// MultiFileDropzone — drag & drop multiple files with per-file progress bars,
// batch upload, and success/failure notifications.
// =============================================================================

import { useRef, useState } from 'react'
import {
  uploadFinancialFiles, UploadProgress, fileKindOf, FILE_ICON, FILE_COLOR,
  formatBytes,
} from '@/lib/financialFiles'

interface Props {
  parentId: string
  dealId: string | null
  listingId: string | null
  onUploaded: () => void
}

export default function MultiFileDropzone({ parentId, dealId, listingId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<{ ok: number; failed: number; errors: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const incoming = Array.from(list)
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size))
      const unique = incoming.filter((f) => !seen.has(f.name + f.size))
      return [...prev, ...unique]
    })
    setSummary(null)
  }

  const upload = async () => {
    if (files.length === 0 || running) return
    setRunning(true)
    setSummary(null)
    const res = await uploadFinancialFiles(
      { dealId, listingId, parentId },
      files,
      setProgress
    )
    setSummary(res)
    if (res.ok > 0) onUploaded()
    setFiles([])
    setProgress([])
    setRunning(false)
  }

  const removeQueueItem = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setProgress((prev) => prev.filter((_, i) => i !== idx))
  }

  const clearAll = () => { setFiles([]); setProgress([]); setSummary(null) }

  return (
    <div>
      {/* Dropzone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--line)'}`,
          borderRadius: 12, padding: '26px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(201,168,76,0.10)' : '#fff',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 6 }}>⬆️</div>
        <div style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif', fontSize: 15 }}>
          Drag & drop files here, or <span style={{ color: 'var(--gold-dark)', textDecoration: 'underline' }}>browse</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
          Tax returns, P&amp;L, balance sheets, bank statements — PDF, Excel, Word, images. Up to 25MB each.
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Queue */}
      {files.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--cream)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
              {files.length} file{files.length > 1 ? 's' : ''} ready
            </span>
            <span style={{ fontSize: 18, display: 'flex', gap: 6 }}>
              <span
                title="Clear all"
                onClick={clearAll}
                style={{ cursor: 'pointer', opacity: 0.5 }}
              >🗑️</span>
            </span>
          </div>
          {files.map((f, i) => {
            const kind = fileKindOf(f.name)
            const p = progress[i]
            return (
              <div key={f.name + f.size} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>{FILE_ICON[kind]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.name}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatBytes(f.size)}</span>
                  </div>
                  {running && p && !p.error && (
                    <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%', width: `${p.uploaded ? 100 : p.percent}%`,
                          background: p.uploaded ? '#16a34a' : 'var(--gold)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  )}
                  {running && p?.error && (
                    <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4 }}>{p.error}</div>
                  )}
                </div>
                {!running && (
                  <button
                    onClick={() => removeQueueItem(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--muted)' }}
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
                {running && p?.uploaded && <span style={{ color: '#16a34a', fontSize: 15 }}>✓</span>}
              </div>
            )
          })}

          {/* Actions */}
          <div style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-primary" onClick={upload} disabled={running} style={{ fontWeight: 700 }}>
              {running ? 'Uploading…' : `⬆️ Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
            </button>
            <button className="btn-ghost" onClick={clearAll} disabled={running}>Clear</button>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div
          style={{
            marginTop: 12, padding: '12px 14px', borderRadius: 10,
            background: summary.failed === 0 ? '#e8f7ee' : summary.ok > 0 ? '#fdf3e3' : '#fdeaea',
            border: `1px solid ${summary.failed === 0 ? '#16a34a55' : summary.ok > 0 ? '#b4530955' : '#dc262655'}`,
            fontSize: 13, color: 'var(--text)', fontFamily: 'Georgia, serif',
          }}
        >
          <strong>
            {summary.ok > 0 ? `✓ ${summary.ok} file${summary.ok > 1 ? 's' : ''} uploaded successfully` : 'Upload failed'}
            {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
          </strong>
          {summary.errors.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {summary.errors.map((e, i) => <li key={i} style={{ fontSize: 12, marginBottom: 2 }}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
