import type { Metadata, Viewport } from 'next'
import './globals.css'
import LegalFooter from '@/components/public/LegalFooter'
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister'

const APP_NAME = 'Concord Deal Platform'
const APP_DESCRIPTION =
  'Business brokerage platform — listings, deal pipeline, client portals, and financial recasting.'

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Business Brokerage`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Concord',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    type: 'website',
    siteName: APP_NAME,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Concord Deal Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Concord" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="color-scheme" content="light" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--paper)',
        }}
      >
        <main style={{ flex: '1 1 auto' }}>{children}</main>
        <LegalFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
