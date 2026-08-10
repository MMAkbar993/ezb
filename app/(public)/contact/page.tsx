import type { Metadata } from 'next'
import ContactForm from '@/components/public/ContactForm'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://concord.ezbusinessadvisors.com'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with EZ Business Advisors about buying or selling a business.',
  alternates: { canonical: `${BASE}/contact` },
}

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px' }}>
      <div style={{ color: '#c9a84c', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>Contact</div>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: '#1a1a2e', margin: '10px 0 14px' }}>Get in Touch</h1>
      <p style={{ fontSize: 15, color: '#666', lineHeight: 1.7, marginBottom: 28 }}>
        Whether you're exploring a sale, evaluating an acquisition, or just have a question — reach out and a broker will respond promptly. All inquiries are treated confidentially.
      </p>
      <ContactForm />
    </div>
  )
}
