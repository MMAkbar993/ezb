// =============================================================================
// Context loader — pulls real deal / training / document / recast records from
// Supabase and compiles them into a compact factual text bundle that is handed
// to Claude as a context block (via lib/claude/client.ts).
//
// The aim: give the model the facts it needs WITHOUT dumping raw rows. Each
// loader returns a condensed, human-readable summary so prompts stay efficient
// and confidential data is deliberately shaped before it ever leaves the server.
// =============================================================================

import { createServerClient } from '@/lib/supabase/server'
import type { AgentContextPayload, AgentKind } from '@/types/ai'

// Imported lazily (not at module top-level) so this module — reachable from
// the /api/ai/chat route handler — can be safely collected/prerendered by
// `next build` even when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY aren't set at
// build time (a top-level import would throw immediately in that case).
async function getClient() {
  return (await import('@/lib/supabase/client')).supabase
}

// Reused type shapes (kept local to avoid pulling UI-heavy libs into this module).
interface ListingRow {
  id: string
  business_name?: string | null
  headline?: string | null
  industry?: string | null
  location_general?: string | null
  asking_price?: number | null
  annual_revenue?: number | null
  sde?: number | null
  ebitda?: number | null
  status?: string | null
  real_estate_included?: boolean | null
  reason_for_sale?: string | null
  description?: string | null
}

interface TrainingModuleRow {
  id: string
  title: string
  description?: string | null
  icon?: string | null
  order?: number | null
}

interface TrainingLessonRow {
  id: string
  module_id: string
  title: string
  content?: string | null
  duration_minutes?: number | null
  order?: number | null
}

const money = (n: number | null | undefined): string =>
  n === null || n === undefined || isNaN(n) ? 'n/a' : `$${n.toLocaleString()}`

const trunc = (s: string | null | undefined, max = 600): string => {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

/** Fetch a listing by id. */
async function getListing(id: string): Promise<ListingRow | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('context: listing fetch failed', error.message)
  return (data as ListingRow | null) ?? null
}

/** Fetch a listing's related documents (names + URLs, no raw file content).
 * NOTE: `listing_documents` has no `file_name` column in the live schema, so we
 * select the columns that exist and derive a name from the URL/category. */
async function getListingDocs(listingId: string): Promise<string[]> {
  const supabase = await getClient()
  const { data } = await supabase
    .from('listing_documents')
    .select('file_url, category, status')
    .eq('listing_id', listingId)
  if (!data) return []
  return (data as { file_url?: string | null; category?: string | null; status?: string | null }[])
    .map((d) => {
      const name = (d.file_url || '').split('/').pop() || d.category || 'document'
      return [name, d.category, d.status].filter(Boolean).join(' · ')
    })
    .filter(Boolean)
}

/** Fetch all published training modules + their lessons (non-published filtered).
 * Uses the server (service-role) client so curriculum stays readable even
 * though the tables only grant `for select to authenticated` (RLS). The agent
 * route runs server-side, so the service key never reaches the browser. */
