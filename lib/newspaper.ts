'use client'

// =============================================================================
// Weekly Newspaper System — service
// -----------------------------------------------------------------------------
// Auto-generates a weekly edition from live platform activity (new listings,
// deals closed, new leads, social highlights), lets editors refine it, manages
// subscriptions, and renders the branded newspaper email (built on the shared
// email shell in lib/email.ts).
//
// All reads/writes go through the anon client under RLS (team only). Runs
// client-side for the dashboard; publishing/delivery also has a server route
// (app/api/newspaper/publish/route.ts) so the email queue is written with the
// service role.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// -- Types -------------------------------------------------------------------
export type NewEdition = {
  id: string
  title: string
  issue_label: string | null
  edition_date: string
  status: 'draft' | 'published'
  published_at?: string | null
  summary?: string | null
  created_at?: string
}

export type Article = {
  id: string
  edition_id: string
  section: string
  headline: string
  body: string | null
  image_url?: string | null
  sort_order?: number
}

export type Subscription = {
  id: string
  email: string
  name?: string | null
  status: 'active' | 'unsubscribed' | 'bounced'
  token?: string | null
  created_at?: string
}

export const SECTIONS = ['Market News', 'Featured Listings', 'Deals Closed', 'New Leads', 'Team Updates']

// -- Helpers ------------------------------------------------------------------
export function nowLabel(): string {
  return `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function makeUnsubToken(email: string): string {
  try {
    const raw = `${email}:${Date.now()}`
    return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(raw))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) : raw.slice(0, 24)
  } catch {
    return `${email}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  }
}

// -- Editions -----------------------------------------------------------------
export async function fetchEditions(): Promise<NewEdition[]> {
  try {
    const { data } = await supabase.from('newspaper_editions').select('*').order('edition_date', { ascending: false }).limit(30)
    return (data || []) as unknown as NewEdition[]
  } catch {
    return []
  }
}

/** Create a new draft edition, auto-generating articles from live data. */
export async function createEdition(): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('newspaper_editions').insert({
      title: 'Concord Weekly', issue_label: nowLabel(), status: 'draft',
    }).select().single()
    if (error || !data) return null
    await autoGenerateArticles(data.id)
    return data.id
  } catch {
    return null
  }
}

export async function updateEdition(id: string, patch: Partial<NewEdition>): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_editions').update(patch).eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function publishEdition(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_editions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function deleteEdition(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_editions').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

// -- Articles -----------------------------------------------------------------
export async function fetchArticles(editionId: string): Promise<Article[]> {
  try {
    const { data } = await supabase.from('newspaper_articles').select('*').eq('edition_id', editionId).order('sort_order', { ascending: true })
    return (data || []) as unknown as Article[]
  } catch {
    return []
  }
}

export async function upsertArticle(a: Partial<Article>): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_articles').upsert(a)
    return !error
  } catch {
    return false
  }
}

