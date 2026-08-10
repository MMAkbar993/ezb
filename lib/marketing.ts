'use client'

// =============================================================================
// Marketing Materials Management — data layer.
// -----------------------------------------------------------------------------
// Product catalog, variants, saved designs, orders, templates, and AI design
// generations. Everything is scoped to the authenticated broker (user_id) for
// ownership. Brand integration reuses lib/branding.ts (resolveBrand / brandBrief)
// so the studio and AI generator inherit the broker's saved colors, font + logo.
// =============================================================================

import { supabase } from '@/lib/supabase/client'

// --- Types -------------------------------------------------------------------
export type MarketingCategory =
  | 'business_cards' | 'banners' | 'brochures' | 'envelopes' | 'flyers'
  | 'postcards' | 'signage' | 'promo' | 'apparel' | 'stationery'

export interface MarketingProduct {
  id: string
  name: string
  category: MarketingCategory
  description: string | null
  base_price: number | null
  image_url: string | null
  is_active: boolean | null
  sort_order: number | null
}

export interface MarketingVariant {
  id: string
  product_id: string
  name: string
  variant_type: string
  price_adjustment: number | null
  sort_order: number | null
}

/** Full design studio state persisted on a saved design / order / ai run. */
export interface StudioDesignData {
  productId: string
  designName: string
  brand: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    font: string
    logoUrl: string | null
  }
  text: {
    headline: string
    tagline: string
    name: string
    title: string
    company: string
    phone: string
    email: string
    website: string
    address: string
    body?: string
    cta?: string
  }
  sides: 'front' | 'back'
  qr: { enabled: boolean; url: string }
  variantSelections: Record<string, string> // variantType -> variantId
  layout: string
  aiGenerated?: boolean
}

export interface MarketingDesign {
  id: string
  user_id: string | null
  product_id: string | null
  design_name: string | null
  design_data: StudioDesignData
  front_image_url: string | null
  back_image_url: string | null
  preview_url: string | null
  is_ai_generated: boolean | null
  created_at: string | null
  product?: MarketingProduct | null
}

export interface ShippingAddress {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  zip: string
  country?: string
}

export type OrderStatus =
  | 'draft' | 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface MarketingOrder {
  id: string
  user_id: string | null
  design_id: string | null
  product_id: string | null
  quantity: number | null
  variant_selections: Record<string, string>
  shipping_address: ShippingAddress
  status: OrderStatus | null
  order_total: number | null
  currency: string | null
  tracking_number: string | null
  stripe_session_id: string | null
  created_at: string | null
  product?: MarketingProduct | null
  design?: Pick<MarketingDesign, 'design_name' | 'preview_url'> | null
}

export interface MarketingTemplate {
  id: string
  name: string
  category: MarketingCategory
  description: string | null
  preview_image: string | null
  design_data: StudioDesignData
  is_premium: boolean | null
}

export interface AiDesignRecord {
  id: string
  user_id: string | null
  prompt: string | null
  design_data: StudioDesignData
  preview_url: string | null
  used: boolean | null
  created_at: string | null
}

// --- Category metadata -------------------------------------------------------
export const CATEGORIES: { id: MarketingCategory; label: string; icon: string }[] = [
  { id: 'business_cards', label: 'Business Cards', icon: '💳' },
  { id: 'banners', label: 'Banners', icon: '🏳️' },
  { id: 'brochures', label: 'Brochures', icon: '📘' },
  { id: 'envelopes', label: 'Envelopes', icon: '✉️' },
  { id: 'flyers', label: 'Flyers', icon: '📄' },
  { id: 'postcards', label: 'Postcards', icon: '🖼️' },
  { id: 'signage', label: 'Signage', icon: '🪧' },
  { id: 'promo', label: 'Promo Items', icon: '🖊️' },
  { id: 'apparel', label: 'Apparel', icon: '👕' },
  { id: 'stationery', label: 'Stationery', icon: '📮' },
]

// --- Catalog -----------------------------------------------------------------
export async function fetchProducts(category?: MarketingCategory): Promise<MarketingProduct[]> {
  let q = supabase.from('marketing_products').select('*').eq('is_active', true).order('sort_order')
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) throw new Error(error.message || 'Failed to load products')
  return data || []
}

export async function fetchProduct(id: string): Promise<MarketingProduct | null> {
  const { data } = await supabase.from('marketing_products').select('*').eq('id', id).maybeSingle()
  return data || null
}

