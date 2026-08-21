'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import AppShell from '@/components/layout/AppShell'
import {
  SOCIAL_PLATFORMS,
  fetchPosts,
  postNow,
  type SocialPost,
  type SocialPlatform,
} from '@/lib/services/social'
import { Card, CardHeader, Badge, LoadingState, EmptyState } from '@/components/ui'
import PrepareSocialPost from '@/components/social/PrepareSocialPost'

const DEV_AGENT_ID = '00000000-0000-0000-0000-000000000000'

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  scheduled: '#0ea5e9',
  posted: '#22c55e',
  failed: '#ef4444',
}

export default function SocialDashboardPage() {
  return (
    <AppShell active="Social">
      <SocialDashboard />
    </AppShell>
  )
}

function SocialDashboard() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<'all' | SocialPlatform>('all')
  const [status, setStatus] = useState<'all' | string>('all')
  const [postingId, setPostingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)

  const load = useCallback(async (uid: string) => {
    try {
      const rows = await fetchPosts({ agentId: uid })
      setPosts(rows)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id || DEV_AGENT_ID
      setAgentId(uid)
      await load(uid)
    })()
  }, [load])

  const filtered = posts.filter((p) => {
    if (platform !== 'all' && p.platform !== platform) return false
    if (status !== 'all' && p.status !== status) return false
    return true
  })

  const handleManualPost = async (post: SocialPost) => {
    setError(null)
    setPostingId(post.id)
    try {
      const updated = await postNow(post)
      setPosts((list) => list.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPostingId(null)
    }
  }

  const counts = { total: posts.length, posted: posts.filter(p => p.status === 'posted').length, pending: posts.filter(p => p.status === 'pending').length, failed: posts.filter(p => p.status === 'failed').length }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Social Media</h1>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Auto-posts, engagement, and manual publishing.</p>
        </div>
      </div>

      <PrepareSocialPost />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
        <Card style={{ padding: '14px 18px' }}><div style={{ fontSize: 12, color: 'var(--muted)' }}>Total</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{counts.total}</div></Card>
        <Card style={{ padding: '14px 18px', borderLeft: '4px solid #22c55e' }}><div style={{ fontSize: 12, color: 'var(--muted)' }}>Posted</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{counts.posted}</div></Card>
        <Card style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b' }}><div style={{ fontSize: 12, color: 'var(--muted)' }}>Pending</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{counts.pending}</div></Card>
        <Card style={{ padding: '14px 18px', borderLeft: '4px solid #ef4444' }}><div style={{ fontSize: 12, color: 'var(--muted)' }}>Failed</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{counts.failed}</div></Card>
      </div>

      {/* Filters */}
      <Card style={{ padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Platform:</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6 }}>
            <option value="all">All platforms</option>
            {SOCIAL_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>Status:</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6 }}>
            <option value="all">All statuses</option>
            {['pending', 'scheduled', 'posted', 'failed'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {error && <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fdecea', color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <LoadingState label="Loading posts…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📣" title="No social posts yet" subtitle="Posts are created automatically when you upload a listing with connect platforms, or manually here." />
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {filtered.map((post) => {
            const platformMeta = SOCIAL_PLATFORMS.find((p) => p.id === post.platform)
            return (
              <Card key={post.id} style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16 }}>{platformMeta?.icon}</span>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>{platformMeta?.label || post.platform}</span>
                      <Badge color={STATUS_COLOR[post.status]}>{post.status}</Badge>
                      {post.post_url && (
                        <a href={post.post_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--gold)' }}>View post ↗</a>
                      )}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{post.content}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                      Created {post.created_at ? new Date(post.created_at).toLocaleString() : '—'}
                      {post.posted_at ? ` · Posted ${new Date(post.posted_at).toLocaleString()}` : ''}
                      {post.scheduled_for ? ` · Scheduled ${new Date(post.scheduled_for).toLocaleString()}` : ''}
                    </div>
                    {post.error && <div style={{ marginTop: 6, fontSize: 12.5, color: '#b91c1c' }}>⚠ {post.error}</div>}
                  </div>
                  {/* Engagement + actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    {(post.status === 'posted') && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                        👍 {post.engagement_likes} · 💬 {post.engagement_comments} · 🔄 {post.engagement_shares}
                      </div>
                    )}
                    {(post.status === 'pending' || post.status === 'failed') && (
                      <button className="btn btn-primary" disabled={postingId === post.id} onClick={() => handleManualPost(post)} style={{ minWidth: 110 }}>
                        {postingId === post.id ? 'Posting…' : 'Post now'}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
