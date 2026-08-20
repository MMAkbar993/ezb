'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createUpload, fetchModules, getCurrentBrokerIdentity, type TrainingModule } from '@/lib/training'
import { Card, CardHeader, LoadingState, EmptyState, Badge } from '@/components/ui'

export default function TrainingUploadPage() {
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileType, setFileType] = useState('pdf')
  const [moduleId, setModuleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modulesLoaded, setModulesLoaded] = useState(false)

  if (!modulesLoaded) {
    // load module list once (lazy) to avoid a client component splitting concern
    fetchModules()
      .then((m) => { setModules(m); setModulesLoading(false); setModulesLoaded(true) })
      .catch((e) => { console.error(e); setModulesLoading(false); setModulesLoaded(true) })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !fileUrl.trim()) {
      setError('Title and file URL are required.')
      return
    }
    setSaving(true)
    try {
      const { id: brokerId } = await getCurrentBrokerIdentity()
      await createUpload({
        broker_id: brokerId,
        title: title.trim(),
        file_url: fileUrl.trim(),
        file_type: fileType,
        module_id: moduleId || undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Check that the training_uploads table and its RLS policy exist.')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader title="Training Upload" />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>📤</div>
          <EmptyState icon="" title="Material uploaded" subtitle={`"${title}" is now available in the Training Center.`} />
          <Link href="/dashboard/training" className="btn" style={{ textDecoration: 'none' }}>
            ← Back to Training Center
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/training" style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontSize: 14 }}>← Back to Training</Link>
      </div>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Upload Training Material</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Share a PDF, video, doc, or deck with the team.
        </p>
      </header>

      {modulesLoading ? (
        <LoadingState label="Loading modules..." />
      ) : (
        <Card>
          <CardHeader title="New Material" subtitle="Fields marked * are required" />
          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'grid', gap: 16, maxWidth: 560 }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>Title *</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Commission Split Guide"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: 6 }}>File URL *</label>
              <input
                className="input"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://yourbucket.supabase.co/storage/... (or a public URL)"
                style={{ width: '100%' }}
              />
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
                <select className="select" value={fileType} onChange={(e) => setFileType(e.target.value)} style={{ width: '100%' }}>
                  <option value="pdf">PDF 📕</option>
                  <option value="video">Video 🎬</option>
                  <option value="doc">Document 📝</option>
                  <option value="xlsx">Spreadsheet 📊</option>
                  <option value="ppt">Presentation 📽️</option>
                </select>
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 6 }}>Module</label>
                <select className="select" value={moduleId} onChange={(e) => setModuleId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— None —</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Uploading…' : 'Upload Material'}
              </button>
              <Link href="/dashboard/training" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
