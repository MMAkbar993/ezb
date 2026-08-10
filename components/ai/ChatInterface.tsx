'use client'

import { useEffect, useRef, useState } from 'react'
import type { AgentKind, ChatMessage } from '@/types/ai'
import { authedFetch } from '@/lib/apiFetch'

// =============================================================================
// ChatInterface — floating AI assistant bubble (bottom-right) for the Concord
// Deal Platform.
//
// Ships as 'use client' and talks to the server-only endpoint POST /api/ai/chat.
//
// NOTE ON STYLING: This component uses the app's established inline-style
// design system (navy + gold), NOT Tailwind utility classes. Tailwind is not
// installed/configured in this repo (the @tailwind directives in globals.css
// are inert), so utility classes would render unstyled. The className props
// below are present for future Tailwind adoption but styling is via style
// objects that match the rest of the app and the DESIGN_SYSTEM.md.
// =============================================================================

interface ChatMessageUI extends ChatMessage {
  id: string
  timestamp: number
}

interface ChatResult {
  reply: string
  data?: Record<string, unknown> | null
}

const AGENTS: { kind: AgentKind; label: string; icon: string; hint: string }[] = [
  { kind: 'support', label: 'Support', icon: '🛟', hint: 'Platform help' },
  { kind: 'lead', label: 'Lead', icon: '🎯', hint: 'Qualify & prioritize leads' },
  { kind: 'training', label: 'Training', icon: '📘', hint: 'Brokerage curriculum' },
  { kind: 'document', label: 'Document', icon: '📁', hint: 'Summarize CIM/BOV/recast' },
]

const AGENT_LABEL: Record<AgentKind, string> = {
  lead: 'Lead Agent',
  training: 'Training Agent',
  document: 'Document Agent',
  support: 'Support Agent',
}

let counter = 0
const uid = () => `m${Date.now()}-${counter++}`

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatInterface({ defaultAgent = 'support' }: { defaultAgent?: AgentKind }) {
  const [open, setOpen] = useState(false)
  const [agent, setAgent] = useState<AgentKind>(defaultAgent)
  const [messages, setMessages] = useState<ChatMessageUI[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Autoscroll to the latest message whenever the list changes.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  async function send(text?: string) {
    const trimmed = (text ?? input).trim()
    if (!trimmed || loading) return

    // Optimistically append the user message.
    const userMsg: ChatMessageUI = { id: uid(), role: 'user', content: trimmed, timestamp: Date.now() }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
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
          // Send prior turns (user/assistant only) for conversation continuity.
          history: nextHistory.slice(-12),
        }),
      })

      const payload = (await res.json().catch(() => null)) as (ChatResult & { ok?: boolean; error?: string; code?: string }) | null

      if (!res.ok || !payload?.ok) {
        const friendly = mapError(payload?.code, res.status, payload?.error)
        setError(friendly)
        setLoading(false)
        return
      }

      const assistantMsg: ChatMessageUI = {
        id: uid(),
        role: 'assistant',
        content: payload.reply,
        timestamp: Date.now(),
      }
      setMessages((m) => [...m, assistantMsg])
    } catch (err) {
      // Network / fetch failure
      console.error('[chat] request failed:', err)
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
        if (status === 422) return `Invalid request: ${detail || 'please check your input.'}`
        return detail || 'Something went wrong. Please try again.'
    }
  }

  function handleEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function switchAgent(kind: AgentKind) {
    setAgent(kind)
    setError(null)
  }

  // -------------------------------------------------------------------------
  // Floating bubble (closed state)
  // -------------------------------------------------------------------------
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--gold-light), var(--gold))',
          color: 'var(--navy)',
          fontSize: 28,
          boxShadow: '0 6px 18px rgba(201,168,76,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform .15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        🤖
      </button>
    )
  }

  // -------------------------------------------------------------------------
  // Open chat panel
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        height: 520,
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        boxShadow: '0 12px 40px rgba(26,26,46,0.28)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%)',
          color: '#fff',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'Georgia, serif' }}>CONCORD AI</div>
            <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>{AGENT_LABEL[agent]}</div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          style={{
            background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
            fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Agent selector */}
      <div
        style={{
          padding: 10,
          borderBottom: '1px solid var(--line)',
          background: 'var(--cream)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {AGENTS.map((a) => {
            const active = a.kind === agent
            return (
              <button
                key={a.kind}
                onClick={() => switchAgent(a.kind)}
                title={a.hint}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                  border: active ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                  background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: active ? 'var(--navy)' : 'var(--muted)',
                  fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: active ? 700 : 500,
                }}
              >
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                {a.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 14px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--paper)',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>👋</div>
            Ask me anything — like “which leads should I follow up first?”
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-dark)' }}>
              (Switch agents above for leads, training, documents, or support.)
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
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                borderBottomLeftRadius: m.role === 'assistant' ? 2 : 12,
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
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3, padding: '0 2px' }}>
              {fmtTime(m.timestamp)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div
              style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                borderBottomLeftRadius: 2, background: 'var(--cream)',
                border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13.5,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <TypingDots />
              <span>Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            margin: '0 12px 8px', padding: '8px 10px', borderRadius: 8,
            background: '#fee2e2', color: '#b91c1c', fontSize: 12.5,
            border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            style={{ background: 'transparent', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--line)', background: 'var(--cream)' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 6px 6px 16px',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleEnter}
            placeholder={`Message ${AGENT_LABEL[agent]}…`}
            disabled={loading}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14,
              background: 'transparent', color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            style={{
              width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-light), var(--gold))',
              color: 'var(--navy)', border: 'none', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            ➤
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
          Enter to send · AI may be imprecise — verify critical facts.
        </div>
      </div>
    </div>
  )
}

/** Simple animated typing indicator. */
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)',
            display: 'inline-block',
            animation: 'chatBounce 1.2s infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}
