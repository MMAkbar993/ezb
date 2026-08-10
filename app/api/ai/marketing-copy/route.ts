import { NextResponse } from 'next/server'
import { getClaudeClient, isClaudeConfigured } from '@/lib/claude/client'
import type { StudioDesignData, MarketingCategory } from '@/lib/marketing'

// =============================================================================
// POST /api/ai/marketing-copy
// AI marketing-content generator. Given a business (name, summary, industry,
// contact / brand) — or an optional listing id — plus a target product
// category, it drafts a COMPLETE finished piece: headline, tagline, body copy,
// call-to-action, and a recommended layout. Lets ANY agent generate on-brand
// marketing materials from a blank start.
//
// Returns a StudioDesignData-shaped payload the DesignStudio / agents can
// apply or save via lib/marketing.saveDesign.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 40

interface Body {
  productCategory?: MarketingCategory
  businessName?: string
  summary?: string
  industry?: string
  city?: string
  financeNote?: string
  contact?: { phone?: string; email?: string; website?: string; address?: string }
  brand?: StudioDesignData['brand']
  brokerName?: string
  company?: string
  listingId?: string
}

const LAYOUTS = ['classic', 'minimal', 'modern', 'split'] as const

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const category: MarketingCategory = body.productCategory || 'flyers'
  const businessName = body.businessName?.trim() || 'this business'
  const summary = body.summary?.trim() || ''
  const industry = body.industry?.trim() || ''
  const city = body.city?.trim() || ''
  const financeNote = body.financeNote?.trim() || ''
  const contact = body.contact || {}
  const brokerName = body.brokerName?.trim() || ''
  const company = body.company?.trim() || ''
  const brand = body.brand

  const brandBlurb = brand
    ? `Primary ${brand.primaryColor} · Secondary ${brand.secondaryColor} · Accent ${brand.accentColor} · Font ${brand.font}`
    : 'No brand supplied — use a professional navy + gold palette'

  const ctaHint =
    category === 'business_cards'
      ? 'CTA = contact (phone/email/website)'
      : category === 'banners'
      ? 'bigger, skimmable, one strong CTA'
      : 'clear call-to-action inviting outreach to the broker'

  const defaultBrand = brand || { primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c', font: 'georgia', logoUrl: null }

  // --- Prefer a real Claude generation when configured -----------------------
  if (isClaudeConfigured()) {
    try {
      const client = getClaudeClient()
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        system:
          'You are an expert business-brokerage marketing copywriter. Make every piece sound credible, premium, and on-brand. ' +
          'Return ONLY a valid JSON object with no markdown fences or surrounding prose. The JSON shape must be exactly: ' +
          '{"headline":string,"tagline":string,"body":string,"cta":string,"layout":"classic"|"minimal"|"modern"|"split"}. ' +
          'Keep the headline under 70 chars and the body under 220 chars.',
        messages: [
          {
            role: 'user',
            content: [
              `Write a ${category.replace(/_/g, ' ')} for "${businessName}".`,
              industry ? `Industry: ${industry}.` : '',
              city ? `Location: ${city}.` : '',
              summary ? `About: ${summary}.` : '',
              financeNote ? `Offering/headline point: ${financeNote}.` : '',
              `The piece is by ${brokerName || 'our broker'}${company ? ` at ${company}` : ''}.`,
              `Style direction: ${ctaHint}.`,
              `Brand: ${brandBlurb}.`,
            ].filter(Boolean).join(' '),
          },
        ],
      })

      const text = resp.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const parsed = JSON.parse(cleaned)
      const layout = (LAYOUTS as readonly string[]).includes(parsed.layout) ? parsed.layout : 'classic'

      return NextResponse.json({
        ok: true,
        source: 'claude',
        design: {
          productId: category,
          designName: `${businessName} — ${category.replace(/_/g, ' ')}`,
          brand: defaultBrand,
          text: {
            headline: String(parsed.headline || ''),
            tagline: String(parsed.tagline || ''),
            name: businessName,
            title: industry || 'Business for Sale',
            company: company || '',
            phone: contact.phone || '',
            email: contact.email || '',
            website: contact.website || '',
            address: contact.address || '',
            body: String(parsed.body || ''),
            cta: String(parsed.cta || ''),
          },
          sides: 'front',
          qr: { enabled: false, url: '' },
          variantSelections: {},
          layout,
          aiGenerated: true,
        } as StudioDesignData,
      })
    } catch {
      // Fall through to deterministic generator.
    }
  }

  // --- Deterministic fallback (never hard-fails) -----------------------------
  return NextResponse.json({
    ok: true,
    source: 'fallback',
    design: {
      productId: category,
      designName: `${businessName} — ${category.replace(/_/g, ' ')}`,
      brand: defaultBrand,
      text: {
        headline: city ? `${businessName} — ${city}` : businessName,
        tagline: industry ? `A Premier ${industry} Opportunity` : 'Business Opportunity',
        name: businessName,
        title: 'Confidentially For Sale',
        company: company || 'EZ Business Advisors',
        phone: contact.phone || '',
        email: contact.email || 'rtimsina@ezbusinessadvisors.com',
        website: contact.website || '',
        address: contact.address || '',
        body: summary || 'A turnkey, owner-operated business with strong, established revenue and clear growth potential.',
        cta: 'Request a confidential overview from our advisors today.',
      },
      sides: 'front',
      qr: { enabled: false, url: '' },
      variantSelections: {},
      layout: 'classic',
      aiGenerated: true,
    } as StudioDesignData,
  })
}
