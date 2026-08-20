// =============================================================================
// lib/newspaperRender.ts — pure HTML rendering for the weekly newspaper email.
// Deliberately has NO 'use client' directive and no Supabase import, so it's
// safe to import from a server-only API route. It used to live inside
// lib/newspaper.ts, which IS 'use client' — Next.js silently drops plain
// function exports from a 'use client' module when it's imported into
// server code (only React component exports survive that boundary), so
// app/api/newspaper/publish/route.ts's `renderNewspaperHtml` import
// resolved to undefined and crashed every real "Email subscribers" click
// with a 500. lib/newspaper.ts re-exports from here so the dashboard's
// existing imports are unaffected.
// =============================================================================

// Type-only import — erased entirely at compile time, so it never triggers
// the 'use client' runtime-export problem described above.
import type { NewEdition, Article } from './newspaper'
export type { NewEdition, Article }

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
