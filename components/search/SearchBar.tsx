'use client'

// ---------------------------------------------------------------------------
// SearchBar — global search with debounce + live results dropdown.
// Searches across listings, deals, leads, and documents (lib/search.ts).
// Emits onBlur/Enter to navigate to the full /dashboard/search page.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchAll, logSearch, isEmptyQuery, type SearchResults } from '@/lib/search'

const KIND_ICON: Record<string, string> = {
  listing: '🏢', deal: '🤝', lead: '🎯', document: '📄',
}

const KIND_COLOR: Record<string, string> = {
  listing: '#0b1f3a', deal: '#0b1f3a', lead: '#8b5cf6', document: '#0b1f3a',
}

export default function SearchBar({ backdrop = false }: { backdrop?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResults>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [debounced, setDebounced] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounce the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 260)
    return () => clearTimeout(t)
  }, [q])

  // Run search.
  useEffect(() => {
    if (isEmptyQuery(debounced)) { setResults([]); setLoading(false); return }
    let active = true
    setLoading(true)
    searchAll(debounced).then((s) => {
      if (active) { setResults(s.results); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debounced])

  // Close when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const goFull = () => {
    if (debounced.trim()) logSearch(debounced, 'all')
    router.push(`/dashboard/search?q=${encodeURIComponent(debounced.trim())}`)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') goFull()
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.6, pointerEvents: 'none' }}>🔍</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search listings, deals, leads, documents…"
          style={{
            width: '100%', padding: '9px 38px 9px 36px', borderRadius: 20,
            border: '1px solid var(--line)', background: backdrop ? '#fff' : 'var(--paper)',
            fontSize: 13.5, color: 'var(--ink)', outline: 'none', fontFamily: 'inherit',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
          }}
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults([]); setOpen(false) }}
            aria-label="Clear"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, opacity: 0.5 }}
          >✕</button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
          background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
          boxShadow: '0 12px 34px rgba(0,0,0,0.14)', overflow: 'hidden',
        }}>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 26, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Searching…</div>
            ) : isEmptyQuery(debounced) ? (
              <div style={{ padding: 26, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: 26, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No matches for “{debounced}”
              </div>
            ) : (
              <>
                {results.slice(0, 8).map((r) => (
                  <a
                    key={`${r.type}:${r.id}`}
                    href={r.href}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(false)}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{KIND_ICON[r.type]}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                    </div>
                    {'price' in r && r.price != null && (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: KIND_COLOR[r.type], flexShrink: 0 }}>
                        {formatPrice(r.price)}
                      </span>
                    )}
                  </a>
                ))}
                <button
                  onClick={goFull}
                  style={{ width: '100%', padding: '11px 14px', background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
                >
                  View all results ({results.length}) →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}
