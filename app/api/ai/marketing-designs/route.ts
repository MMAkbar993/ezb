import { NextResponse } from 'next/server'
import type { StudioDesignData } from '@/lib/marketing'
import { getClaudeClient, isClaudeConfigured } from '@/lib/claude/client'

// ---------------------------------------------------------------------------
// POST /api/ai/marketing-designs
// AI design generator. Seeds a Claude prompt with the broker's saved brand
// (colors, font, logo, broker name, product category) and style presets to
// produce multiple distinct design variants that match the brand. Falls back
// to a deterministic local generator when ANTHROPIC_API_KEY is absent so the
// storefront never hard-fails.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'
export const maxDuration = 40

interface Body {
  productId?: string
  productName?: string
  category?: string
  brand?: StudioDesignData['brand']
  brokerName?: string
  company?: string
  prompt?: string
  variantCount?: number
}

const PRESETS: { name: string; instruction: string }[] = [
  { name: 'Classic Heritage', instruction: 'traditional, centered, serif-driven, elegant gold accents, timeless and trustworthy' },
  { name: 'Modern Minimal', instruction: 'clean, lots of whitespace, single bold accent, contemporary sans-serif, high-end and airy' },
  { name: 'Bold Diagonal', instruction: 'dynamic diagonal accent band, strong color contrast, energetic but professional' },
  { name: 'Split Front/Back', instruction: 'distinct front and back panels, monogram on back, structured and cohesive' },
]

const LAYOUTS = ['classic', 'minimal', 'modern', 'split'] as const

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}
function shiftHex(hex: string, amt: number): string {
  const h = (hex || '#1a1a2e').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const n = parseInt(h, 16)
  const r = clamp(((n >> 16) & 255) + amt)
  const g = clamp(((n >> 8) & 255) + amt)
  const b = clamp((n & 255) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export async function POST(req: Request) {
  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const brand = body.brand
  const count = Math.min(Math.max(body.variantCount || 4, 1), 6)
  const productName = body.productName || 'marketing material'
  const category = body.category || 'business_cards'
  const brokerName = body.brokerName || ''
  const company = body.company || ''
  const userPrompt = body.prompt || ''

  const brandBlurb = brand
    ? `Primary ${brand.primaryColor} · Secondary ${brand.secondaryColor} · Accent ${brand.accentColor} · Font ${brand.font}${brand.logoUrl ? ' · has a logo' : ''}`
    : 'No brand supplied — use a professional navy + gold palette'

  // --- Prefer a real Claude generation when configured -----------------------
  if (isClaudeConfigured()) {
    try {
      const client = getClaudeClient()
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1600,
        system:
          'You are an expert print-marketing art director. Produce design briefs in STRICT JSON. ' +
          'Each brief must stay on the given brand palette and font. Return ONLY a JSON object with a "variants" array of { "name", "layout", "primaryColor", "secondaryColor", "accentColor", "blurb" }. No markdown fences.',
        messages: [
          {
            role: 'user',
            content: [
              `Design ${count} variants for a "${productName}" (category: ${category}).`,
              `Brand: ${brandBlurb}.`,
              brokerName ? `Broker: ${brokerName}.` : '',
              company ? `Company: ${company}.` : '',
              userPrompt ? `Additional direction: ${userPrompt}` : '',
              `Style presets to consider: ${PRESETS.map((p) => `${p.name} (${p.instruction})`).join('; ')}.`,
              `Layouts must be one of: ${LAYOUTS.join(', ')}.`,
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
      const variants = Array.isArray(parsed?.variants) ? parsed.variants.slice(0, count) : null

      if (variants && variants.length) {
        return NextResponse.json({
          ok: true,
          source: 'claude',
          designs: variants.map((v: any, i: number) => ({
            id: `ai-${i + 1}-${Date.now()}`,
            name: v.name || PRESETS[i % PRESETS.length].name,
            layout: (LAYOUTS as readonly string[]).includes(v.layout) ? v.layout : 'classic',
            brand: {
              primaryColor: /^#[0-9a-fA-F]{6}$/.test(v.primaryColor || '') ? v.primaryColor : brand?.primaryColor || '#1a1a2e',
              secondaryColor: /^#[0-9a-fA-F]{6}$/.test(v.secondaryColor || '') ? v.secondaryColor : brand?.secondaryColor || '#16213e',
              accentColor: /^#[0-9a-fA-F]{6}$/.test(v.accentColor || '') ? v.accentColor : brand?.accentColor || '#c9a84c',
              font: brand?.font || 'georgia',
              logoUrl: brand?.logoUrl || null,
            },
            blurb: v.blurb || '',
          })),
        })
      }
    } catch {
      // Fall through to deterministic generator on any Claude failure.
    }
  }

  // --- Deterministic fallback --------------------------------------------------
  const base = brand || { primaryColor: '#1a1a2e', secondaryColor: '#16213e', accentColor: '#c9a84c', font: 'georgia', logoUrl: null }
  const deltas = [0, -8, -14, 12, 6, -5]
  const accentDeltas = [0, 6, -5, -9, 14, 3]

  return NextResponse.json({
    ok: true,
    source: 'fallback',
    designs: PRESETS.slice(0, count).map((p, i) => ({
      id: `fb-${i + 1}`,
      name: p.name,
      layout: LAYOUTS[i % LAYOUTS.length],
      brand: {
        primaryColor: shiftHex(base.primaryColor, deltas[i] ?? 0),
        secondaryColor: shiftHex(base.secondaryColor, (deltas[i] ?? 0) * 0.7),
        accentColor: shiftHex(base.accentColor, accentDeltas[i] ?? 0),
        font: base.font,
        logoUrl: base.logoUrl,
      },
      blurb: p.instruction,
    })),
  })
}
