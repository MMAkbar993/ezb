'use client'

import { useState } from 'react'
import QRCanvas from './QRCanvas'

export type CertTemplate = 'gold' | 'navy' | 'ivory'

// Certificate generation — renders an elegant, printable certificate and lets
// the broker download it as a PNG, with a scannable QR verification code and
// selectable templates. Pure DOM + canvas, no heavy runtime deps.

const TEMPLATES: Record<CertTemplate, {
  label: string
  bg: string
  border: string
  inner: string
  header: string
  accent: string
  body: string
}> = {
  gold:   { label: 'Gold',   bg: 'linear-gradient(135deg,#fbfaf6,#f3efe6)', border: '#c9a84c', inner: '#e0c97e', header: '#1a1a2e', accent: '#a8872f', body: '#7a7a8a' },
  navy:   { label: 'Navy',   bg: 'linear-gradient(135deg,#0f2038,#14294f)', border: '#c9a84c', inner: '#2c4a7a', header: '#ffffff', accent: '#e0c97e', body: '#c7cfe0' },
  ivory:  { label: 'Ivory',  bg: 'linear-gradient(135deg,#fffdf8,#f7f1e3)', border: '#b7a26a', inner: '#d8c9a0', header: '#3a3326', accent: '#8a7440', body: '#8a8474' },
}