export async function deleteArticle(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_articles').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

/**
 * Auto-generate editorial content from real platform data:
 *   * Featured Listings — recent active listings (with price)
 *   * Deals Closed — recently closed deals + value
 *   * New Leads — recently created seller/buyer leads
 *   * Market News — a short weekly intro paragraph tying it together
 * Data volumes are pulled live; if tables are empty, generates a clean
 * "quiet week" note so the newspaper still looks intentional.
 */
export async function autoGenerateArticles(editionId: string): Promise<boolean> {
  try {
    const [listingsRes, dealsRes, sellerRes, buyerRes] = await Promise.all([
      supabase.from('listings').select('business_name, industry, asking_price, status, created_at').eq('status', 'active')?.order('created_at', { ascending: false }).limit(6),
      supabase.from('deals').select('title, status, purchase_price, created_at').or('status.eq.closed')?.order('updated_at', { ascending: false }).limit(6),
      supabase.from('seller_leads').select('business_name, industry, status, created_at')?.order('created_at', { ascending: false }).limit(6),
      supabase.from('buyer_leads').select('contact_name, industry_interest, status, created_at')?.order('created_at', { ascending: false }).limit(6),
    ])
    const listings = (listingsRes?.data || []) as any[]
    const deals = (dealsRes?.data || []) as any[]
    const sellers = (sellerRes?.data || []) as any[]
    const buyers = (buyerRes?.data || []) as any[]

    const articles: Array<Omit<Article, 'id' | 'edition_id'>> = []
    let order = 10

    // Intro / market news
    articles.push({
      section: 'Market News',
      headline: nowLabel(),
      body:
        `This week we welcomed ${listings.length} featured listing${listings.length === 1 ? '' : 's'}, ` +
        `closed ${deals.length} deal${deals.length === 1 ? '' : 's'}, and added ${sellers.length + buyers.length} new ` +
        `lead${sellers.length + buyers.length === 1 ? '' : 's'} to our pipeline. The business sale market remains active ` +
        `across our coverage area — reach out to discuss your exit or acquisition goals.`,
      sort_order: order,
    })
    order += 10

    // Featured listings
    if (listings.length) {
      articles.push({
        section: 'Featured Listings',
        headline: 'New businesses for sale this week',
        body: listings.map((l, i) => `${i + 1}. ${l.business_name || 'Business'}${l.industry ? ' — ' + l.industry : ''}${l.asking_price ? ' · $' + Math.round(l.asking_price).toLocaleString() : ''}`).join('\n'),
        sort_order: order,
      })
      order += 10
    }

    // Deals closed
    if (deals.length) {
      articles.push({
        section: 'Deals Closed',
        headline: 'Recent closings',
        body: deals.map((d, i) => `${i + 1}. ${d.title || 'Deal'}${d.purchase_price ? ' · $' + Math.round(d.purchase_price).toLocaleString() : ''} (${d.status})`).join('\n'),
        sort_order: order,
      })
      order += 10
    }

    // New leads
    if (sellers.length + buyers.length) {
      const leadLines = [
        ...sellers.map((l, i) => `Seller: ${l.business_name || 'Unnamed'}${l.industry ? ' (' + l.industry + ')' : ''}${l.status ? ' — ' + l.status : ''}`),
        ...buyers.map((l, i) => `Buyer: ${l.contact_name || 'Unnamed'}${l.industry_interest ? ' looking for ' + l.industry_interest : ''}`),
      ]
      articles.push({
        section: 'New Leads',
        headline: 'New leads this week',
        body: leadLines.join('\n'),
        sort_order: order,
      })
      order += 10
    }

    // Team updates placeholder
    articles.push({
      section: 'Team Updates',
      headline: 'From the team',
      body: 'Our advisors continue to guide clients through confidential listings, valuations, and due diligence. Contact your advisor to schedule a free consult.',
      sort_order: order,
    })

    for (const a of articles) {
      await supabase.from('newspaper_articles').insert({ ...a, edition_id: editionId })
    }
    return true
  } catch {
    return false
  }
}

// -- Subscriptions -------------------------------------------------------------
export async function fetchSubscriptions(): Promise<Subscription[]> {
  try {
    const { data } = await supabase.from('newspaper_subscriptions').select('*').order('created_at', { ascending: false }).limit(200)
    return (data || []) as unknown as Subscription[]
  } catch {
    return []
  }
}

export async function addSubscription(email: string, name?: string): Promise<boolean> {
  try {
    const token = makeUnsubToken(email)
    const { error } = await supabase.from('newspaper_subscriptions').upsert(
      { email: email.toLowerCase().trim(), name: name || null, token },
      { onConflict: 'email' },
    )
    return !error
  } catch {
    return false
  }
}

export async function removeSubscription(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('newspaper_subscriptions').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

// -- Delivery log --------------------------------------------------------------
export async function fetchDeliveryLog(editionId: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('newspaper_delivery_log').select('*').eq('edition_id', editionId).order('created_at', { ascending: false }).limit(100)
    return (data || []) as any[]
  } catch {
    return []
  }
}

// -- Email rendering ------------------------------------------------------------
/** Build the HTML newspaper body from the edition + articles (branded). */
export function renderNewspaperHtml(edition: NewEdition, articles: Article[]): string {
  const rows = articles
    .map((a) => {
      const paras = (a.body || '')
        .split('\n')
        .filter(Boolean)
        .map((line) => `<p style="margin:4px 0;font-size:14px;line-height:1.55;color:#2a2a2a">${esc(line)}</p>`)
        .join('')
      const badge = sectionColor(a.section)
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0"><tr><td style="background:#fbfaf7;border:1px solid #e5e0d3;border-left:4px solid ${badge};border-radius:8px;padding:16px 18px">` +
        `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:${badge};font-weight:700;margin-bottom:6px">${esc(a.section || 'News')}</div>` +
        `<div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:8px">${esc(a.headline || '')}</div>` +
        paras +
        `</td></tr></table>`
      )
    })
    .join('\n')

  return (
    `<div style="max-width:620px;margin:0 auto;padding:24px 16px">` +
    `<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#1a1a2e;text-align:center;letter-spacing:0.02em">Concord Weekly</div>` +
    `<div style="text-align:center;font-size:12px;color:#8a8a9a;letter-spacing:0.14em;text-transform:uppercase;margin:6px 0 2px">${esc(edition.issue_label || '')}</div>` +
    `<div style="width:56px;height:2px;background:#c9a84c;margin:12px auto"></div>` +
    (edition.summary ? `<p style="font-size:13px;color:#6a6a7a;text-align:center;font-style:italic;margin:8px 0 0">${esc(edition.summary)}</p>` : '') +
    rows +
    `<p style="font-size:11px;color:#b0b0bd;text-align:center;margin-top:22px">CONCORD Deal Platform · Confidential weekly briefing</p>` +
    `</div>`
  )
}

function sectionColor(section: string): string {
  switch (section) {
    case 'Featured Listings': return '#0b1f3a'
    case 'Deals Closed': return '#16a34a'
    case 'New Leads': return '#8b5cf6'
    case 'Team Updates': return '#c9a84c'
    default: return '#3b82f6'
  }
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
