'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CimContent, CimVersion } from '@/lib/cim'
import { LoadingState } from '@/components/ui'

/** Public CIM share view — a broker can send this link to a prospective buyer. */
export default function ShareCimPage({ params }: { params: { id: string } }) {
  const [content, setContent] = useState<CimContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('cim_versions')
          .select('*')
          .eq('id', params.id)
          .single()
        if (error) throw new Error(error.message)
        const v = data as CimVersion
        setContent(v.content_json)
      } catch (e: any) {
        setError(e.message || 'CIM not found or share link is invalid.')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id])

  if (loading) return <LoadingState label="Loading shared CIM..." />
  if (error || !content) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: '#c9a84c' }}>CONCORD</div>
          <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)' }}>⚠️ {error || 'This shared document is unavailable.'}</div>
          <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Please contact your broker for access.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#fff', padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: '#c9a84c', letterSpacing: 1 }}>CONCORD</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>CONFIDENTIAL</div>
      </div>
      <div style={{ maxWidth: 820, margin: '40px auto' }}>
        {/* Cover */}
        <div style={{ background: '#1a1a2e', color: '#fff', padding: '90px 60px', position: 'relative', borderRadius: 6, boxShadow: '0 12px 40px rgba(26,26,46,0.2)' }}>
          <div style={{ height: 2.5, background: 'var(--gold)', position: 'absolute', top: '46%', left: 0, right: 0 }} />
          <h1 style={{ color: '#c9a84c', fontSize: 34, margin: 0, fontFamily: 'Georgia, serif' }}>{content.title}</h1>
          <div style={{ color: '#fff', fontSize: 18, marginTop: 14 }}>{content.subtitle}</div>
          <div style={{ color: '#c9a84c', fontSize: 11, letterSpacing: 3, marginTop: 26 }}>CONFIDENTIAL INFORMATION MEMORANDUM</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 18 }}>Prepared: {content.generatedAt}</div>
        </div>

        {/* TOC */}
        <div style={{ background: '#fff', padding: '40px 60px', border: '1px solid var(--line)' }}>
          <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 2, color: '#c9a84c', fontWeight: 700 }}>Table of Contents</div>
          <hr style={{ border: 'none', borderTop: '2px solid #c9a84c', margin: '12px 0 18px' }} />
          {content.sections.map((s) => (
            <div key={s.id} style={{ padding: '9px 0', borderBottom: '1px solid #f0ecdf', color: '#1a1a2e', fontWeight: 600, fontSize: 14 }}>
              {s.title}
            </div>
          ))}
        </div>

        {/* Sections */}
        {content.sections.map((section) => (
          <div key={section.id} style={{ background: '#fff', padding: '40px 60px', border: '1px solid var(--line)', borderTop: 'none' }}>
            <div style={{ background: '#1a1a2e', color: '#c9a84c', padding: '14px 20px', borderRadius: 4, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
              {section.title}
            </div>
            {section.subsections.map((sub, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, color: '#1a1a2e', margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>{sub.heading}</h3>
                {sub.body.map((line, j) => (
                  <p key={j} style={{ margin: '6px 0', fontSize: 13.5, lineHeight: 1.55, color: '#444' }}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Footer */}
        <div style={{ background: '#faf9f4', padding: '40px 60px', border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
          <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 2, color: '#c9a84c', fontWeight: 700 }}>Confidentiality</div>
          <hr style={{ border: 'none', borderTop: '2px solid #c9a84c', margin: '12px 0' }} />
          <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6 }}>
            This document is confidential and proprietary to the seller and its advisor. It is provided solely for evaluating a
            potential transaction and may not be reproduced or distributed without prior written consent. This memorandum does not
            constitute an offer to sell.
          </p>
        </div>
      </div>
    </div>
  )
}
