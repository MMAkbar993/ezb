import type { MetadataRoute } from 'next'

// ---------------------------------------------------------------------------
// sitemap.xml — public listings + static marketing routes.
// Listings are read from public_listing_feed (sql/public_website_schema.sql)
// via the anon client — the view itself is the safe, published-only
// projection, so no service-role client is needed here. Best-effort: if the
// DB or Supabase env is unavailable we still emit the static routes rather
// than failing the whole sitemap (the client is imported dynamically inside
// the try block below so a missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY can't
// crash this route at module-load time).
// ---------------------------------------------------------------------------

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'

const STATIC: MetadataRoute.Sitemap = [
  { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1.0 },
  { url: `${BASE}/marketplace/listings`, changeFrequency: 'weekly', priority: 0.9 },
  { url: `${BASE}/marketplace/buy`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE}/marketplace/sell`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/marketplace/brokers`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/legal/terms`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${BASE}/legal/privacy`, changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [...STATIC]

  try {
    const { supabase } = await import('@/lib/supabase/client')
    const { data } = await supabase.from('public_listing_feed').select('id, updated_at')
    const rows = (data || []) as { id: string; updated_at?: string | null }[]
    for (const r of rows) {
      entries.push({
        url: `${BASE}/marketplace/listings/${r.id}`,
        lastModified: r.updated_at || new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  } catch {
    // Non-fatal — static routes above remain.
  }

  return entries
}
