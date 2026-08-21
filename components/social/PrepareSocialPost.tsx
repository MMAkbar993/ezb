'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader } from '@/components/ui'
import { fetchListings, type Listing } from '@/lib/listings'
import { buildPostContent, buildHashtags, type SocialPlatform, SOCIAL_PLATFORMS } from '@/lib/services/social'

// ---------------------------------------------------------------------------
// Client explicitly asked: when no social API credentials exist yet, don't
// fake a "Posted!" state — instead let the broker generate the exact caption
// + image for a listing and copy/download it for manual posting. Reuses the
// same buildPostContent/buildHashtags logic the (currently credential-less)
// auto-post pipeline already uses, so the generated text always matches what
// would eventually be auto-posted once real API credentials are added.
// ---------------------------------------------------------------------------

export default function PrepareSocialPost() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [listingId, setListingId] = useState('')
  const [platform, setPlatform] = useState<SocialPlatform>('facebook')
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    fetchListings('active').then((rows) => {
      setListings(rows)
      if (rows[0]) setListingId(rows[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const listing = useMemo(() => listings.find((l) => l.id === listingId) || null, [listings, listingId])

  const caption = useMemo(() => {
    if (!listing) return ''
    const body = buildPostContent(listing)
    const tags = buildHashtags()
    return `${body}\n\n${tags}`
  }, [listing])

  const imageUrl = listing?.primary_image_url || listing?.image_urls?.[0] || null

  const copyCaption = async () => {
    if (!caption) return
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setDownloadError('Could not copy — select and copy the text manually.')
    }
  }

  const downloadImage = async () => {
    if (!imageUrl) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error('Image fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(listing?.business_name || 'listing').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Cross-origin storage may block a scripted download — fall back to
      // opening the image so the broker can save it manually.
      setDownloadError('Automatic download blocked — opening the image in a new tab instead. Right-click → Save image.')
      window.open(imageUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card style={{ padding: 0, marginBottom: 20 }}>
      <CardHeader title="Prepare Social Post" subtitle="No social API is connected yet — generate the caption and image here, then post manually on each platform." />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading listings…</div>
        ) : listings.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>No active listings to prepare a post for yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Listing:</label>
              <select value={listingId} onChange={(e) => setListingId(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, minWidth: 220 }}>
                {listings.map((l) => <option key={l.id} value={l.id}>{l.business_name || 'Unnamed listing'}</option>)}
              </select>
              <label style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>Style for:</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6 }}>
                {SOCIAL_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
              </select>
            </div>

            {listing && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {imageUrl && (
                  <img src={imageUrl} alt={listing.business_name || ''} style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                )}
                <div style={{ flex: 1, minWidth: 240 }}>
                  <textarea
                    readOnly
                    value={caption}
                    rows={6}
                    style={{ width: '100%', padding: 10, border: '1px solid var(--line)', borderRadius: 6, fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={copyCaption}>{copied ? '✓ Copied' : 'Copy caption'}</button>
                    <button className="btn btn-ghost" onClick={downloadImage} disabled={!imageUrl || downloading}>
                      {downloading ? 'Preparing…' : '⬇ Download image'}
                    </button>
                  </div>
                  {downloadError && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b45309' }}>{downloadError}</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
