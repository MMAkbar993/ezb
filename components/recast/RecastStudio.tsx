'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RecastInput, RecastResult, RecastEntityType, ENTITY_TYPES,
  ADD_BACK_CATEGORIES, AddBack, AddBackCategory, YearFinancials,
  recastFinancials, fmt$, fmt$K,
} from '@/lib/recast'
import { UploadedFinancialDoc, uploadFinancialDocument, extractFinancialDocument } from '@/lib/recastDocs'
import { fetchListings, Listing } from '@/lib/listings'
import { saveRecastProject } from '@/lib/recast'
import { exportRecastToPdf } from '@/lib/pdfExport'
import { useToast } from '@/components/ui/Toast'
import { LoadingState, Card, CardHeader, EmptyState, Badge } from '@/components/ui'
import RecastReport from './RecastReport'

const CURRENT_YEAR = new Date().getFullYear()

interface YearForm {
  year: number
  label: string
  grossRevenue: string
  cogs: string
  operatingExpenses: string
  ownerComp: string
  depreciation: string
  interest: string
  otherExpenses: string
  netIncome: string
}

const emptyYear = (year: number): YearForm => ({
  year, label: `FY${year}`, grossRevenue: '', cogs: '', operatingExpenses: '', ownerComp: '',
  depreciation: '', interest: '', otherExpenses: '', netIncome: '',
})

const n = (s: string) => (s === '' ? 0 : Number(s) || 0)

