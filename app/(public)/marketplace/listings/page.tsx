'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchAllIndustries, fetchMarketplaceStats, searchPublicListings, MarketplaceStats, PublicListing } from '@/lib/marketplace'
import { fmt$ } from '@/lib/recast'
import PublicListingCard from '@/components/public/PublicListingCard'
import { LoadingState } from '@/components/ui'

export default function SearchListingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading listings..." />}>
      <SearchListingsInner />
    </Suspense>
  )
}

function SearchListingsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [results, setResults] = useState<PublicListing[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [stats, setStats] = useState<MarketplaceStats | null>(null)
  const [loading, setLoading] = useState(true)

  // filter state
  const q = searchParams.get('q') || ''
  const industry = searchParams.get('industry') || ''
  const location = searchParams.get('location') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const maxRevenue = searchParams.get('maxRevenue') || ''

  const [query, setQuery] = useState(q)
  const [selIndustry, setSelIndustry] = useState(industry)
  const [loc, setLoc] = useState(location)
  const [price, setPrice] = useState(maxPrice)
  const [rev, setRev] = useState(maxRevenue)

  useEffect(() => {
    (async () => {
      const [ind, st] = await Promise.all([fetchAllIndustries(), fetchMarketplaceStats()])
      setIndustries(ind); setStats(st)
    })()
  }, [])

  useEffect(() => {
    setLoading(true)
    searchPublicListings({
      query: q || undefined,
      industry: industry || undefined,
      location: location || undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      maxRevenue: maxRevenue ? Number(maxRevenue) : undefined,
    }).then(setResults).finally(() => setLoading(false))
  }, [q, industry, location, maxPrice, maxRevenue])

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (selIndustry) params.set('industry', selIndustry)
    if (loc) params.set('location', loc)
    if (price) params.set('maxPrice', price)
    if (rev) params.set('maxRevenue', rev)
    router.push(`/marketplace/listings?${params.toString()}`)
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Business Marketplace</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: '#1a1a2e', margin: '8px 0 0' }}>
            {stats ? `${stats.totalListings} Businesses for Sale` : 'Businesses for Sale'}
          </h1>
        </div>
        <LinkToList href="/marketplace/sell">→ Seller? List your business</LinkToList>
      </header>

      {/* FILTERS */}
      <form onSubmit={applyFilters} style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 18, marginBottom: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keyword" style={inputStyle} />
        <select value={selIndustry} onChange={(e) => setSelIndustry(e.target.value)} style={inputStyle}>
          <option value="">All Industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location" style={inputStyle} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Max Price ($)" type="number" style={inputStyle} />
        <input value={rev} onChange={(e) => setRev(e.target.value)} placeholder="Max Revenue ($)" type="number" style={inputStyle} />
        <button type="submit" style={{ background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 14 }}>Apply Filters</button>
      </form>

      {/* RESULTS */}
      {loading ? <LoadingState /> : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, color: '#888' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>No listings match your criteria</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Try broadening your filters or contact a broker for off-market opportunities.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>{results.length} result{results.length !== 1 ? 's' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {results.map((l) => <PublicListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { padding: '12px 14px', border: '1px solid #d8d2c2', borderRadius: 6, fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', background: '#fff' }

function LinkToList({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} style={{ color: '#c9a84c', textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'Georgia, serif' }}>{children}</Link>
}
