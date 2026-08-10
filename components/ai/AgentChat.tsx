'use client'

// =============================================================================
// AgentChat — a self-contained chat console for a single AI agent. Used by the
// /dashboard/agents hub page. Talks to the server-only endpoint POST /api/ai/chat.
//
// Styling follows the app's inline-style design system (navy + gold). Tailwind
// is not configured in this repo, so we use style objects.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import type { AgentKind } from '@/types/ai'
import { authedFetch } from '@/lib/apiFetch'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatResult {
  reply: string
  data?: Record<string, unknown> | null
}

const AGENT_LABEL: Record<AgentKind, string> = {
  lead: 'Lead Agent',
  training: 'Training Agent',
  document: 'Document Agent',
  support: 'Support Agent',
}

let counter = 0
const uid = () => `a${Date.now()}-${counter++}`

export default function AgentChat({
  agent,
  starter,
}: {
  agent: AgentKind
  starter?: string
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function send(text?: string) {
    const trimmed = (text ?? input).trim()
    if (!trimmed || loading) return
    const userMsg: Msg = { id: uid(), role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const res = await authedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          message: trimmed,
          history: next
            .map((m) => ({ role: m.role, content: m.content }))
            .slice(-12),
        }),
      })
      const payload = (await res.json().catch(() => null)) as
        | (ChatResult & { ok?: boolean; error?: string; code?: string })
        | null

      if (!res.ok || !payload?.ok) {
        setError(mapError(payload?.code, res.status, payload?.error))
        setLoading(false)
        return
      }
      setMessages((m) => [...m, { id: uid(), role: 'assistant', content: payload.reply }])
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function mapError(code: string | undefined, status: number, detail?: string) {
    switch (code) {
      case 'AI_NOT_CONFIGURED':
        return 'AI is not configured yet. Add ANTHROPIC_API_KEY to enable agents.'
      case 'AI_CALL_FAILED':
        return 'The AI service hit an error. Please try again in a moment.'
      case 'CONTEXT_FAILED':
        return 'Could not load data for that agent. Please try again.'
      default:
        if (status === 422) return `Invalid request: ${detail || 'check your input.'}`
        return detail || 'Something went wrong. Please try again.'
    }
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--paper)' }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          height: 320,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {starter
                ? `Tip: try “${starter}”`
                : `Ask ${AGENT_LABEL[agent]} anything.`}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '88%',
                padding: '9px 13px',
                borderRadius: 11,
                borderBottomRightRadius: m.role === 'user' ? 3 : 11,
                borderBottomLeftRadius: m.role === 'assistant' ? 3 : 11,
                background: m.role === 'user' ? 'var(--navy)' : 'var(--cream)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                border: m.role === 'assistant' ? '1px solid var(--line)' : 'none',
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', animation: 'chatBounce 1.2s infinite' }} />
            Thinking…
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin: '0 12px 8px',
            padding: '8px 10px',
            borderRadius: 8,
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: 12.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 10, borderTop: '1px solid var(--line)', background: 'var(--cream)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={`Message ${AGENT_LABEL[agent]}…`}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              fontSize: 14,
              fontFamily: 'inherit',
              background: '#fff',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-light), var(--gold))',
              color: 'var(--navy)',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
