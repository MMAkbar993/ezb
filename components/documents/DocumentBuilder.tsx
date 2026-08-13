'use client'

// ===========================================================================
// DocumentBuilder — fillable document generator.
// Pulls a template's JSONB field defs + parties, lets the user fill each
// field and assign parties, then creates a filled `documents` row (with
// seeded signature slots) via lib/documentBuilder.ts.
// ===========================================================================

import { useEffect, useMemo, useState } from 'react'
import {
  DocumentTemplate,
  FilledParty,
  TemplateField,
  fetchTemplates,
  createDocument,
  renderTemplateBody,
} from '@/lib/documentBuilder'
import { supabase } from '@/lib/supabase/client'

const S = {
  wrap: { maxWidth: 820, margin: '0 auto' },
  head: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 24, color: 'var(--navy)', marginBottom: 4 },
  sub: { color: 'var(--muted)', marginBottom: 20, fontSize: 13.5 },
  card: {
    background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20,
  },
  label: { display: 'block', fontFamily: 'Georgia, serif', fontWeight: 600, color: 'var(--navy)', fontSize: 13, marginBottom: 4 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--line)', background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none', minHeight: 96, resize: 'vertical',
  } as React.CSSProperties,
  grid: { gap: 12, marginTop: 8 } as React.CSSProperties,
  sectionTitle: {
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--gold-dark)',
    fontWeight: 700, marginBottom: 10,
  },
  err: { color: '#b00020', fontSize: 13, marginTop: 8 },
  ok: { color: '#1e7e34', fontSize: 13, marginTop: 8 },
} as const

function FieldControl({
  field, value, onChange,
}: {
  field: TemplateField
  value: string
  onChange: (v: string) => void
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          style={S.textarea}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'select':
      return (
        <select style={S.input} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
    case 'date':
      return <input type="date" style={S.input} value={value} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input type="number" style={S.input} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    case 'signature':
      return <input type="text" style={S.input} placeholder="Type name to e-sign" value={value} onChange={(e) => onChange(e.target.value)} />
    default:
      return <input type="text" style={S.input} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  }
}

export default function DocumentBuilder({ listingId, dealId }: { listingId?: string; dealId?: string }) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [partyNames, setPartyNames] = useState<Record<string, { name: string; email: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [me, setMe] = useState<{ id: string; email?: string; full_name?: string } | null>(null)

  const template = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId])

  useEffect(() => {
    ;(async () => {
      try {
        const [tpls, user] = await Promise.all([
          fetchTemplates(true),
          supabase.auth.getUser().then((r) => r.data.user),
        ])
        setTemplates(tpls)
        if (tpls.length > 0) {
          setTemplateId(tpls[0].id)
          setTitle(`Draft — ${tpls[0].name}`)
        }
        if (user) setMe({ id: user.id, email: user.email, full_name: (user.user_metadata?.full_name as string) || undefined })
      } catch (e: any) {
        setError(e.message || 'Failed to load templates')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Reset values/parties when the template changes.
  useEffect(() => {
    if (!template) return
    setValues({})
    const p: Record<string, { name: string; email: string }> = {}
    for (const party of template.parties) {
      // Smart default: the agent party is auto-assigned to the current user.
      if (party.role === 'agent' && me) {
        p[party.key] = { name: me.full_name || me.email || '', email: me.email || '' }
      } else {
        p[party.key] = { name: '', email: '' }
      }
    }
    setPartyNames(p)
  }, [templateId, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    setError('')
    setSaved(false)
    if (!template) { setError('Select a template'); return }
    if (!title.trim()) { setError('Document title is required'); return }

    // Validate required fields.
    for (const f of template.fields) {
      if (f.required && !(values[f.key] ?? '').trim()) {
        setError(`"${f.label}" is required.`); return
      }
    }

    const filled: Record<string, unknown> = {}
    for (const f of template.fields) filled[f.key] = f.type === 'number' ? Number(values[f.key] || 0) : (values[f.key] ?? '')

    const parties: FilledParty[] = template.parties.map((p) => ({
      key: p.key,
      label: p.label,
      role: p.role,
      name: partyNames[p.key]?.name || null,
      email: partyNames[p.key]?.email || null,
    }))

    try {
      await createDocument({ template_id: template.id, listing_id: listingId, deal_id: dealId, title, filled_data: filled, parties })
      setSaved(true)
      setTitle(`Draft — ${template.name}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create document')
    }
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading document templates…</div>

  return (
    <div style={S.wrap}>
      <div>
        <h1 style={S.head}>Document Builder</h1>
        <p style={S.sub}>Fill a template with party details and generate a fillable document with signature slots.</p>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>1 · Template</div>
        <select style={S.input} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">— Select template —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
          ))}
        </select>
        {template?.description && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6 }}>{template.description}</p>}
      </div>

      {template && (
        <>
          <div style={S.card}>
            <div style={S.sectionTitle}>2 · Document Title</div>
            <input style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
            {listingId && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6 }}>Linked to listing — filled data is kept confidential.</p>}
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>3 · Fillable Fields</div>
            <div className="grid-2" style={S.grid}>
              {template.fields.map((f) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={S.label}>{f.label}{f.required ? ' *' : ''}</label>
                  <FieldControl field={f} value={values[f.key] ?? ''} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
                </div>
              ))}
            </div>
            {template.fields.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No custom fields on this template.</p>}
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>4 · Parties</div>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 12 }}>
              Smart assignment: the Agent party defaults to the signed-in broker; assign Seller/Buyer manually.
            </p>
            <div className="grid-2" style={{ gap: 12 }}>
              {template.parties.map((p) => (
                <div key={p.key} style={{ ...S.card, padding: 14, marginBottom: 0 }}>
                  <div style={{ ...S.label, textTransform: 'capitalize' }}>
                    {p.label} <span style={{ color: 'var(--gold-dark)' }}>({p.role})</span>
                  </div>
                  <input style={{ ...S.input, marginBottom: 6 }} placeholder="Full name" value={partyNames[p.key]?.name || ''} onChange={(e) => setPartyNames((prev) => ({ ...prev, [p.key]: { name: e.target.value, email: prev[p.key]?.email || '' } }))} />
                  <input style={S.input} placeholder="Email (for e-sign)" value={partyNames[p.key]?.email || ''} onChange={(e) => setPartyNames((prev) => ({ ...prev, [p.key]: { email: e.target.value, name: prev[p.key]?.name || '' } }))} />
                </div>
              ))}
            </div>
          </div>

          {template.body_template && (
            <div style={S.card}>
              <div style={S.sectionTitle}>5 · Preview</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', fontSize: 13.5, color: 'var(--text)', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: 14 }}>
                {renderTemplateBody(template.body_template, values)}
              </pre>
            </div>
          )}

          <button
            onClick={handleCreate}
            style={{
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', color: 'var(--navy)',
              fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 15, border: 'none',
              padding: '12px 24px', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 6px rgba(201,168,76,0.3)',
            }}
          >
            Create Document
          </button>
          {error && <div style={S.err}>⚠️ {error}</div>}
          {saved && <div style={S.ok}>✅ Document created — signature slots seeded. It now appears in the Documents dashboard.</div>}
        </>
      )}
    </div>
  )
}
