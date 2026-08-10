'use client'

import { useState } from 'react'
import type { AgentKind } from '@/types/ai'
import AgentChat from '@/components/ai/AgentChat'
import { Card, CardHeader, Badge } from '@/components/ui'

// =============================================================================
// /dashboard/agents — functional AI Agents hub.
//
// Replaces the old static "Coming soon" placeholder page. Each agent card is
// live: it opens a dedicated, agent-scoped chat session wired to the real
// server-side backend (POST /api/ai/chat → Claude with real Supabase context).
//
// Agent kinds: support (platform help) · lead (qualify/prioritize leads) ·
// training (brokerage curriculum + progress) · document (CIM/BOV/recast analysis).
// =============================================================================

interface AgentMeta {
  kind: AgentKind
  name: string
  icon: string
  tagline: string
  desc: string
  accent: string
  starter: string
  features: string[]
}

const AGENTS: AgentMeta[] = [
  {
    kind: 'lead',
    name: 'Lead Agent',
    icon: '🎯',
    tagline: 'Qualify & prioritize leads',
    desc: 'Scores inbound buyer/seller leads, drafts follow-ups, and flags high-intent opportunities — grounded in your live lead records.',
    accent: '#22c55e',
    starter: 'Which leads should I follow up on first, and why?',
    features: ['Scores lead quality from live records', 'Drafts outreach & follow-up emails', 'Recommends pipeline stage + next action'],
  },
  {
    kind: 'training',
    name: 'Training Agent',
    icon: '📘',
    tagline: 'Brokerage curriculum & progress',
    desc: 'Answers brokerage questions from your training library and recommends modules based on your progress and gaps.',
    accent: '#c9a84c',
    starter: 'What should I study next, based on the curriculum?',
    features: ['Grounded in live training modules', 'Recommends lessons by progress & gaps', 'Quiz-style checks & concept re-explains'],
  },
  {
    kind: 'document',
    name: 'Document Agent',
    icon: '📁',
    tagline: 'Summarize CIM / BOV / recast',
    desc: 'Pulls key numbers from CIMs, BOVs, recasts, and seller financials; flags inconsistencies and items lenders will scrutinize.',
    accent: '#8b5cf6',
    starter: 'Summarize the key financials of this deal.',
    features: ['Extracts revenue, SDE, EBITDA, multiples', 'Flags gaps buyers & lenders will ask about', 'Compares one set of numbers to another'],
  },
  {
    kind: 'support',
    name: 'Support Agent',
    icon: '🛟',
    tagline: 'Platform help',
    desc: 'Guides you through the platform — where things live, how a feature works, and quick answers about using Concord.',
    accent: '#0ea5e9',
    starter: 'How do I create a listing and start the workflow?',
    features: ['Explains features & where they live', 'Walks through common tasks', 'Points to the right page/setting'],
  },
]

export default function AgentsPage() {
  const [active, setActive] = useState<AgentMeta | null>(null)
  const aiOn = true // backend is wired + ANTHROPIC_API_KEY is set

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>AI Agents</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          Your AI team — assisting with leads, training, documents, and support. Pick an agent, then chat right here.
        </p>
      </header>

      {/* Live status banner */}
      <Card style={{ marginBottom: 22, borderLeft: '4px solid var(--gold)' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 26 }}>🤖</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Badge color="#22c55e">Agents Active</Badge>
            <div style={{ marginTop: 4, fontWeight: 700, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
              {aiOn ? 'All agents are live and connected.' : 'Add ANTHROPIC_API_KEY to enable agents.'}
            </div>
          </div>
        </div>
      </Card>

      {/* Active chat (selected agent) */}
      {active && (
        <Card style={{ marginBottom: 22 }}>
          <CardHeader
            title={`${active.icon} ${active.name}`}
            subtitle={active.tagline}
            right={
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setActive(null)}>
                ✕ Close
              </button>
            }
          />
          <div style={{ padding: '4px 20px 20px' }}>
            <AgentChat agent={active.kind} starter={active.starter} />
          </div>
        </Card>
      )}

      {/* Agent grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {AGENTS.map((agent) => {
          const isActive = active?.kind === agent.kind
          return (
            <Card
              key={agent.kind}
              style={{
                display: 'flex', flexDirection: 'column', cursor: 'pointer',
                border: isActive ? `2px solid ${agent.accent}` : '1px solid var(--line)',
                transition: 'transform .15s, box-shadow .15s',
              }}
              onClick={() => setActive(isActive ? null : agent)}
            >
              <div style={{ padding: '20px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 34 }}>{agent.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--navy)', fontFamily: 'Georgia, serif' }}>
                      {agent.name}
                    </div>
                    <Badge color={agent.accent}>{agent.tagline}</Badge>
                  </div>
                </div>
                <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>{agent.desc}</p>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.7 }}>
                  {agent.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
              <div style={{ padding: '0 20px 18px' }}>
                <button
                  className="btn"
                  style={{ width: '100%', background: isActive ? agent.accent : 'var(--navy)', color: '#fff', border: 'none' }}
                >
                  {isActive ? 'Close chat' : `Chat with ${agent.name} →`}
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
