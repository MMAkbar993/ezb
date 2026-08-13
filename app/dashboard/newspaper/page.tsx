'use client'

// ---------------------------------------------------------------------------
// /dashboard/newspaper — Weekly Newspaper System admin dashboard.
// Editions list + editor (auto-generated articles, hand-editable), preview,
// publish & email to subscribers, subscriber management, delivery log.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  fetchEditions, createEdition, updateEdition, publishEdition, deleteEdition,
  fetchArticles, upsertArticle, deleteArticle, autoGenerateArticles,
  fetchSubscriptions, addSubscription, removeSubscription, fetchDeliveryLog,
  renderNewspaperHtml, nowLabel, SECTIONS,
  type NewEdition, type Article, type Subscription,
} from '@/lib/newspaper'
import { Card, CardHeader, LoadingState } from '@/components/ui'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { authedFetch } from '@/lib/apiFetch'

export default function NewspaperPage() {
  return (
    <AppShell active="Weekly Newspaper">
      <ToastProvider>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <NewspaperDashboard />
        </div>
      </ToastProvider>
    </AppShell>
  )
}

function NewspaperDashboard() {
  const toast = useToast()
  const [editions, setEditions] = useState<NewEdition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [delivery, setDelivery] = useState<any[]>([])
  const [tab, setTab] = useState<'editor' | 'preview' | 'subscribers' | 'delivery'>('editor')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('Concord Weekly')
  const [issueLabel, setIssueLabel] = useState(nowLabel())
  const [summary, setSummary] = useState('')
  const [subEmail, setSubEmail] = useState('')
  const [subName, setSubName] = useState('')

  const load = useCallback(async () => {
    const list = await fetchEditions()
    setEditions(list)
    if (list.length && !selectedId) { setSelectedId(list[0].id); setTitle(list[0].title); setIssueLabel(list[0].issue_label || ''); setSummary(list[0].summary || '') }
    setLoading(false)
  }, [selectedId])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selectedId) { fetchArticles(selectedId).then(setArticles); fetchDeliveryLog(selectedId).then(setDelivery) } }, [selectedId])
  useEffect(() => { fetchSubscriptions().then(setSubs) }, [])

  const pickEdition = (eid: string) => {
    setSelectedId(eid)
    const e = editions.find((x) => x.id === eid)
    if (e) { setTitle(e.title); setIssueLabel(e.issue_label || ''); setSummary(e.summary || '') }
    setTab('editor')
  }

  const handleCreate = async () => {
    setBusy(true)
    const id = await createEdition()
    setBusy(false)
    if (id) { toast('Edition created & auto-generated'); await load(); setSelectedId(id); setTab('editor'); fetchArticles(id).then(setArticles) }
    else toast('Could not create edition (run sql/newspaper_schema.sql)', 'error')
  }

  const handleSaveMeta = async () => {
    if (!selectedId) return
    const ok = await updateEdition(selectedId, { title, issue_label: issueLabel, summary })
    toast(ok ? 'Edition details saved' : 'Save failed', ok ? 'success' : 'error')
  }

  const handlePublish = async () => {
    if (!selectedId) return
    setBusy(true)
    const ok = await publishEdition(selectedId)
    setBusy(false)
    if (ok) { toast('Edition published'); load() } else toast('Publish failed', 'error')
  }

  const handleDistribute = async () => {
    if (!selectedId) return
    setBusy(true)
    try {
      const res = await authedFetch('/api/newspaper/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editionId: selectedId }) })
      const json = await res.json()
      if (res.ok) toast(`Queued for ${json.sent} subscriber(s)` + (json.failed ? `, ${json.failed} failed` : ''), 'success')
      else toast(json.error || 'Distribute failed', 'error')
    } catch { toast('Distribute failed', 'error') }
    setBusy(false)
  }

  const saveArticle = async (a: Partial<Article>) => { if (await upsertArticle(a)) { toast('Article saved'); if (selectedId) fetchArticles(selectedId).then(setArticles) } else toast('Article save failed — run schema', 'error') }

  const selected = editions.find((e) => e.id === selectedId) || null

  if (loading) return <LoadingState label="Loading newspaper…" />

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 26, color: 'var(--navy)', margin: 0 }}>Weekly Newspaper</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 14 }}>Auto-generate, edit, and email your weekly market digest to subscribers.</p>
        </div>
        <button onClick={handleCreate} disabled={busy} style={{ padding: '11px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {busy ? 'Working…' : '+ New edition'}
        </button>
      </header>

      <div className="grid-responsive collapse-md" style={{ '--grid-cols': '260px 1fr', '--grid-gap': '20px', alignItems: 'start' } as React.CSSProperties}>
        {/* Editions list */}
        <Card>
          <CardHeader title="Editions" subtitle={`${editions.length} total`} />
          <div style={{ padding: 8 }}>
            {editions.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--muted)', fontSize: 13 }}>No editions yet. Create one to auto-generate this week's digest.</div>
            ) : (
              editions.map((e) => (
                <button key={e.id} onClick={() => pickEdition(e.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: e.id === selectedId ? 'rgba(201,168,76,0.15)' : 'transparent', cursor: 'pointer', marginBottom: 3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.issue_label || e.edition_date}</div>
                  <div style={{ fontSize: 11, color: e.status === 'published' ? '#16a34a' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase', marginTop: 3 }}>{e.status}</div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Main panel */}
        {!selected ? (
          <Card><div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Select or create an edition to begin.</div></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Meta */}
            <Card>
              <div className="grid-2" style={{ padding: 16, gap: 12 }}>
                <label style={lbl}>Title <input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} /></label>
                <label style={lbl}>Issue <input value={issueLabel} onChange={(e) => setIssueLabel(e.target.value)} style={inp} /></label>
                <label style={{ ...lbl, gridColumn: '1 / -1' }}>Editor's summary <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line editorial note (optional)" style={inp} /></label>
              </div>
              <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={handleSaveMeta} style={navBtn('var(--navy)')}>Save details</button>
                <button onClick={async () => { if (selectedId) { await autoGenerateArticles(selectedId); fetchArticles(selectedId).then(setArticles); toast('Regenerated from live data', 'success') } }} style={navBtn('var(--gold)')}>↻ Regenerate</button>
                {selected.status !== 'published' ? (
                  <button onClick={handlePublish} disabled={busy} style={navBtn('#16a34a')}>{busy ? 'Working…' : 'Publish'}</button>
                ) : (
                  <button onClick={handleDistribute} disabled={busy} style={navBtn('#16a34a')}>{busy ? 'Sending…' : '📮 Email subscribers'}</button>
                )}
                <button onClick={async () => { if (selectedId && confirm('Delete this edition?')) { await deleteEdition(selectedId); toast('Edition deleted'); setSelectedId(null); load() } }} style={{ ...navBtn('#dc2626'), marginLeft: 'auto' }}>Delete</button>
              </div>
            </Card>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['editor', 'preview', 'subscribers', 'delivery'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{cap(t)}</button>
              ))}
            </div>

            {tab === 'editor' && <ArticlesEditor articles={articles} onSave={saveArticle} onDelete={async (id) => { await deleteArticle(id); if (selectedId) fetchArticles(selectedId).then(setArticles) }} onAdd={() => saveArticle({ edition_id: selectedId || '', section: SECTIONS[0], headline: 'New article', body: 'Write something…', sort_order: Math.max(0, ...articles.map((a) => a.sort_order || 0)) + 10 })} />}

            {tab === 'preview' && <PreviewPanel edition={selected} articles={articles} />}

            {tab === 'subscribers' && (
              <Card>
                <CardHeader title="Subscribers" subtitle={`${subs.filter((s) => s.status === 'active').length} active`} />
                <div style={{ padding: 16, display: 'flex', gap: 10 }}>
                  <input value={subEmail} onChange={(e) => setSubEmail(e.target.value)} placeholder="Subscriber email" style={{ ...inp, flex: 1 }} />
                  <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Name (optional)" style={{ ...inp, flex: 1 }} />
                  <button onClick={async () => { const ok = await addSubscription(subEmail, subName); if (ok) { toast('Subscriber added'); setSubEmail(''); setSubName(''); fetchSubscriptions().then(setSubs) } else toast('Add failed', 'error') }} style={navBtn('var(--navy)')}>Add</button>
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                  {subs.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No subscribers yet.</p> : (
                    subs.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '1px solid var(--line)' }}>
                        <span style={{ fontSize: 16 }}>{s.status === 'unsubscribed' ? '🚫' : '📧'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.name || s.email}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.email} · <em>{s.status}</em></div>
                        </div>
                        <button onClick={async () => { await removeSubscription(s.id); fetchSubscriptions().then(setSubs); toast('Subscriber removed') }} style={navBtn('#dc2626')}>Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}

            {tab === 'delivery' && (
              <Card>
                <CardHeader title="Delivery log" subtitle={`${delivery.length} records`} />
                <div style={{ padding: 12 }}>
                  {delivery.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No deliveries recorded for this edition yet. Publish then click “Email subscribers”.</p> : (
                    delivery.map((d) => (
                      <div key={d.id} style={{ display: 'flex', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                        <span style={{ color: d.status === 'sent' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{d.status}</span>
                        <span style={{ color: 'var(--ink)' }}>{d.email}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// -- Articles editor ----------------------------------------------------------
function ArticlesEditor({ articles, onSave, onDelete, onAdd }: { articles: Article[]; onSave: (a: Partial<Article>) => void; onDelete: (id: string) => void; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={onAdd} style={{ alignSelf: 'flex-start', padding: '9px 16px', background: 'transparent', color: 'var(--navy)', border: '1px solid var(--gold)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13.5 }}>+ Add article</button>
      {articles.length === 0 && <Card><div style={{ padding: 30, color: 'var(--muted)', textAlign: 'center' }}>No articles. Click “+ Add article” or “↻ Regenerate” to pull from live data.</div></Card>}
      {articles.map((a) => (
        <ArticleRow key={a.id} article={a} onSave={onSave} onDelete={onDelete} />
      ))}
    </div>
  )
}

function ArticleRow({ article, onSave, onDelete }: { article: Article; onSave: (a: Partial<Article>) => void; onDelete: (id: string) => void }) {
  const [headline, setHeadline] = useState(article.headline || '')
  const [body, setBody] = useState(article.body || '')
  const [section, setSection] = useState(article.section)
  return (
    <Card>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={section} onChange={(e) => setSection(e.target.value)} style={{ ...inp, width: 180 }}>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" style={{ ...inp, flex: 1, fontWeight: 600 }} />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Article body — one item per line" rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onSave({ id: article.id, headline, body, section })} style={navBtn('var(--navy)')}>Save</button>
          <button onClick={() => onDelete(article.id)} style={navBtn('#dc2626')}>Delete</button>
        </div>
      </div>
    </Card>
  )
}

// -- Preview ------------------------------------------------------------------
function PreviewPanel({ edition, articles }: { edition: NewEdition; articles: Article[] }) {
  return (
    <Card>
      <CardHeader title="Email preview" subtitle="How subscribers will see this edition" />
      <div style={{ padding: 8, background: '#f4f3ef', borderRadius: 10 }}>
        <div dangerouslySetInnerHTML={{ __html: renderNewspaperHtml(edition, articles) }} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8 }} />
      </div>
    </Card>
  )
}

// -- styles -------------------------------------------------------------------
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }
const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13.5, fontFamily: 'inherit', background: '#fff', color: 'var(--ink)' }
const navBtn = (c: string): React.CSSProperties => ({ padding: '9px 16px', background: 'transparent', color: c, border: `1px solid ${c}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' })
const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1px solid ${active ? 'var(--navy)' : 'var(--line)'}`, background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--ink)', fontFamily: 'inherit' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