export async function fetchVariants(productId: string): Promise<MarketingVariant[]> {
  const { data, error } = await supabase
    .from('marketing_product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
  if (error) return []
  return data || []
}

// --- Designs -----------------------------------------------------------------
export async function fetchMyDesigns(): Promise<MarketingDesign[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('marketing_designs')
    .select('*, product:marketing_products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return data || []
}

export async function getDesign(id: string): Promise<MarketingDesign | null> {
  const { data } = await supabase
    .from('marketing_designs')
    .select('*, product:marketing_products(*)')
    .eq('id', id)
    .maybeSingle()
  return data || null
}

export async function saveDesign(input: {
  productId: string
  designName: string
  designData: StudioDesignData
  frontImageUrl?: string | null
  backImageUrl?: string | null
  previewUrl?: string | null
  aiGenerated?: boolean
}): Promise<MarketingDesign> {
  const { data: { user } } = await supabase.auth.getUser()
  const payload: Record<string, unknown> = {
    user_id: user?.id || null,
    product_id: input.productId,
    design_name: input.designName,
    design_data: input.designData,
    front_image_url: input.frontImageUrl ?? null,
    back_image_url: input.backImageUrl ?? null,
    preview_url: input.previewUrl ?? null,
    is_ai_generated: input.aiGenerated ?? false,
  }
  const { data, error } = await supabase.from('marketing_designs').insert(payload).select().single()
  if (error) throw new Error(error.message || 'Failed to save design')
  return data as MarketingDesign
}

export async function updateDesign(
  id: string,
  patch: Partial<Pick<MarketingDesign, 'design_name' | 'design_data' | 'front_image_url' | 'back_image_url' | 'preview_url'>>,
): Promise<void> {
  const { error } = await supabase.from('marketing_designs').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to update design')
}

export async function deleteDesign(id: string): Promise<void> {
  const { error } = await supabase.from('marketing_designs').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete design')
}

// --- Orders -------------------------------------------------------------------
export async function fetchMyOrders(): Promise<MarketingOrder[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('marketing_orders')
    .select('*, product:marketing_products(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return data || []
}

export interface CreateOrderInput {
  designId: string | null
  productId: string
  quantity: number
  variantSelections: Record<string, string>
  shippingAddress: ShippingAddress
  orderTotal: number
  status?: OrderStatus
}

export async function createOrder(input: CreateOrderInput): Promise<MarketingOrder> {
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    user_id: user?.id || null,
    design_id: input.designId,
    product_id: input.productId,
    quantity: input.quantity,
    variant_selections: input.variantSelections,
    shipping_address: input.shippingAddress,
    order_total: input.orderTotal,
    status: input.status || 'pending',
    currency: 'usd',
  }
  const { data, error } = await supabase.from('marketing_orders').insert(payload).select().single()
  if (error) throw new Error(error.message || 'Failed to create order')
  return data as MarketingOrder
}

export async function updateOrderStatus(id: string, status: OrderStatus, tracking?: string): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (tracking !== undefined) patch.tracking_number = tracking
  const { error } = await supabase.from('marketing_orders').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to update order')
}

// --- Templates ----------------------------------------------------------------
export async function fetchTemplates(category?: MarketingCategory): Promise<MarketingTemplate[]> {
  let q = supabase.from('marketing_templates').select('*').order('created_at', { ascending: false })
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return []
  return data || []
}

// --- AI design generations -----------------------------------------------------
export async function logAiDesign(input: {
  prompt: string
  designData: StudioDesignData
  previewUrl?: string | null
}): Promise<AiDesignRecord> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('marketing_ai_designs').insert({
    user_id: user?.id || null,
    prompt: input.prompt,
    design_data: input.designData,
    preview_url: input.previewUrl ?? null,
    used: false,
  }).select().single()
  if (error) throw new Error(error.message || 'Failed to log AI design')
  return data as AiDesignRecord
}

// --- Pricing helpers ------------------------------------------------------------
export function unitPrice(product: MarketingProduct, selections: Record<string, string>, variants: MarketingVariant[]): number {
  const base = Number(product.base_price || 0)
  let adj = 0
  for (const id of Object.values(selections)) {
    const v = variants.find((x) => x.id === id)
    if (v) adj += Number(v.price_adjustment || 0)
  }
  return Math.max(0, base + adj)
}

export function totalPrice(unit: number, quantity: number): number {
  return Math.round(unit * quantity * 100) / 100
}
