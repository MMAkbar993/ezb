'use client'

// =============================================================================
// vCard generator — full vCard 3.0 / 4.0 format for contact saving.
// Produces both a raw .vcf string and a JSONB-ready payload. The JSONB payload
// is stored on broker_profiles.vcard_data so the QR/contact flow never has to
// rebuild it, and the .vcf string is used for one-click "save to contacts"
// downloads on the public card + QR scan pages.
// =============================================================================

export interface VCardContact {
  firstName: string
  lastName: string
  phone: string
  email: string
  company: string
  title: string
  website: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  note?: string
  /** Public URL to the broker photo (embedded as base64 PHOTO if provided). */
  photoUrl?: string | null
  /** Stable URL the QR encodes (the scan page). */
  qrUrl?: string
}

const escape = (v: string): string =>
  v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

/** Normalize name into parts (FN + N). */
function nameParts(c: VCardContact): { full: string; first: string; last: string } {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || 'Contact'
  return { full, first: c.firstName?.trim() || '', last: c.lastName?.trim() || '' }
}

function adr(c: VCardContact): string {
  const parts = [
    (c.addressLine1 || '') + (c.addressLine2 ? ` ${c.addressLine2}` : ''),
    c.city || '',
    c.state || '',
    c.zip || '',
    c.country || 'US',
  ]
  return parts.join(';').replace(/;{2,}/g, ';')
}

/**
 * Build the full vCard 3.0/4.0 .vcf string. Includes FN/N, TEL, EMAIL, ORG,
 * TITLE, URL, ADR, NOTE, and an embedded base64 PHOTO when a photo URL can be
 * fetched. Falls back gracefully (no photo) when embedding fails.
 */
export function generateVCardString(c: VCardContact, photoBase64?: string | null): string {
  const { full, first, last } = nameParts(c)
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(full)}`]
  if (first || last) lines.push(`N:${escape(last)};${escape(first)};;;`)
  if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${escape(c.phone)}`)
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(c.email)}`)
  if (c.company) lines.push(`ORG:${escape(c.company)}`)
  if (c.title) lines.push(`TITLE:${escape(c.title)}`)
  if (c.website) lines.push(`URL:${escape(c.website)}`)
  if (c.addressLine1 || c.city) lines.push(`ADR;TYPE=WORK:;;${escape(adr(c))}`)
  if (c.note || c.qrUrl) lines.push(`NOTE:${escape((c.note || '') + (c.qrUrl ? (c.note ? ' ' : '') + c.qrUrl : ''))}`)
  if (photoBase64) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64}`)
  }
  lines.push('END:VCARD')
  return lines.join('\r\n') + '\r\n'
}

/**
 * JSONB-friendly vCard payload — exactly what's stored on broker_profiles
 * .vcard_data. Keeps a compact vcf string + structured fields for rebuilding.
 */
export function buildVCardJson(c: VCardContact): Record<string, unknown> {
  const { full } = nameParts(c)
  return {
    version: '3.0',
    fn: full,
    tel: c.phone || '',
    email: c.email || '',
    org: c.company || '',
    title: c.title || '',
    url: c.website || '',
    adr: c.addressLine1 || c.city ? adr(c) : '',
    note: c.note || '',
    qrUrl: c.qrUrl || '',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Convert a public image URL to a base64 data string for embedding in the vCard
 * PHOTO field. Server- or client-side (browser allows CORS-free fetch of same-origin
 * / storage public URLs). Returns null on any failure.
 */
export async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
    }
    return btoa(bin)
  } catch {
    return null
  }
}

/** Build a downloadable .vcf Blob URL for one-click contact saving. */
export function vcfDownloadUrl(vcf: string): string {
  return URL.createObjectURL(new Blob([vcf], { type: 'text/vcard' }))
}
