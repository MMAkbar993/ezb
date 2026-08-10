import { supabase } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Social Media Posting Service
//   Facebook / Instagram -> Graph API (v19.0)
//   TikTok               -> Content Posting API
//   X (Twitter)          -> API v2
// Handles image uploads, errors/retries and status updates.
//
// NOTE ON CREDENTIALS:
//   Graph API + X + TikTok all REQUIRE a server-side secret + a real OAuth
//   app with the correct redirect URI. The env placeholders below must be
//   filled in by the platform app dashboards before live posting works.
//   Until then the service degrades gracefully (marks posts "pending" with
//   a clear error) so the UI and data model are fully functional.
// ---------------------------------------------------------------------------

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'x'

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string; icon: string }[] = [
  { id: 'facebook', label: 'Facebook', icon: '🅵' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
]

export interface SocialConnection {
  id: string
  agent_id: string
  platform: SocialPlatform
  access_token: string | null
  refresh_token: string | null
  platform_user_id: string | null
  platform_username: string | null
  platform_name: string | null
  expires_at: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface SocialSettings {
  id: string
  agent_id: string
  platform: SocialPlatform
  auto_post_enabled: boolean
  post_template: string | null
  include_images: boolean
  include_link: boolean
  hashtags: string | null
  custom_message: string | null
  schedule_time: string | null
  created_at?: string
  updated_at?: string
}

export interface SocialPost {
  id: string
  listing_id: string | null
  agent_id: string
  platform: SocialPlatform
  post_id: string | null
  post_url: string | null
  content: string | null
  image_urls: string[] | null
  scheduled_for: string | null
  posted_at: string | null
  status: 'pending' | 'posted' | 'failed' | 'scheduled'
  error: string | null
  engagement_likes: number
  engagement_comments: number
  engagement_shares: number
  created_at?: string
}

// ---------------------------------------------------------------------------
// Helpers: server-side Supabase client (bypasses RLS for service operations)
// ---------------------------------------------------------------------------
function getServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------
export async function fetchConnections(agentId?: string): Promise<SocialConnection[]> {
  let q = supabase.from('social_connections').select('*')
  if (agentId) q = q.eq('agent_id', agentId)
  const { data, error } = await q.order('platform', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as SocialConnection[]) || []
}

export async function saveConnection(
  agentId: string,
  platform: SocialPlatform,
  fields: Partial<Pick<SocialConnection, 'access_token' | 'refresh_token' | 'platform_user_id' | 'platform_username' | 'platform_name' | 'expires_at' | 'is_active'>>
): Promise<void> {
  const { error } = await supabase.from('social_connections').upsert(
    { agent_id: agentId, platform, ...fields, updated_at: new Date().toISOString() },
    { onConflict: 'agent_id,platform' }
  )
  if (error) throw new Error(error.message)
}

export async function disconnectPlatform(agentId: string, platform: SocialPlatform): Promise<void> {
  const { error } = await supabase
    .from('social_connections')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('agent_id', agentId)
    .eq('platform', platform)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export async function fetchSettings(agentId?: string): Promise<SocialSettings[]> {
  let q = supabase.from('social_settings').select('*')
  if (agentId) q = q.eq('agent_id', agentId)
  const { data, error } = await q.order('platform', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as SocialSettings[]) || []
}

export async function saveSettings(
  agentId: string,
  platform: SocialPlatform,
  fields: Partial<SocialSettings>
): Promise<void> {
  const { error } = await supabase.from('social_settings').upsert(
    { agent_id: agentId, platform, ...fields, updated_at: new Date().toISOString() },
    { onConflict: 'agent_id,platform' }
  )
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
export async function fetchPosts(filters?: { agentId?: string; platform?: SocialPlatform; status?: string }): Promise<SocialPost[]> {
  let q = supabase.from('social_posts').select('*')
  if (filters?.agentId) q = q.eq('agent_id', filters.agentId)
  if (filters?.platform) q = q.eq('platform', filters.platform)
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as SocialPost[]) || []
}

export async function createSocialPost(
  fields: Pick<SocialPost, 'agent_id' | 'platform' | 'listing_id' | 'content' | 'image_urls' | 'scheduled_for' | 'status'>
): Promise<SocialPost> {
  const { data, error } = await supabase.from('social_posts').insert(fields).select().single()
  if (error) throw new Error(error.message)
  return data as SocialPost
}

export async function updatePostStatus(id: string, patch: Partial<SocialPost>): Promise<void> {
  const { error } = await supabase.from('social_posts').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Content generation from a listing
// ---------------------------------------------------------------------------
export interface ListingForPost {
  id: string
  business_name?: string | null
  headline?: string | null
  industry?: string | null
  location_general?: string | null
  asking_price?: number | null
  annual_revenue?: number | null
  sde?: number | null
  image_urls?: string[] | null
  primary_image_url?: string | null
  listing_url?: string | null
}

export function fmt$ (n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function buildPostContent(listing: ListingForPost, settings?: Partial<SocialSettings>): string {
  const custom = settings?.custom_message?.trim()
  if (custom) return custom

  const price = fmt$(listing.asking_price)
  const tmpl = settings?.post_template?.trim()
  if (tmpl) {
    return tmpl
      .replace(/\{business\}/g, listing.business_name || 'this business')
      .replace(/\{price\}/g, price)
      .replace(/\{industry\}/g, listing.industry || '')
      .replace(/\{location\}/g, listing.location_general || '')
      .replace(/\{revenue\}/g, fmt$(listing.annual_revenue))
      .replace(/\{sde\}/g, fmt$(listing.sde))
  }

  const name = listing.business_name || listing.headline || 'This business'
  const industry = listing.industry ? ` in ${listing.industry}` : ''
  const location = listing.location_general ? ` based in ${listing.location_general}` : ''
  return `For sale${industry}: ${name}${location} — asking ${price}. Serious inquiries welcome. Contact us to learn more.`
}

export function buildHashtags(settings?: Partial<SocialSettings>, extra?: string[]): string {
  const fromSettings = (settings?.hashtags || '').split(/[\s,]+/).filter(Boolean)
  const base = ['#businessforsale', '#businessbroker']
  const tags = [...new Set([...base, ...fromSettings, ...(extra || [])])]
  return tags.join(' ')
}

// ---------------------------------------------------------------------------
// Auto-post on listing upload — queues social_posts for enabled platforms
// ---------------------------------------------------------------------------
export async function queueAutoPosts(
  agentId: string,
  listing: ListingForPost,
  opts?: { force?: boolean }
): Promise<SocialPost[]> {
  const [settingsRows, connRows] = await Promise.all([
    fetchSettings(agentId),
    fetchConnections(agentId),
  ])

  const enabled = settingsRows.filter(s => s.auto_post_enabled !== false)
  const active = connRows.filter(c => c.is_active)
  const created: SocialPost[] = []

  const targets = opts?.force
    ? [...new Set([...enabled.map(e => e.platform), ...active.map(a => a.platform)])]
    : enabled.map(e => e.platform).filter(p => active.some(a => a.platform === p))

  for (const platform of targets) {
    const settings = settingsRows.find(s => s.platform === platform)
    const content = buildPostContent(listing, settings)
    const platforms: SocialPlatform[] = ['instagram','facebook','tiktok','x']
    if (!platforms.includes(platform as SocialPlatform)) continue

    const imageUrls = [
      ...(listing.primary_image_url ? [listing.primary_image_url] : []),
      ...(listing.image_urls || []),
    ]

    const p = await createSocialPost({
      agent_id: agentId,
      platform: platform as SocialPlatform,
      listing_id: listing.id,
      content,
      image_urls: settings?.include_images === false ? [] : imageUrls.slice(0, 10),
      scheduled_for: settings?.schedule_time
        ? new Date(`${new Date().toISOString().slice(0, 10)}T${settings.schedule_time}`).toISOString()
        : null,
      status: settings?.schedule_time ? 'scheduled' : 'pending',
    })
    created.push(p)
  }

  // Fire-and-forget immediate posting for non-scheduled posts.
  if (!opts?.force) {
    for (const post of created.filter(p => p.status === 'pending')) {
      void postToPlatform(post).catch(() => {})
    }
  }

  return created
}

// ---------------------------------------------------------------------------
// Post to a single platform (used by the dashboard "manual post" + auto-post)
// ---------------------------------------------------------------------------
export async function postNow(post: SocialPost): Promise<SocialPost> {
  return postToPlatform(post)
}

async function postToPlatform(post: SocialPost): Promise<SocialPost> {
  // Resolve the agent's access token for this platform.
  const { data: conn } = await supabase
    .from('social_connections')
    .select('*')
    .eq('agent_id', post.agent_id)
    .eq('platform', post.platform)
    .eq('is_active', true)
    .maybeSingle()

  if (!conn?.access_token) {
    await updatePostStatus(post.id, { status: 'failed', error: 'No active connection for this platform. Connect it in Social -> Connections.' })
    return { ...post, status: 'failed', error: 'No active connection' }
  }

  // Guard: credentials not configured -> mark pending (not failed) so the UI
  // shows it clearly and it can be retried once app credentials are set.
  if (!areCredentialsConfigured(post.platform)) {
    await updatePostStatus(post.id, { status: 'pending', error: 'Platform app credentials not configured in Vercel env vars yet.' })
    return { ...post }
  }

  try {
    let result: { postId: string; postUrl: string }
    switch (post.platform) {
      case 'facebook':
        result = await postToFacebook(post, conn.access_token)
        break
      case 'instagram':
        result = await postToInstagram(post, conn.access_token)
        break
      case 'tiktok':
        result = await postToTikTok(post, conn.access_token)
        break
      case 'x':
        result = await postToX(post, conn.access_token)
        break
      default:
        throw new Error('Unsupported platform')
    }

    const postedAt = new Date().toISOString()
    await updatePostStatus(post.id, {
      status: 'posted',
      post_id: result.postId,
      post_url: result.postUrl,
      posted_at: postedAt,
      error: null,
    })
    return { ...post, status: 'posted', post_id: result.postId, post_url: result.postUrl, posted_at: postedAt }
  } catch (err: any) {
    await updatePostStatus(post.id, { status: 'failed', error: err?.message || 'Post failed' })
    return { ...post, status: 'failed', error: err?.message || 'Post failed' }
  }
}

function areCredentialsConfigured(platform: SocialPlatform): boolean {
  switch (platform) {
    case 'facebook':
    case 'instagram':
      return !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET
    case 'tiktok':
      return !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET
    case 'x':
      return !!process.env.X_CLIENT_ID && !!process.env.X_CLIENT_SECRET
  }
}

// ---------------------------------------------------------------------------
// Platform adapters (Graph API / TikTok / X v2)
// ---------------------------------------------------------------------------
async function postToFacebook(post: SocialPost, token: string): Promise<{ postId: string; postUrl: string }> {
  const body: Record<string, string> = { message: post.content || '', access_token: token }
  if (post.image_urls?.length) {
    body.url = post.image_urls[0]
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/me/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Facebook post failed')
  const id = data?.id || ''
  return { postId: id, postUrl: `https://www.facebook.com/${id}` }
}

async function postToInstagram(post: SocialPost, token: string): Promise<{ postId: string; postUrl: string }> {
  const image = post.image_urls?.[0]
  if (!image) throw new Error('Instagram posts require at least one image.')
  // Step 1: create media container
  const createRes = await fetch(
    `https://graph.facebook.com/v19.0/me/media?image_url=${encodeURIComponent(image)}&caption=${encodeURIComponent(post.content || '')}&access_token=${token}`,
    { method: 'POST' }
  )
  const createData = await createRes.json()
  if (!createRes.ok) throw new Error(createData?.error?.message || 'Instagram media create failed')
  const containerId = createData.id
  // Step 2: publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/me/media_publish?creation_id=${containerId}&access_token=${token}`,
    { method: 'POST' }
  )
  const publishData = await publishRes.json()
  if (!publishRes.ok) throw new Error(publishData?.error?.message || 'Instagram publish failed')
  return { postId: publishData?.id || containerId, postUrl: `https://www.instagram.com/p/${publishData?.id || ''}` }
}

async function postToTikTok(post: SocialPost, token: string): Promise<{ postId: string; postUrl: string }> {
  const video = post.image_urls?.[0]
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      post_info: { title: post.content || '', privacy_level: 'SELF_ONLY' },
      source_info: video ? { video_url: video } : { },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'TikTok post failed')
  const publishId = data?.data?.publish_id || ''
  return { postId: publishId, postUrl: `https://www.tiktok.com/upload?publish_id=${publishId}` }
}

async function postToX(post: SocialPost, token: string): Promise<{ postId: string; postUrl: string }> {
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text: post.content || '' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || data?.title || 'X post failed')
  const id = data?.data?.id || ''
  return { postId: id, postUrl: `https://x.com/i/status/${id}` }
}
