'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DocumentGroup,
  DocumentItem,
  DocumentActivity,
  fetchDocumentGroups,
  fetchDocumentActivity,
  uploadDocument,
} from '@/lib/documents'
import DocumentRow from './DocumentRow'
import UploadModal, { UploadTargetOption } from './UploadModal'

export default function DocumentsDashboard() {
  const [groups, setGroups] = useState<DocumentGroup[]>([])
  const [activity, setActivity] = useState<DocumentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [targets, setTargets] = useState<UploadTargetOption[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [g, a] = await Promise.all([fetchDocumentGroups(), fetchDocumentActivity()])
      setGroups(g)
      setActivity(a)

      // Build upload target list — one entry per listing (each group is now a
      // single business, not split by source table).
      const listingTargets = g
        .filter((grp) => grp.parentId)
        .map((grp) => ({ id: `listing:${grp.parentId}`, source: 'listing' as const, name: grp.parentName }))
      setTargets(listingTargets)
    } catch (err: any) {
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (target: UploadTargetOption, files: File[], category: string) => {
    const source = target.source
    const parentId = target.id.split(':')[1]
    for (const file of files) {
      const result = await uploadDocument({ source, parentId }, file, category)
      if (!result.success) {
        throw new Error(result.error || `Failed to upload ${file.name}`)
      }
    }
    setShowUpload(false)
    await load()
  }

  const handleDeleted = (id: string) => {
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, documents: g.documents.filter((d) => d.id !== id) }))
        .filter((g) => g.documents.length > 0)
    )
  }

  const totalDocuments = groups.reduce((sum, g) => sum + g.documents.length, 0)

  const formatWhen = (iso: string | null) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Documents</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            {totalDocuments} document{totalDocuments === 1 ? '' : 's'} across {groups.length} listing{groups.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, color: '#334155' }}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => setShowUpload(true)}
            style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Upload Document
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
          <strong>Error:</strong> {error}
          <button onClick={load} style={{ marginLeft: '12px', background: 'transparent', border: '1px solid #b91c1c', color: '#b91c1c', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '13px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Layout: documents (left, 2/3) + activity (right, 1/3) */}
      <div className="grid-responsive collapse-md" style={{ '--grid-cols': '2fr 1fr', '--grid-gap': '20px', alignItems: 'start' } as React.CSSProperties}>
        {/* Documents grouped by deal/listing */}
        <div>
          {loading ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Loading documents...
            </div>
          ) : groups.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '2px dashed #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
              <div style={{ fontWeight: 600, color: '#64748b' }}>No documents yet</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>Click "Upload Document" to add your first file.</div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px', overflow: 'hidden' }}>
                {/* Group header */}
                <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>🏢</span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{group.parentName}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{group.documents.length}</span>
                </div>

                {/* Document rows */}
                <div>
                  {group.documents.map((doc: DocumentItem) => (
                    <DocumentRow key={doc.id} doc={doc} onDeleted={handleDeleted} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Activity log */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', position: 'sticky', top: '24px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Activity Log</h2>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
          ) : activity.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '8px' }}>
              No activity yet
            </div>
          ) : (
            <div>
              {activity.map((a) => (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                    {a.actorName ? <><strong>{a.actorName}</strong> {a.action} </> : <>{a.action} </>}
                    <span style={{ color: '#2563eb' }}>{a.docName}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {a.parentName} · {formatWhen(a.at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          targets={targets}
          onClose={() => setShowUpload(false)}
          onSubmit={handleUpload}
        />
      )}
    </div>
  )
}
