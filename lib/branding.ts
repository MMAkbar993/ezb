'use client'

// =============================================================================
// Business Card Branding service
// -----------------------------------------------------------------------------
// Per-broker business card theming. Resolution model:
//   * The AGENCY defines a default brand (primary/secondary/accent color, font,
//     logo).
//   * Each BROKER may override any of those on their broker_profiles row
//     (card_* fields). NULL on a broker field means "inherit the agency default".
//   * The effective/canonical card brand is the merged result — what gets
//     previewed, used by the AI generator, and rendered.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// --- Types -------------------------------------------------------------------
export interface CardBrand {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  font: string
  logoUrl: string | null
  layout: CardLayout
}

export type CardLayout = 'classic' | 'minimal' | 'modern' | 'split'

export interface AgencyBrand {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  font: string
  logoUrl: string | null
}

export interface BrokerCardOverrides {
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  font: string | null
  logoUrl: string | null
  layout: CardLayout | null
}

/** A broker's identity: their broker_profiles row + their agency (if any). */
export interface BrokerBrandContext {
  brokerProfileId: string | null
  agency: AgencyBrand | null
  agencyName: string | null
  overrides: BrokerCardOverrides
  /** True if the current broker is an agency admin/owner. */
  isAgencyAdmin: boolean
}

// --- Constants ----------------------------------------------------------------
export const CARD_LAYOUTS: { id: CardLayout; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'modern', label: 'Modern' },
  { id: 'split', label: 'Split Front/Back' },
]