async function getTrainingLibrary(): Promise<{ modules: TrainingModuleRow[]; lessons: TrainingLessonRow[] }> {
  const db = createServerClient() ?? (await getClient())
  const [mRes, lRes] = await Promise.all([
    db.from('training_modules').select('*').order('order', { ascending: true }),
    db.from('training_lessons').select('*'),
  ])
  const modules = ((mRes.data as TrainingModuleRow[]) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const lessons = ((lRes.data as TrainingLessonRow[]) || [])
    .filter((l) => l.module_id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return { modules, lessons }
}

/**
 * Compiles a context payload for a given agent. `entityId` scopes deal/document
 * agents to a listing; the training agent loads the whole curriculum (bounded).
 */
export async function buildAgentContext({
  kind,
  entityId,
}: {
  kind: AgentKind
  entityId?: string
}): Promise<AgentContextPayload> {
  switch (kind) {
    case 'lead':
      return buildLeadContext(entityId)
    case 'training':
      return buildTrainingContext(entityId)
    case 'document':
      return buildDocumentContext(entityId)
    case 'support':
      return { kind, entityId, text: '' }
  }
}

/** Lead agent: surface recent seller/buyer leads for prioritization. */
async function buildLeadContext(entityId?: string): Promise<AgentContextPayload> {
  const parts: string[] = []

  const supabase = await getClient()
  const [sellerRes, buyerRes] = await Promise.all([
    supabase.from('seller_leads').select('*').order('created_at', { ascending: false }).limit(15),
    supabase.from('buyer_leads').select('*').order('created_at', { ascending: false }).limit(15),
  ])

  const sellers = sellerRes.data as Record<string, unknown>[] | null
  if (sellers?.length) {
    parts.push('SELLER LEADS (most recent first):')
    sellers.forEach((s, i) => {
      parts.push(
        `${i + 1}. name=${s.full_name || s.name || s.business_name || '?'} · ` +
          `business=${s.business_name || '?'} · status=${s.status || 'new'} · ` +
          `price=${s.asking_price ?? typeof s.asking_price === 'number' ? s.asking_price : 'n/a'} · ` +
          `note=${trunc((s.notes as string) || (s.description as string) || '', 180)}`,
      )
    })
  }

  const buyers = buyerRes.data as Record<string, unknown>[] | null
  if (buyers?.length) {
    parts.push('\nBUYER LEADS:')
    buyers.forEach((b, i) => {
      parts.push(
        `${i + 1}. name=${b.full_name || b.name || '?'} · status=${b.status || 'new'} · ` +
          `budget=${b.budget ?? 'n/a'} · note=${trunc((b.notes as string) || (b.description as string) || '', 180)}`,
      )
    })
  }

  return {
    kind: 'lead',
    entityId,
    text: parts.length ? parts.join('\n') : 'No leads found in the database yet.',
  }
}

/** Training agent: compact curriculum map with lesson content (bounded). */
async function buildTrainingContext(lessonId?: string): Promise<AgentContextPayload> {
  const { modules, lessons } = await getTrainingLibrary()

  if (lessonId) {
    const lesson = lessons.find((l) => l.id === lessonId)
    if (lesson) {
      return {
        kind: 'training',
        entityId: lessonId,
        text:
          `LESSON: ${lesson.title}\n` +
          `Duration: ${lesson.duration_minutes ?? 0} min\n\n` +
          trunc(lesson.content, 4000),
      }
    }
  }

  const parts = modules.map((m) => {
    const ls = lessons.filter((l) => l.module_id === m.id)
    const lessonLines = ls
      .map((l) => `  - ${l.title} (${l.duration_minutes ?? 0} min)${l.content ? `: ${trunc(l.content, 200)}` : ''}`)
      .join('\n')
    return `MODULE ${m.order ?? '?'}: ${m.title}${m.description ? ` — ${trunc(m.description, 200)}` : ''}\n${lessonLines}`
  })

  return {
    kind: 'training',
    entityId: lessonId,
    text: parts.length
      ? parts.join('\n\n')
      : 'No training content loaded. Run training_schema.sql and seed training modules.',
  }
}

/** Document agent: listing profile + its document inventory + recast summary. */
async function buildDocumentContext(listingId?: string): Promise<AgentContextPayload> {
  const parts: string[] = []

  if (listingId) {
    const listing = await getListing(listingId)
    if (listing) {
      parts.push(
        `LISTING: ${listing.business_name || 'Unnamed'}\n` +
          (listing.headline ? `Headline: ${listing.headline}\n` : '') +
          (listing.industry ? `Industry: ${listing.industry}\n` : '') +
          (listing.location_general ? `Location: ${listing.location_general}\n` : '') +
          `Status: ${listing.status || 'unknown'}\n` +
          `Asking price: ${money(listing.asking_price)}\n` +
          `Revenue: ${money(listing.annual_revenue)}\n` +
          `SDE: ${money(listing.sde)} · EBITDA: ${money(listing.ebitda)}\n` +
          `Real estate included: ${listing.real_estate_included ? 'yes' : 'no/unknown'}\n` +
          (listing.reason_for_sale ? `Reason for sale: ${listing.reason_for_sale}\n` : '') +
          (listing.description ? `Description: ${trunc(listing.description, 600)}\n` : ''),
      )
    }

    const docs = await getListingDocs(listingId)
    if (docs.length) {
      parts.push(`\nLISTING DOCUMENTS: ${docs.length}\n` + docs.map((d) => `- ${d}`).join('\n'))
    } else {
      parts.push('\nNo documents on file for this listing.')
    }
  } else {
    const supabase = await getClient()
    const { data } = await supabase
      .from('listing_documents')
      .select('listing_id, file_url, category')
      .limit(30)
    if (data?.length) {
      parts.push('RECENT DOCUMENTS INVENTORY:')
      ;(data as { listing_id?: string | null; file_url?: string | null; category?: string | null }[])
        .forEach((d, i) => {
          const name = (d.file_url || '').split('/').pop() || 'unnamed'
          parts.push(`${i + 1}. ${name} (listing ${d.listing_id || '?'}) · ${d.category || 'uncategorized'}`)
        })
    }
  }

  return {
    kind: 'document',
    entityId: listingId,
    text: parts.length ? parts.join('\n') : 'No document or listing context found.',
  }
}
