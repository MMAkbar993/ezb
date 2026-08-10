import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Social OAuth — build authorization URLs / exchange codes / save connections
// ---------------------------------------------------------------------------

type Platform = 'instagram' | 'facebook' | 'tiktok' | 'x'

const REDIRECT_URI =
  process.env.REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/social/callback` : '')

function getConfig(platform: Platform) {
  switch (platform) {
    case 'facebook':
    case 'instagram':
      return {
        appId: process.env.FACEBOOK_APP_ID,
        secret: process.env.FACEBOOK_APP_SECRET,
      }
    case 'tiktok':
      return {
        appId: process.env.TIKTOK_CLIENT_KEY,
        secret: process.env.TIKTOK_CLIENT_SECRET,
      }
    case 'x':
      return {
        appId: process.env.X_CLIENT_ID,
        secret: process.env.X_CLIENT_SECRET,
      }
  }
}

export async function GET(req: Request) {
  const SCOPE_LABELS: Record<Platform, string> = {
    facebook: 'public_profile,pages_show_list,pages_manage_posts,publish_video',
    instagram: 'instagram_basic,instagram_content_publish,pages_show_list,pages_manage_posts',
    tiktok: 'user.info.basic,video.publish',
    x: 'tweet.read,users.read,offline.access',
  }
  const url = new URL(req.url)
  const platformParam = (url.searchParams.get('platform') || '').toLowerCase() as Platform
  const agentId = url.searchParams.get('agent_id')
  const code = url.searchParams.get('code')

  // Error from provider
  if (url.searchParams.get('error')) {
    return res(400, { ok: false, error: url.searchParams.get('error_description') || url.searchParams.get('error') })
  }

  if (!['instagram', 'facebook', 'tiktok', 'x'].includes(platformParam)) {
    return res(400, { ok: false, error: 'Missing or invalid platform' })
  }
  const platform = platformParam

  // Handshake: return the OAuth URL (redirect the user to the provider)
  if (!code) {
    const config = getConfig(platform)
    if (!config?.appId || !REDIRECT_URI) {
      return res(503, { ok: false, error: `OAuth is not configured for ${platform}. Add the env vars and REDIRECT_URI.` })
    }
    let oauthUrl = ''
    switch (platform) {
      case 'facebook':
        oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${config.appId}&redirect_uri=${encodeURIComponent(`${REDIRECT_URI}?platform=facebook${agentId ? `&agent_id=${agentId}` : ''}`)}&scope=${SCOPE_LABELS.facebook}&response_type=code`
        break
      case 'instagram':
        oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${config.appId}&redirect_uri=${encodeURIComponent(`${REDIRECT_URI}?platform=instagram${agentId ? `&agent_id=${agentId}` : ''}`)}&scope=${SCOPE_LABELS.instagram}&response_type=code`
        break
      case 'tiktok':
        oauthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${config.appId}&response_type=code&scope=${SCOPE_LABELS.tiktok}&redirect_uri=${encodeURIComponent(`${REDIRECT_URI}?platform=tiktok${agentId ? `&agent_id=${agentId}` : ''}`)}&state=${agentId || ''}`
        break
      case 'x':
        oauthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${config.appId}&redirect_uri=${encodeURIComponent(`${REDIRECT_URI}?platform=x${agentId ? `&agent_id=${agentId}` : ''}`)}&scope=${SCOPE_LABELS.x}&state=${agentId || ''}&code_challenge=challenge&code_challenge_method=plain`
        break
    }
    return res(200, { ok: true, url: oauthUrl, platform, redirectUri: REDIRECT_URI })
  }

  // Callback: exchange code -> token -> save connection (fires from OAuth provider)
  // agent_id comes through state for tiktok/x, or query for fb/ig.
  const stateAgent = url.searchParams.get('state') || ''
  const resolvedAgentId = agentId || stateAgent

  try {
    const tokens = await exchangeCode(platform, code, resolvedAgentId)
    if (!resolvedAgentId) {
      return res(200, { ok: true, message: 'Connection complete. You may close this tab.', tokens: maskTokens(tokens) })
    }
    return res(200, {
      ok: true,
      message: 'Connection saved. You may close this tab.',
      close: true,
      platform,
      connected: true,
    })
  } catch (err: any) {
    return res(500, { ok: false, error: err?.message || 'OAuth exchange failed' })
  }
}

async function exchangeCode(platform: Platform, code: string, agentId?: string): Promise<Record<string, string>> {
  const config = getConfig(platform)
  if (!config?.appId || !config.secret || !REDIRECT_URI) {
    throw new Error(`OAuth not configured for ${platform}`)
  }
  const cb = `${REDIRECT_URI}?platform=${platform}${agentId ? `&agent_id=${agentId}` : ''}`

  let tokenPayload: Record<string, string> | null = null
  let userUrl = ''
  let userBody: Record<string, string> | null = null

  switch (platform) {
    case 'facebook':
    case 'instagram': {
      const r = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.appId,
          client_secret: config.secret,
          code,
          redirect_uri: cb,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error?.message || 'Facebook exchange failed')
      tokenPayload = { access_token: d.access_token, refresh_token: d.access_token }
      userUrl = `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${d.access_token}`
      break
    }
    case 'tiktok': {
      const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: config.appId!,
          client_secret: config.secret!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: cb,
        }).toString(),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || d?.message || 'TikTok exchange failed')
      tokenPayload = { access_token: d.access_token, refresh_token: d.refresh_token }
      userUrl = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url'
      userBody = { access_token: d.access_token }
      break
    }
    case 'x': {
      const r = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: config.appId!,
          client_secret: config.secret!,
          redirect_uri: cb,
          code_verifier: 'challenge',
        }).toString(),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error_description || d?.error || 'X exchange failed')
      tokenPayload = { access_token: d.access_token, refresh_token: d.refresh_token }
      userUrl = 'https://api.x.com/2/users/me'
      userBody = { access_token: d.access_token }
      break
    }
  }

  const tokens: Record<string, string> = { ...(tokenPayload || {}) }
  if (tokenPayload?.access_token) {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${tokenPayload.access_token}` }
      if (platform === 'tiktok' || platform === 'x') {
        headers['Content-Type'] = 'application/json'
      }
      const ur = userBody
        ? await fetch(userUrl, { method: 'POST', headers, body: JSON.stringify(userBody) })
        : await fetch(userUrl, { headers })
      const ud = await ur.json()
      const user =
        platform === 'tiktok' ? ud?.data?.user
        : platform === 'x' ? ud?.data
        : ud
      tokens.platform_user_id = user?.id || user?.open_id || ''
      tokens.platform_username = user?.username || user?.display_name || user?.name || ''
      tokens.platform_name = user?.name || user?.display_name || ''
    } catch {
      // non-fatal: username resolution failed
    }
  }

  if (agentId) {
    const { supabase } = await import('@/lib/supabase/client')
    const { error } = await supabase.from('social_connections').upsert(
      {
        agent_id: agentId,
        platform,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        platform_user_id: tokens.platform_user_id || null,
        platform_username: tokens.platform_username || null,
        platform_name: tokens.platform_name || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id,platform' }
    )
    if (error) throw new Error(error.message)
  }

  return tokens
}

function maskTokens(t: Record<string, string>): Record<string, string> {
  const m: Record<string, string> = {}
  for (const k of Object.keys(t)) {
    m[k] = k.includes('token') && t[k] ? t[k].slice(0, 4) + '…' : t[k]
  }
  return m
}

function res(status: number, body: unknown) {
  return NextResponse.json(body, { status })
}