export const FONTS: { id: string; label: string; css: string }[] = [
  { id: 'georgia', label: 'Georgia (Serif)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'helvetica', label: 'Helvetica (Sans)', css: "Helvetica, Arial, sans-serif" },
  { id: 'futura', label: 'Futura (Geometric)', css: "Futura, 'Century Gothic', sans-serif" },
  { id: 'garamond', label: 'Garamond (Elegant)', css: "'EB Garamond', Garamond, serif" },
  { id: 'montserrat', label: 'Montserrat (Modern)', css: "Montserrat, 'Segoe UI', sans-serif" },
]

export function fontCss(id: string): string {
  const f = FONTS.find((x) => x.id === id)
  return f ? f.css : "Georgia, 'Times New Roman', serif"
}

export const DEFAULT_BRAND: CardBrand = {
  primaryColor: '#1a1a2e',
  secondaryColor: '#16213e',
  accentColor: '#c9a84c',
  font: 'georgia',
  logoUrl: null,
  layout: 'classic',
}

// --- Normalization ------------------------------------------------------------
function isHex(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function pick(
  broker: string | null | undefined,
  agency: string | null | undefined,
  fallback: string,
): string {
  if (isHex(broker)) return broker
  if (isHex(agency)) return agency
  return fallback
}

function pickFont(broker: string | null | undefined, agency: string | null | undefined): string {
  const b = broker && FONTS.some((f) => f.id === broker) ? broker : null
  const a = agency && FONTS.some((f) => f.id === agency) ? agency : null
  return b || a || DEFAULT_BRAND.font
}

// --- Fetch current user's brand context ---------------------------------------
export async function fetchBrokerBrandContext(): Promise<BrokerBrandContext> {
  const { data: { user } } = await supabase.auth.getUser()
  const empty: BrokerBrandContext = {
    brokerProfileId: null,
    agency: null,
    agencyName: null,
    overrides: {
      primaryColor: null, secondaryColor: null, accentColor: null,
      font: null, logoUrl: null, layout: null,
    },
    isAgencyAdmin: false,
  }
  if (!user) return empty

  // Broker profile (+ nested agency via agency_members).
  const { data: profile } = await supabase
    .from('broker_profiles')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!profile) return empty

  let agency: AgencyBrand | null = null
  let agencyName: string | null = null
  let isAgencyAdmin = false

  // Memberships for role + agency brand.
  const { data: mem } = await supabase
    .from('agency_members')
    .select('role, is_owner, agency:agencies(*)')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (mem) {
    const a = (mem as any).agency
    if (a) {
      agency = {
        primaryColor: a.brand_primary_color ?? a.brand_color ?? DEFAULT_BRAND.primaryColor,
        secondaryColor: a.brand_secondary_color ?? DEFAULT_BRAND.secondaryColor,
        accentColor: a.brand_accent_color ?? a.accent_color ?? DEFAULT_BRAND.accentColor,
        font: a.brand_font ?? DEFAULT_BRAND.font,
        logoUrl: a.brand_logo_url ?? a.logo_url ?? null,
      }
      agencyName = a.name ?? null
    }
    const role = (mem as any).role
    isAgencyAdmin = (mem as any).is_owner === true || role === 'admin'
  }

  return {
    brokerProfileId: profile.id,
    agency,
    agencyName,
    overrides: {
      primaryColor: profile.card_primary_color ?? null,
      secondaryColor: profile.card_secondary_color ?? null,
      accentColor: profile.card_accent_color ?? null,
      font: profile.card_font ?? null,
      logoUrl: profile.card_logo_url ?? null,
      layout: profile.card_layout ?? null,
    },
    isAgencyAdmin,
  }
}

// --- Resolve the effective brand (broker override → agency default → fallback) -
export function resolveBrand(ctx: BrokerBrandContext): CardBrand {
  const a = ctx.agency
  return {
    primaryColor: pick(ctx.overrides.primaryColor, a?.primaryColor, DEFAULT_BRAND.primaryColor),
    secondaryColor: pick(ctx.overrides.secondaryColor, a?.secondaryColor, DEFAULT_BRAND.secondaryColor),
    accentColor: pick(ctx.overrides.accentColor, a?.accentColor, DEFAULT_BRAND.accentColor),
    font: pickFont(ctx.overrides.font, a?.font),
    logoUrl: ctx.overrides.logoUrl || a?.logoUrl || null,
    layout: ctx.overrides.layout ?? 'classic',
  }
}

// --- Persistence --------------------------------------------------------------
export async function saveBrokerCardOverrides(
  profileId: string,
  patch: Partial<BrokerCardOverrides>,
): Promise<boolean> {
  const row: Record<string, string | null> = {}
  if ('primaryColor' in patch) row.card_primary_color = patch.primaryColor
  if ('secondaryColor' in patch) row.card_secondary_color = patch.secondaryColor
  if ('accentColor' in patch) row.card_accent_color = patch.accentColor
  if ('font' in patch) row.card_font = patch.font
  if ('logoUrl' in patch) row.card_logo_url = patch.logoUrl
  if ('layout' in patch) row.card_layout = patch.layout
  if (Object.keys(row).length === 0) return true
  const { error } = await supabase
    .from('broker_profiles')
    .update(row)
    .eq('id', profileId)
  return !error
}

/** Clear a single override back to "inherit agency default" (set NULL). */
export async function clearBrokerCardOverride(
  profileId: string,
  key: keyof BrokerCardOverrides,
): Promise<boolean> {
  const colMap: Record<keyof BrokerCardOverrides, string> = {
    primaryColor: 'card_primary_color',
    secondaryColor: 'card_secondary_color',
    accentColor: 'card_accent_color',
    font: 'card_font',
    logoUrl: 'card_logo_url',
    layout: 'card_layout',
  }
  const col: string | null = colMap[key]
  if (!col) return false
  const { error } = await supabase.from('broker_profiles').update({ [col]: null }).eq('id', profileId)
  return !error
}

// --- Agency brand (admin only) ------------------------------------------------
export async function fetchAgencyBrand(agencyId: string): Promise<AgencyBrand | null> {
  const { data } = await supabase.from('agencies').select('*').eq('id', agencyId).maybeSingle()
  if (!data) return null
  return {
    primaryColor: data.brand_primary_color ?? data.brand_color ?? DEFAULT_BRAND.primaryColor,
    secondaryColor: data.brand_secondary_color ?? DEFAULT_BRAND.secondaryColor,
    accentColor: data.brand_accent_color ?? data.accent_color ?? DEFAULT_BRAND.accentColor,
    font: data.brand_font ?? DEFAULT_BRAND.font,
    logoUrl: data.brand_logo_url ?? data.logo_url ?? null,
  }
}

export async function saveAgencyBrand(
  agencyId: string,
  brand: Partial<AgencyBrand>,
): Promise<boolean> {
  const row: Record<string, string | null> = {}
  if ('primaryColor' in brand) row.brand_primary_color = brand.primaryColor
  if ('secondaryColor' in brand) row.brand_secondary_color = brand.secondaryColor
  if ('accentColor' in brand) row.brand_accent_color = brand.accentColor
  if ('font' in brand) row.brand_font = brand.font
  if ('logoUrl' in brand) row.brand_logo_url = brand.logoUrl
  if (Object.keys(row).length === 0) return true
  const { error } = await supabase.from('agencies').update(row).eq('id', agencyId)
  return !error
}

// --- Logo upload ----------------------------------------------------------------
// Stores under the `profile_images` bucket (same as avatars) inside a
// `card-logos/` folder so RLS/bucket policy already applies.
export async function uploadCardLogo(file: File): Promise<{ url: string } | { error: string }> {
  try {
    if (file.size > 2 * 1024 * 1024) return { error: 'Logo must be under 2MB' }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) return { error: 'Use PNG, JPG, WebP, or SVG' }

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || 'anon'
    const ext = file.name.split('.').pop() || 'png'
    const path = `card-logos/${userId}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('profile_images')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (upErr) return { error: upErr.message || 'Upload failed' }

    const { data: { publicUrl } } = supabase.storage.from('profile_images').getPublicUrl(path)
    return { url: publicUrl }
  } catch (e: any) {
    return { error: e?.message || 'Upload failed' }
  }
}

// --- AI design generator support ------------------------------------------------
export interface DesignVariant {
  name: string
  layout: CardLayout
  blurb: string
}

/**
 * Builds a concise brand brief for the AI generator based on the broker's
 * effective brand. Pure function — no side effects — so it's easy to test and
 * reuse on both client (preview cache) and server (API route).
 */
export function brandBrief(brand: CardBrand, brokerName?: string): string {
  const parts = [
    `Primary: ${brand.primaryColor}`,
    `Secondary: ${brand.secondaryColor}`,
    `Accent: ${brand.accentColor}`,
    `Font: ${fontCss(brand.font)}`,
    `Layout: ${brand.layout}`,
  ]
  if (brand.logoUrl) parts.push(`Logo: ${brand.logoUrl}`)
  if (brokerName) parts.push(`Broker: ${brokerName}`)
  return parts.join(' · ')
}
