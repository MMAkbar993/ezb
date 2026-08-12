'use client'

// ---------------------------------------------------------------------------
// DynamicFormFields — renders a SellerFormSection[] (grouped fields with
// label/type/options) as an editable form, or read-only text when `readOnly`
// is set. Shared by the broker-side seller-form editor, the public seller
// sign page, and the public buyer NDA + Buyer Profile gate — one renderer,
// one visual language, instead of five hand-built forms.
// ---------------------------------------------------------------------------

import type { SellerFormSection } from '@/lib/sellerFormSchemas'

export type FormValues = Record<string, string | number | boolean | null | undefined>

interface Props {
  sections: SellerFormSection[]
  values: FormValues
  onChange?: (key: string, value: string | boolean) => void
  readOnly?: boolean
  /** Fields rendered as pre-filled, locked (grey background, not editable) even when the rest of the form is editable. */
  lockedKeys?: string[]
}

export default function DynamicFormFields({ sections, values, onChange, readOnly = false, lockedKeys = [] }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {sections.map((section) => (
        <div key={section.title}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--gold-dark)', fontWeight: 700, marginBottom: 10, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
            {section.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {section.fields.map((field) => {
              const locked = readOnly || lockedKeys.includes(field.key)
              const raw = values[field.key]

              if (field.type === 'checkbox') {
                return (
                  <label key={field.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'var(--text)', gridColumn: field.label.length > 55 ? '1 / -1' : undefined }}>
                    <input
                      type="checkbox"
                      checked={!!raw}
                      disabled={locked}
                      onChange={(e) => onChange?.(field.key, e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    {field.label}
                  </label>
                )
              }

              const isWide = field.type === 'textarea'
              return (
                <div key={field.key} style={{ gridColumn: isWide ? '1 / -1' : undefined }}>
                  <label className="label">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="textarea"
                      rows={3}
                      value={(raw as string) || ''}
                      disabled={locked}
                      onChange={(e) => onChange?.(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="select"
                      value={(raw as string) || ''}
                      disabled={locked}
                      onChange={(e) => onChange?.(field.key, e.target.value)}
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt || 'Select…'}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={raw === null || raw === undefined ? '' : String(raw)}
                      disabled={locked}
                      onChange={(e) => onChange?.(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={locked ? { background: 'var(--cream)', color: 'var(--muted)' } : undefined}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
