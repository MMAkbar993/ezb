// =============================================================================
// lib/zip.ts — dependency-free in-browser ZIP writer (STORE method).
// -----------------------------------------------------------------------------
// Produces a valid, standard ZIP archive from a list of { name, bytes } using
// the STORE (no compression) method, so it works entirely in the browser with
// zero dependencies. CRC-32 is computed manually. File sizes are limited to
// 4GB (standard ZIP). Bulk "Download all as ZIP" utility.
// =============================================================================

export interface ZipEntry {
  name: string
  bytes: Uint8Array
}

// CRC-32 (IEEE) lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// Signed 32-bit write with implicit conversion (Uint8Array is 0-255 ok)
function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true)
}
function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

/**
 * Build a ZIP archive (STORE method) from entries. Fully browser-safe.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  let totalSize = 0
  for (let i = 0; i < entries.length; i++) totalSize += entries[i].bytes.length

  // Local file headers: 30 bytes each + name + data
  // Central directory: 46 bytes each + name
  let centralOffset = 0
  for (const e of entries) centralOffset += 30 + e.name.length + e.bytes.length

  const centralSize = entries.reduce((s, e) => s + 46 + e.name.length, 0)
  const eocdSize = 22
  const endOffset = centralOffset + centralSize

  const buf = new Uint8Array(new ArrayBuffer(endOffset + eocdSize))
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  let offset = 0
  const centralOffsets: number[] = []

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    centralOffsets.push(offset)

    // Local file header
    writeU32(view, offset, 0x04034b50) // signature
    writeU16(view, offset + 4, 20)     // version needed
    writeU16(view, offset + 6, 0)      // flags
    writeU16(view, offset + 8, 0)      // method: STORE
    writeU16(view, offset + 10, 0)     // mod time
    writeU16(view, offset + 12, 0x21)  // mod date (1980-01-01)
    writeU32(view, offset + 14, crc)
    writeU32(view, offset + 18, size)
    writeU32(view, offset + 22, size)
    writeU16(view, offset + 26, nameBytes.length)
    writeU16(view, offset + 28, 0)     // extra len
    buf.set(nameBytes, offset + 30)
    buf.set(entry.bytes, offset + 30 + nameBytes.length)

    offset += 30 + nameBytes.length + size
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    // Central directory header
    writeU32(view, offset, 0x02014b50) // signature
    writeU16(view, offset + 4, 20)     // version made by
    writeU16(view, offset + 6, 20)     // version needed
    writeU16(view, offset + 8, 0)      // flags
    writeU16(view, offset + 10, 0)     // method
    writeU16(view, offset + 12, 0)     // mod time
    writeU16(view, offset + 14, 0x21)  // mod date
    writeU32(view, offset + 16, crc)
    writeU32(view, offset + 20, size)
    writeU32(view, offset + 24, size)
    writeU16(view, offset + 28, nameBytes.length)
    writeU16(view, offset + 30, 0)     // extra len
    writeU16(view, offset + 32, 0)     // comment len
    writeU16(view, offset + 34, 0)     // disk start
    writeU16(view, offset + 36, 0)     // internal attrs
    writeU32(view, offset + 38, 0)     // external attrs
    writeU32(view, offset + 42, centralOffsets[i])
    buf.set(nameBytes, offset + 46)
    offset += 46 + nameBytes.length
  }

  // End of central directory
  writeU32(view, offset, 0x06054b50)
  writeU16(view, offset + 4, 0)
  writeU16(view, offset + 6, 0)
  writeU16(view, offset + 8, entries.length)
  writeU16(view, offset + 10, entries.length)
  writeU32(view, offset + 12, centralSize)
  writeU32(view, offset + 16, centralOffset)
  writeU16(view, offset + 20, 0)

  return buf
}

/**
 * Trigger a browser download of the given bytes as a ZIP file.
 */
export function downloadZip(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Convenience: build a ZIP from file docs (name + url) by fetching each URL.
 * Falls back to triggering individual downloads for any that fail.
 */
export async function downloadDocsAsZip(
  docs: { file_name: string; file_url: string }[],
  zipName: string,
  onStatus?: (msg: string) => void,
): Promise<{ ok: number; failed: number }> {
  const entries: ZipEntry[] = []
  let ok = 0
  let failed = 0

  for (const d of docs) {
    onStatus?.(`Fetching ${d.file_name}…`)
    try {
      const res = await fetch(d.file_url)
      if (!res.ok) throw new Error('bad status ' + res.status)
      const buf = await res.arrayBuffer()
      entries.push({ name: d.file_name, bytes: new Uint8Array(buf) })
      ok++
    } catch {
      failed++
    }
  }

  if (entries.length) {
    const zip = buildZip(entries)
    downloadZip(new Blob([zip], { type: 'application/zip' }), zipName)
  }
  return { ok, failed }
}
