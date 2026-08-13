'use client'

// ---------------------------------------------------------------------------
// /dashboard/search — advanced search & filter page.
// Global search bar, filters (status/date/price/industry/scope), results,
// and saved searches. Uses Toasts for save/delete feedback.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  searchAll, fetchIndustries, fetchSavedSearches, saveSearch, deleteSavedSearch, logSearch,
  SCOPE_STATUSES,
  type SearchFilter, type SearchScope, type SearchResults, type SavedSearch,
} from '@/lib/search'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'

const KIND_ICON: Record<string, string> = { listing: '🏢', deal: '🤝', lead: '🎯', document: '📄' }
const SCOPE_LABEL: Record<string, string> = {
  all: 'All', listings: 'Listings', deals: 'Deals', leads: 'Leads', documents: 'Documents',
}

export default function SearchPage() {
  return (
    <AppShell active="Search">
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <ToastProvider>
          <Suspense fallback={<LoadingState label="Loading search…" />}>
            <SearchInner />
          </Suspense>
        </ToastProvider>
      </div>
    </AppShell>
  )
}

function SearchInner() {
  const toast = useToast()
  const params = useSearchParams()
  const initialQ = params.get('q') || ''

  const [q, setQ] = useState(initialQ)
  const [scope, setScope] = useState<SearchScope>('all')
  const [status, setStatus] = useState('')
  const [industry, setIndustry] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [industries, setIndustries] = useState<string[]>([])
  const [results, setResults] = useState<SearchResults>([])
  const [counts, setCounts] = useState({ listings: 0, deals: 0, leads: 0, documents: 0 })
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const [saveName, setSaveName] = useState('')

  const filter = useMemo<SearchFilter>(() => ({
    scope,
    status: status || undefined,
    industry: industry || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [scope, status, industry, minPrice, maxPrice, dateFrom, dateTo])

  const run = useCallback(async (query = q, flt = filter) => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]); setCounts({ listings: 0, deals: 0, leads: 0, documents: 0 }); setSearched(false); return
    }
    setLoading(true); setSearched(true)
    const s = await searchAll(query, flt)
    setResults(s.results); setCounts(s.counts); setLoading(false)
    logSearch(query, flt.scope || 'all')
  }, [q, filter])

  useEffect(() => { loadSaved() }, [])

  async function loadSaved() {
    const list = await fetchSavedSearches()
    setSaved(list)
  }

  async function handleSave() {
    if (!saveName.trim()) { toast('Enter a name for this search', 'info'); return }
    const created = await saveSearch({ name: saveName.trim(), scope, query: q, filters: filter })
    if (created) { toast('Search saved'); setSaveName(''); loadSaved() }
    else toast('Could not save search (run sql/search_schema.sql)', 'info')
  }

  async function handleDeleteSaved(id: string) {
    const ok = await deleteSavedSearch(id)
    if (ok) { toast('Saved search deleted'); loadSaved() } else toast('Delete failed', 'error')
  }

  function applySaved(s: SavedSearch) {
    setQ(s.query); setScope(s.scope)
    setStatus(s.filters.status || ''); setIndustry(s.filters.industry || '')
    setMinPrice(s.filters.minPrice != null ? String(s.filters.minPrice) : '')
    setMaxPrice(s.filters.maxPrice != null ? String(s.filters.maxPrice) : '')
    setDateFrom(s.filters.dateFrom || ''); setDateTo(s.filters.dateTo || '')
    // trigger search once states settle
    setTimeout(() => run(s.query, { ...s.filters, scope: s.scope }), 0)
    toast(`Loaded “${s.name}”`)
  }

  const statusOptions = scope === 'all' ? [] : SCOPE_STATUSES[scope] || []

  return (
    <div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--navy)', marginBottom: 4 }}>Search</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Search across listings, deals, leads, and documents. Refine with filters and save your favorites.</p>

      {/* Search input */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="Enter a keyword…"
              style={{ width: '100%', padding: '11px 14px 11px 36px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit' }}
            />
          </div>
          <button onClick={() => run()} style={{ padding: '11px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Search</button>
          <button onClick={handleSave} style={{ padding: '11px 18px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--gold)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>☆ Save</button>
        </div>
        {saveName && (
          <div style={{ padding: '0 18px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this saved search" style={{ flex: 1, maxWidth: 320, padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit' }} autoFocus />
            <button onClick={handleSave} style={{ padding: '9px 16px', background: 'var(--gold)', color: '#0b1f3a', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Save search</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <label style={labelStyle}>Scope
            <select value={scope} onChange={(e) => setScope(e.target.value as SearchScope)} style={selectStyle}>
              {Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Industry
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Min price
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="$0" style={selectStyle} />
          </label>
          <label style={labelStyle}>Max price
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="$—" style={selectStyle} />
          </label>
          <label style={labelStyle}>From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={selectStyle} />
          </label>
          <label style={labelStyle}>To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={selectStyle} />
          </label>
        </div>
      </Card>

      <div className="grid-responsive collapse-md" style={{ '--grid-cols': '1fr 280px', '--grid-gap': '20px', alignItems: 'start' } as React.CSSProperties}>
        {/* Results */}
        <Card>
          <CardHeader
            title={searched ? `Results ${loading ? '' : `(${counts.listings + counts.deals + counts.leads + counts.documents})`}` : 'Search'}
            subtitle={searched ? `${counts.listings} listings · ${counts.deals} deals · ${counts.leads} leads · ${counts.documents} documents` : 'Run a search to see results'}
          />
          <div style={{ padding: 12 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Searching…</div>
            ) : !searched ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Type a keyword and press Search, or pick a saved search.</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No results match your search + filters.</div>
            ) : (
              results.map((r) => (
                <a key={`${r.type}:${r.id}`} href={r.href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 8, textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 20 }}>{KIND_ICON[r.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.subtitle}</div>
                  </div>
                  {'status' in r && r.status && (
                    <span style={{ fontSize: 11.5, textTransform: 'capitalize', color: 'var(--muted)', background: 'var(--paper)', padding: '3px 8px', borderRadius: 12, border: '1px solid var(--line)' }}>{r.status}</span>
                  )}
                  {'price' in r && r.price != null && (
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--navy)', flexShrink: 0 }}>{formatPrice(r.price)}</span>
                  )}
                </a>
              ))
            )}
          </div>
        </Card>

        {/* Saved searches sidebar */}
        <Card>
          <CardHeader title="Saved searches" subtitle="Your favorites" />
          <div style={{ padding: 12 }}>
            {saved.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No saved searches yet. Run a search and click “☆ Save”.</div>
            ) : (
              saved.map((s) => (
                <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 4px', borderBottom: '1px solid var(--line)' }}>
                  <button onClick={() => applySaved(s)} style={{ flex: 1, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{SCOPE_LABEL[s.scope] || 'All'} · “{s.query || '—'}”</div>
                  </button>
                  <button onClick={() => handleDeleteSaved(s.id)} title="Delete" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, opacity: 0.5 }}>✕</button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 600,
}
const selectStyle: React.CSSProperties = {
  padding: '9px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)',
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}