export default function RecastStudio() {
  const toast = useToast()
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [listingId, setListingId] = useState<string>('')
  const [businessName, setBusinessName] = useState('')
  const [entityType, setEntityType] = useState<RecastEntityType>('s_corp')
  const [years, setYears] = useState<YearForm[]>([emptyYear(CURRENT_YEAR - 1), emptyYear(CURRENT_YEAR - 2), emptyYear(CURRENT_YEAR - 3)])
  const [addBacks, setAddBacks] = useState<AddBack[]>([])
  const [docs, setDocs] = useState<UploadedFinancialDoc[]>([])
  const [result, setResult] = useState<RecastResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReport, setShowReport] = useState(false)
  const [addBackDraft, setAddBackDraft] = useState<{ category: AddBackCategory; description: string; amount: string; recurring: boolean; year: number }>({
    category: 'owner_salary', description: '', amount: '', recurring: true, year: CURRENT_YEAR - 1,
  })

  useEffect(() => {
    fetchListings()
      .then((l) => { setListings(l); setLoading(false) })
      .catch((e) => { toast(e.message, 'error'); setLoading(false) })
  }, [toast])

  const handleListingChange = (id: string) => {
    setListingId(id)
    const l = listings.find((x) => x.id === id)
    if (l) {
      setBusinessName(l.business_name || '')
    }
  }

  const addYear = () => {
    const yearsArr = years.slice()
    const lastYear = yearsArr[0]?.year ?? CURRENT_YEAR - 1
    yearsArr.unshift(emptyYear(lastYear - 1))
    setYears(yearsArr)
  }

  const removeYear = (idx: number) => {
    if (years.length <= 1) return
    setYears(years.filter((_, i) => i !== idx))
  }

  const setYear = (idx: number, key: keyof YearForm, val: string) => {
    setYears(years.map((y, i) => (i === idx ? { ...y, [key]: val } : y)))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    try {
      for (const file of Array.from(files)) {
        const doc = await uploadFinancialDocument(listingId || 'general', file)
        const rows = await extractFinancialDocument(doc, CURRENT_YEAR - 1)
        setDocs((d) => [...d, { ...doc, extracted: rows.length > 0, extractedRows: rows }])
        // Prefill financials from extracted CSV rows (if business not yet named)
        if (rows.length > 0) {
          toast(`Extracted ${rows.length} fiscal period(s) from ${file.name}`, 'success')
          seedFromExtraction(rows)
        } else {
          toast(`Uploaded ${file.name} — awaiting OCR extraction`, 'info')
        }
      }
    } catch (err: any) {
      toast(err.message || 'Upload failed', 'error')
    }
    e.target.value = ''
  }

  const seedFromExtraction = (rows: { year: number; revenue?: number; cogs?: number; operatingExpenses?: number; ownerComp?: number; depreciation?: number; interest?: number; otherExpenses?: number }[]) => {
    setYears((cur) => {
      const mapped = cur.map((yf) => {
        const r = rows.find((x) => x.year === yf.year)
        return r
          ? { ...yf, grossRevenue: r.revenue !== undefined ? String(r.revenue) : yf.grossRevenue, cogs: r.cogs !== undefined ? String(r.cogs) : yf.cogs, operatingExpenses: r.operatingExpenses !== undefined ? String(r.operatingExpenses) : yf.operatingExpenses, ownerComp: r.ownerComp !== undefined ? String(r.ownerComp) : yf.ownerComp, depreciation: r.depreciation !== undefined ? String(r.depreciation) : yf.depreciation, interest: r.interest !== undefined ? String(r.interest) : yf.interest, otherExpenses: r.otherExpenses !== undefined ? String(r.otherExpenses) : yf.otherExpenses }
          : yf
      })
      return mapped
    })
  }

  const addAddBack = () => {
    if (!addBackDraft.description.trim() || !addBackDraft.amount) { toast('Add-back needs a description and amount', 'error'); return }
    setAddBacks((a) => [
      ...a,
      { id: `ab-${Date.now()}`, category: addBackDraft.category, description: addBackDraft.description, amount: n(addBackDraft.amount), recurring: addBackDraft.recurring, year: addBackDraft.year },
    ])
    setAddBackDraft({ ...addBackDraft, description: '', amount: '' })
  }

  const removeAddBack = (id: string) => setAddBacks((a) => a.filter((x) => x.id !== id))
  const toggleRecurring = (id: string) => setAddBacks((a) => a.map((x) => (x.id === id ? { ...x, recurring: !x.recurring } : x)))

  const runRecast = () => {
    const yearData: YearFinancials[] = years.map((y) => ({
      year: y.year, label: y.label,
      grossRevenue: n(y.grossRevenue),
      cogs: n(y.cogs), operatingExpenses: n(y.operatingExpenses),
      ownerComp: n(y.ownerComp), depreciation: n(y.depreciation),
      interest: n(y.interest), otherExpenses: n(y.otherExpenses),
      netIncome: n(y.netIncome) || 0,
    }))

    const input: RecastInput = {
      listingId: listingId || null,
      businessName: businessName || 'Your Business',
      entityType,
      currency: '$',
      years: yearData,
      addBacks,
    }
    setResult(recastFinancials(input))
    setShowReport(true)
    toast('Recast complete', 'success')
  }

  const handleSaveProject = async () => {
    const yearData: YearFinancials[] = years.map((y) => ({
      year: y.year, label: y.label,
      grossRevenue: n(y.grossRevenue),
      cogs: n(y.cogs), operatingExpenses: n(y.operatingExpenses),
      ownerComp: n(y.ownerComp), depreciation: n(y.depreciation),
      interest: n(y.interest), otherExpenses: n(y.otherExpenses),
      netIncome: n(y.netIncome) || 0,
    }))
    try {
      const saved = await saveRecastProject({
        listing_id: listingId || null,
        business_name: businessName || 'Untitled Business',
        entity_type: entityType,
        currency: '$',
        yearFinancials: yearData,
        addBacks,
        result: result,
        status: 'draft',
      })
      toast(`Recast project saved (${saved.id.slice(0, 8)}…)`, 'success')
    } catch (e: any) {
      toast(e.message || 'Save failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (!result) return
    exportRecastToPdf(result)
    toast('PDF report downloaded', 'success')
  }

  if (loading) return <LoadingState label="Loading recasting studio..." />

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Financial Recasting Engine</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Normalize owner financials into sustainable SDE / EBITDA — broker-grade output
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {result && <button className="btn btn-ghost" onClick={handleExportPdf}>⬇️ Export PDF</button>}
          <button className="btn btn-navy" onClick={handleSaveProject}>💾 Save Project</button>
          <button className="btn btn-primary" onClick={runRecast} disabled={!years.some((y) => n(y.grossRevenue) > 0)}>
            ⚡ Run Recast
          </button>
        </div>
      </header>

      {/* Entity + listing */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="grid-3" style={{ gap: 14 }}>
          <div>
            <label className="label">Business / Listing</label>
            <select className="select" value={listingId} onChange={(e) => handleListingChange(e.target.value)}>
              <option value="">— Enter manually —</option>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.business_name || 'Unnamed'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Business Name</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Holdings LLC" />
          </div>
          <div>
            <label className="label">Entity Type</label>
            <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value as RecastEntityType)}>
              {ENTITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          💡 Entity type affects which add-backs are standard (e.g. C-Corp owner comp vs S-Corp distributions).
        </div>
      </div>

      <div className="grid-responsive collapse-md" style={{ '--grid-cols': '1fr 1.2fr', '--grid-gap': '20px', alignItems: 'start' } as React.CSSProperties}>
        {/* LEFT: uploads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardHeader title="Step 1 · Upload Financial Docs" subtitle="Tax returns, P&L, balance sheets, CSV/Excel — auto-extract" />
            <div style={{ padding: '16px 20px 20px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--line)', borderRadius: 10, padding: '28px 16px', cursor: 'pointer', background: 'var(--cream)' }}>
                <span style={{ fontSize: 30 }}>📤</span>
                <span style={{ fontWeight: 700, color: 'var(--navy)', marginTop: 8 }}>Drop financial documents here</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>PDF · CSV · Excel · Images (up to 20MB)</span>
                <input type="file" multiple accept=".pdf,.csv,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              {docs.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map((d) => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                      <span>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fileName}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{Math.round(d.size / 1024)} KB</div>
                      </div>
                      <Badge color={d.extracted ? '#22c55e' : '#f59e0b'}>{d.extracted ? 'Extracted' : 'OCR pending'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Step 2 · Add-Backs / Adjustments" subtitle="Account for owner compensation, D&A, one-time & discretionary items" />
            <div style={{ padding: '16px 20px 20px' }}>
              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <label className="label">Category</label>
                  <select className="select" value={addBackDraft.category} onChange={(e) => setAddBackDraft({ ...addBackDraft, category: e.target.value as AddBackCategory })}>
                    {ADD_BACK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fiscal Year</label>
                  <select className="select" value={addBackDraft.year} onChange={(e) => setAddBackDraft({ ...addBackDraft, year: Number(e.target.value) })}>
                    {years.map((y) => <option key={y.year} value={y.year}>{y.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-responsive collapse-md" style={{ '--grid-cols': '2fr 1fr 1fr', '--grid-gap': '10px', marginTop: 10 } as React.CSSProperties}>
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={addBackDraft.description} onChange={(e) => setAddBackDraft({ ...addBackDraft, description: e.target.value })} placeholder="e.g. Owner's personal credit card" />
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input className="input" type="number" value={addBackDraft.amount} onChange={(e) => setAddBackDraft({ ...addBackDraft, amount: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="btn btn-navy" style={{ width: '100%', justifyContent: 'center' }} onClick={addAddBack}>+ Add</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input type="checkbox" checked={addBackDraft.recurring} onChange={(e) => setAddBackDraft({ ...addBackDraft, recurring: e.target.checked })} />
                <label style={{ fontSize: 13, color: 'var(--text)' }}>Recurring add-back (normalized sustainable)</label>
              </div>

              {addBacks.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {addBacks.map((ab) => (
                    <div key={ab.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: ab.recurring ? '#22c55e' : '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, minWidth: 48 }}>{ab.year}</span>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ab.description}>{ab.description}</span>
                      <span style={{ fontWeight: 700, color: ab.recurring ? '#22c55e' : '#64748b' }}>+{fmt$K(ab.amount)}</span>
                      <button onClick={() => toggleRecurring(ab.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }} title="Toggle recurring">🔁</button>
                      <button onClick={() => removeAddBack(ab.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT: multi-year financials */}
        <Card>
          <CardHeader
            title="Step 3 · Historical Financials"
            subtitle="Enter up to 5 years of as-reported figures (P&L)"
            right={
              <button className="btn btn-ghost" onClick={addYear} style={{ padding: '6px 12px', fontSize: 12 }}>+ Add Year</button>
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px 20px' }}>
            {years.map((y, idx) => (
              <div key={idx} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="input" value={y.label} onChange={(e) => setYear(idx, 'label', e.target.value)} style={{ width: 110, fontWeight: 700, color: 'var(--navy)' }} />
                    {idx === 0 && <Badge color="#3b82f6">Latest</Badge>}
                  </div>
                  {years.length > 1 && <button className="btn btn-danger" onClick={() => removeYear(idx)} style={{ padding: '4px 8px' }}>✕</button>}
                </div>
                <div className="grid-4" style={{ gap: 8 }}>
                  <input className="input" placeholder="Revenue" value={y.grossRevenue} onChange={(e) => setYear(idx, 'grossRevenue', e.target.value)} />
                  <input className="input" placeholder="COGS" value={y.cogs} onChange={(e) => setYear(idx, 'cogs', e.target.value)} />
                  <input className="input" placeholder="Op. Expenses" value={y.operatingExpenses} onChange={(e) => setYear(idx, 'operatingExpenses', e.target.value)} />
                  <input className="input" placeholder="Owner Comp" value={y.ownerComp} onChange={(e) => setYear(idx, 'ownerComp', e.target.value)} />
                  <input className="input" placeholder="Depreciation" value={y.depreciation} onChange={(e) => setYear(idx, 'depreciation', e.target.value)} />
                  <input className="input" placeholder="Interest" value={y.interest} onChange={(e) => setYear(idx, 'interest', e.target.value)} />
                  <input className="input" placeholder="Other Exp" value={y.otherExpenses} onChange={(e) => setYear(idx, 'otherExpenses', e.target.value)} />
                  <input className="input" placeholder="Net Income (opt)" value={y.netIncome} onChange={(e) => setYear(idx, 'netIncome', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {showReport && result && (
        <RecastReport result={result} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
