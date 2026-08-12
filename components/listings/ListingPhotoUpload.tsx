'use client'

// ---------------------------------------------------------------------------
// ListingPhotoUpload — attach photos to a listing. Uploads to the public
// `listing_images` bucket, appends to `listings.image_urls`, and lets the
// broker pick which one is the primary (card/hero) image. Persists on every
// change (add/remove/set-primary) rather than deferring to the form's Save
// button, since photo management is naturally its own save-as-you-go flow.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { updateListing } from '@/lib/listings'

const BUCKET = 'listing_images'
const MAX_SIZE = 8 * 1024 * 1024 // 8MB

interface Props {
  listingId: string
  imageUrls: string[]
  primaryImageUrl: string | null
  onChange: (next: { image_urls: string[]; primary_image_url: string | null }) => void
}

export default function ListingPhotoUpload({ listingId, imageUrls, primaryImageUrl, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const persist = async (next: { image_urls: string[]; primary_image_url: string | null }) => {
    onChange(next)
    try {
      await updateListing(listingId, next)
    } catch (e: any) {
      setError(e?.message || 'Could not save photo changes')
    }
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}" is over ${MAX_SIZE / 1024 / 1024}MB — skipped`)
        continue
      }
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `listings/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (upErr) { setError(`Upload failed for "${file.name}": ${upErr.message}`); continue }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      if (data?.publicUrl) uploaded.push(data.publicUrl)
    }
    setUploading(false)
    if (uploaded.length) {
      const nextUrls = [...imageUrls, ...uploaded]
      await persist({ image_urls: nextUrls, primary_image_url: primaryImageUrl || nextUrls[0] })
    }
  }

  const removeImage = async (url: string) => {
    const nextUrls = imageUrls.filter((u) => u !== url)
    const nextPrimary = primaryImageUrl === url ? (nextUrls[0] || null) : primaryImageUrl
    await persist({ image_urls: nextUrls, primary_image_url: nextPrimary })
    // Best-effort storage cleanup — don't block on it.
    const marker = `/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx >= 0) {
      const objectPath = url.slice(idx + marker.length)
      supabase.storage.from(BUCKET).remove([objectPath]).catch(() => {})
    }
  }

  const setPrimary = async (url: string) => {
    await persist({ image_urls: imageUrls, primary_image_url: url })
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 12 }}>
        Photos
      </div>

      {imageUrls.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
          {imageUrls.map((url) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: url === primaryImageUrl ? '2px solid var(--gold)' : '1px solid var(--line)', aspectRatio: '1' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {url === primaryImageUrl && (
                <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--gold)', color: 'var(--navy)', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>PRIMARY</span>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 4, padding: 4, background: 'rgba(26,26,46,0.7)' }}>
                {url !== primaryImageUrl && (
                  <button type="button" onClick={() => setPrimary(url)} title="Set as primary" style={{ flex: 1, fontSize: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 0', cursor: 'pointer' }}>Set Primary</button>
                )}
                <button type="button" onClick={() => removeImage(url)} title="Remove" style={{ fontSize: 10, background: 'rgba(220,38,38,0.75)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
      />
      <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading…' : imageUrls.length ? '+ Add Photos' : '+ Upload Photos'}
      </button>
      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>}
    </div>
  )
}