export default function TrainingCertificate({
  brokerName = 'Broker',
  moduleTitle = 'Business Brokerage Fundamentals',
  moduleId,
  issuedAt,
  verificationCode,
  verifyUrl,
  defaultTemplate = 'gold',
}: {
  brokerName?: string
  moduleTitle?: string
  moduleId?: string
  issuedAt?: string | null
  verificationCode?: string | null
  verifyUrl?: string
  defaultTemplate?: CertTemplate
}) {
  const [template, setTemplate] = useState<CertTemplate>(defaultTemplate)
  const t = TEMPLATES[template]
  const date = issuedAt ? new Date(issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const vUrl = verifyUrl || (verificationCode ? `https://ezbusinessadvisors.vercel.app/dashboard/certificates?code=${verificationCode}` : '')

  const download = () => {
    const w = 1200, h = 850
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paper = ctx.createLinearGradient(0, 0, w, h)
    if (template === 'navy') { paper.addColorStop(0, '#0f2038'); paper.addColorStop(1, '#14294f') }
    else { paper.addColorStop(0, t.bg.split(',')[0].replace('linear-gradient(135deg,', '')); paper.addColorStop(1, t.border === '#b7a26a' ? '#f7f1e3' : '#f3efe6') }
    ctx.fillStyle = paper
    ctx.fillRect(0, 0, w, h)

    // outer border
    ctx.strokeStyle = t.border
    ctx.lineWidth = 14
    ctx.strokeRect(30, 30, w - 60, h - 60)
    // inner border
    ctx.strokeStyle = t.inner
    ctx.lineWidth = 2
    ctx.strokeRect(56, 56, w - 112, h - 112)

    ctx.textAlign = 'center'
    // header
    ctx.fillStyle = t.header
    ctx.font = '600 44px Georgia, serif'
    ctx.fillText('CONCORD', w / 2, 170)
    ctx.font = '14px Georgia, serif'
    ctx.fillStyle = t.accent
    ctx.fillText('D E A L   P L A T F O R M', w / 2, 200)

    ctx.fillStyle = t.body
    ctx.font = '20px Georgia, serif'
    ctx.fillText('Certificate of Completion', w / 2, 300)
    ctx.fillStyle = t.body
    ctx.font = '18px Georgia, serif'
    ctx.fillText('This is to certify that', w / 2, 360)
    ctx.fillStyle = t.header
    ctx.font = '700 42px Georgia, serif'
    ctx.fillText(brokerName, w / 2, 430)
    ctx.fillStyle = t.body
    ctx.font = '18px Georgia, serif'
    ctx.fillText('has successfully completed the module', w / 2, 480)
    ctx.fillStyle = t.accent
    ctx.font = '700 28px Georgia, serif'
    ctx.fillText(moduleTitle, w / 2, 530)
    ctx.fillStyle = t.body
    ctx.font = '16px Georgia, serif'
    ctx.fillText(`${moduleId ? `Module ${moduleId} · ` : ''}Issued ${date || '—'}`, w / 2, 580)
    if (verificationCode) {
      ctx.font = '13px Georgia, serif'
      ctx.fillStyle = t.body
      ctx.fillText(`Verify: ${verificationCode} · concord.deal`, w / 2, 608)
    }

    // seal
    const cx = w - 180, cy = h - 150
    ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2)
    ctx.fillStyle = t.border; ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '700 14px Georgia, serif'
    ctx.fillText('CONCORD', cx, cy - 2)
    ctx.font = '10px Georgia, serif'
    ctx.fillText('CERTIFIED', cx, cy + 14)

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `concord-certificate-${(moduleId || template || 'module').toLowerCase()}.png`
    a.click()
  }

  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      {/* template selector */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        {(Object.keys(TEMPLATES) as CertTemplate[]).map((k) => (
          <button
            key={k}
            onClick={() => setTemplate(k)}
            className="btn btn-ghost"
            style={{
              padding: '5px 12px', fontSize: 13,
              borderColor: template === k ? 'var(--gold)' : 'var(--line)',
              boxShadow: template === k ? '0 0 0 1px var(--gold)' : 'none',
            }}
          >
            {TEMPLATES[k].label}
          </button>
        ))}
      </div>

      {/* on-screen styled certificate */}
      <div
        style={{
          background: t.bg, border: '10px solid ' + t.border,
          boxShadow: 'inset 0 0 0 2px ' + t.inner + ', 0 8px 24px rgba(0,0,0,0.12)',
          borderRadius: 6, padding: '44px 40px', maxWidth: 680, margin: '0 auto 12px', position: 'relative',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Georgia, serif', color: t.header, letterSpacing: 2 }}>
          CONCORD
        </div>
        <div style={{ fontSize: 12, letterSpacing: '0.35em', color: t.accent, marginTop: 2 }}>
          DEAL PLATFORM
        </div>
        <div style={{ height: 2, width: 90, background: t.border, margin: '16px auto' }} />
        <div style={{ fontSize: 18, color: t.body }}>Certificate of Completion</div>
        <div style={{ fontSize: 14, color: t.body, marginTop: 22 }}>This certifies that</div>
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Georgia, serif', color: t.header, margin: '10px 0' }}>
          {brokerName}
        </div>
        <div style={{ fontSize: 14, color: t.body, marginBottom: 8 }}>has completed</div>
        <div style={{ fontSize: 21, fontWeight: 700, color: t.accent, fontFamily: 'Georgia, serif' }}>{moduleTitle}</div>
        <div style={{ fontSize: 13, color: t.body, marginTop: 22 }}>
          {moduleId && `Module ${moduleId} · `}Issued {date || '—'}
        </div>

        {/* verification code + QR */}
        {verificationCode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', marginTop: 16 }}>
            <div style={{ border: '1px solid ' + t.inner, padding: 4, background: '#fff', borderRadius: 4 }}>
              <QRCanvas value={vUrl} size={88} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', color: t.body }}>VERIFICATION CODE</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', color: t.accent, letterSpacing: 2 }}>
                {verificationCode}
              </div>
              <div style={{ fontSize: 11, color: t.body }}>Scan to verify this certificate</div>
            </div>
          </div>
        )}

        {/* seal */}
        <div
          style={{
            position: 'absolute', right: 40, bottom: 40, width: 62, height: 62, borderRadius: '50%',
            background: t.border, color: '#fff', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 12 }}>CONCORD</span>
          <span style={{ fontSize: 8, letterSpacing: 1 }}>CERTIFIED</span>
        </div>
      </div>

      <button className="btn btn-primary" onClick={download}>⬇ Download Certificate (PNG)</button>
    </div>
  )
}
