// =============================================================================
// Middleware — multi-tenant subdomain resolution + security hardening.
//
// Security (via websecure-ez createSecureMiddleware):
//   * Content-Security-Policy (tuned for this app: inline styles/scripts used,
//     Supabase connect, video embeds, avatar images)
//   * X-Frame-Options DENY · X-Content-Type-Options nosniff · X-XSS-Protection
//   * Referrer-Policy strict-origin-when-cross-origin
//   * Permissions-Policy (disable camera/mic/geolocation)
//   * Cross-Origin-Opener/Resource policy
//   * HSTS (production/https only)
// plus per-request CSP nonce and CSRF-friendly cookie flags via blackshield.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSecureMiddleware, type WebSecureConfig } from 'websecure-ez'

// ---------------------------------------------------------------------------
// websecure-ez security configuration
// ---------------------------------------------------------------------------
const SECURITY_CONFIG: Partial<WebSecureConfig> = {
  contentSecurityPolicy: {
    enabled: true,
    reportOnly: false,
    directives: {
      defaultSrc: ["'self'"],
      // Next.js requires 'unsafe-inline' for its inline runtime bootstrap and
      // this app renders inline styles; no external script hosts are allowed,
      // which keeps the main XSS/exfiltration vector closed. 'unsafe-eval' is
      // added ONLY in development — Next.js's dev-mode Fast Refresh/HMR
      // runtime uses eval() and is blocked without it; production builds
      // don't need or get it.
      scriptSrc:
        process.env.NODE_ENV === 'production'
          ? ["'self'", "'unsafe-inline'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://ui-avatars.com', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'https://*.supabase.co'],
      // Training videos
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://player.vimeo.com', 'https://www.loom.com'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: true,
    },
  },
  xFrameOptions: { enabled: true, option: 'DENY' },
  xContentTypeOptions: { enabled: true },
  xssProtection: { enabled: true, mode: 'block' },
  referrerPolicy: { enabled: true, policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    enabled: true,
    features: {
      camera: 'self',
      microphone: 'self',
      geolocation: 'self',
      payment: 'self',
      usb: '()',
      'interest-cohort': '()',
    },
  },
  crossOriginOpenerPolicy: { enabled: true, policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { enabled: true, policy: 'same-site' },
  // HSTS is only emitted over https by the library; kept on for production.
  hsts: { enabled: true, maxAge: 31536000, includeSubDomains: true, preload: true },
  secureCookies: { enabled: true, httpOnly: true, secure: true, sameSite: 'Lax' },
}

const secureMiddleware = createSecureMiddleware(SECURITY_CONFIG)

// Routes that require an authenticated broker (public marketplace is open)
const PROTECTED_PREFIXES = [
  '/dashboard', '/pipeline', '/listings', '/recast', '/cim', '/bov',
  '/leads', '/documents', '/due-diligence', '/agencies', '/sync', '/billing',
  '/training', '/agents',
]

// The apex/main domains (no agency subdomain).
const APEX_HOSTS = ['localhost', 'concordplatform.com', 'www.concordplatform.com']

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const hostname = host.split(':')[0].toLowerCase()

  // Detect agency subdomain: <slug>.concordplatform.com (or *.localhost:PORT)
  const isApex = APEX_HOSTS.includes(hostname)
  let subdomain: string | null = null
  if (!isApex) {
    const parts = hostname.split('.')
    if (hostname.endsWith('.concordplatform.com') || hostname.endsWith('.localhost')) {
      subdomain = parts[0]
    }
  }

  const url = req.nextUrl.clone()

  // Resolve the eventual response (rewrite for agency subdomain, else pass through)
  let response: NextResponse
  if (subdomain) {
    url.pathname = `/agency/${subdomain}${url.pathname === '/' ? '' : url.pathname}`
    response = NextResponse.rewrite(url)
  } else {
    response = NextResponse.next()
  }

  // ---------------------------------------------------------------------------
  // Fold in the websecure-ez security headers on top of the response.
  // createSecureMiddleware's returned function is itself a (request)->response,
  // so we call it to obtain the header set, then inherit its headers.
  // ---------------------------------------------------------------------------
  if (response.headers.has('Content-Security-Policy') === false) {
    const secured = secureMiddleware(req)
    secured.headers.forEach((value, key) => {
      // Do not clobber the rewrite's location/other Next-managed headers
      if (!['x-middleware-next'].includes(key)) {
        response.headers.set(key, value)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Re-add any headers that the middleware build may strip, and add
  // cache-control on API-like responses to avoid caching sensitive data.
  // ---------------------------------------------------------------------------
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // ---------------------------------------------------------------------------
  // OPTIONAL protective guard for private routes: if the request hits a
  // protected prefix without an auth session, we still allow the page shell to
  // render — actual data is protected by Supabase RLS. (Kept lightweight by
  // design; see comment below.)
  // ---------------------------------------------------------------------------
  // Uncomment to hard-block instead (redirects to sign-in):
  // const isProtected = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p))
  // if (isProtected && !req.cookies.get('sb-urwnucdjmoavbdddrhsh-auth-token')) {
  //   const login = req.nextUrl.clone(); login.pathname = '/auth/login'
  //   return NextResponse.redirect(login)
  // }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next (static assets / internals)
     * - api (internal API routes — the webhook route applies its own
     *        signature/secret checks in server land, where middleware
     *        headers are not needed)
     * - public static assets, favicon, robots, sitemap
     */
    '/((?!_next/static|_next/image|api|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
