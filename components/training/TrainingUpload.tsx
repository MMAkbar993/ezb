'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fetchModules, createUpload, TrainingModule } from '@/lib/training'
import { useToast } from '@/components/ui/Toast'

export default function TrainingUpload() {
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [title, setTitle] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [fileType, setFileType] = useState('pdf')
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    fetchModules().then(setModules).catch(() => {})
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPickedFile(f)
    const ext = f.name.split('.').pop()?.toLowerCase() || 'pdf'
    const typeMap: Record<string, string> = { pdf: 'pdf', mp4: 'video', mov: 'video', doc: 'doc', docx: 'doc', xls: 'xlsx', xlsx: 'xlsx', ppt: 'ppt', pptx: 'ppt' }
    setFileType(typeMap[ext] || 'pdf')
  }

  const upload = async () => {
    if (!pickedFile && !fileUrl) { toast('Pick a file or provide a URL.', 'error'); return }
    if (!title.trim()) { toast('Enter a title.', 'error'); return }
    setUploading(true)
    try {
      const brokerId = getBrokerId()
      let url = fileUrl
      if (pickedFile) {
        const path = `training/${brokerId}/${Date.now()}_${pickedFile.name}`
        const { error } = await supabase.storage.from('training').upload(path, pickedFile)
        if (error) throw error
        url = supabase.storage.from('training').getPublicUrl(path).data.publicUrl
      }
      await createUpload({ broker_id: brokerId, title: title.trim(), file_url: url, file_type: fileType, module_id: moduleId || undefined })
      toast('Material uploaded successfully!', 'success')
      setTitle(''); setFileUrl(''); setModuleId(''); setPickedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      toast('Upload failed: ' + (err as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 26 }}>Upload Training Material</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14 }}>
        Share guides, templates, recordings, and resources with the brokerage team.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: 24 }}>
        <label style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          Title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broker Commission Schedule.pdf" />
        </label>

        <label style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          Module (optional)
          <select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">— General / Uncategorized —</option>
            {modules.map((m) => <option key={m.id} value={m.id}>Module {m.order}: {m.title}</option>)}
          </select>
        </label>

        <label style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          File type
          <select className="input" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="pdf">PDF</option>
            <option value="video">Video</option>
            <option value="doc">Document</option>
            <option value="xlsx">Spreadsheet</option>
            <option value="ppt">Presentation</option>
          </select>
        </label>

        <label style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          Upload file
          <input ref={fileInputRef} type="file" onChange={handleFile} className="input" />
          {pickedFile && <span style={{ fontSize: 13, color: 'var(--muted)' }}>Selected: {pickedFile.name}</span>}
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, fontSize: 13, color: 'var(--muted)' }}>
          — or —
        </div>

        <label style={{ fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          File URL (external link)
          <input className="input" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
        </label>

        <button className="btn" onClick={upload} disabled={uploading} style={{ marginTop: 8 }}>
          {uploading ? 'Uploading...' : 'Upload Material'}
        </button>
      </div>
    </div>
  )
}

function getBrokerId(): string {
  if (typeof window === 'undefined') return ''
  const stored = window.localStorage.getItem('concord_broker_id')
  if (stored) return stored
  const id = 'broker-' + Math.random().toString(36).slice(2, 10)
  window.localStorage.setItem('concord_broker_id', id)
  return id
}
