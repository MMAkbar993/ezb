import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/marketplace', '/marketplace/listings', '/about', '/contact'],
        disallow: [
          '/portal/',           // token-gated client portals
          '/api/',              // API endpoints
          '/dashboard/',        // broker-only
          '/pipeline', '/leads', '/listings', '/documents', '/recast',
          '/cim', '/bov', '/due-diligence', '/agencies', '/billing',
          '/sync', '/share/',   // token-gated CIM shares (unless listed)
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
