// =============================================================================
// AI type definitions — shared across the Claude client, prompt builders,
// context loaders, and any future agent/chat UI.
// =============================================================================

/** The AI agents the platform exposes to brokers. */
export type AgentKind = 'lead' | 'training' | 'document' | 'support'

/** A single user/assistant message in a conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Identifies the entity a conversation is scoped to (e.g. a listing). */
export interface AgentContextRef {
  kind: AgentKind
  /** Listing / deal / lesson / document id the conversation is about. */
  entityId?: string
  /** Free-form scoping hint (e.g. "recast project id"). */
  scope?: string
}

/** A coherent context bundle handed to the model for one turn. */
export interface AgentContextPayload {
  kind: AgentKind
  entityId?: string
  /** Concatenated factual context compiled by the context loader. */
  text: string
  /** Optional structured summaries keyed by domain. */
  facts?: Record<string, unknown>
}

/** Outcome of a single model call. */
export interface AgentResult {
  text: string
  /** Structured JSON the model returned, when requested. */
  data?: Record<string, unknown>
  /** Token usage, when surfaced by the SDK. */
  usage?: { input: number; output: number }
  error?: string
}

/** Model identifiers we default to. Kept narrow for typing + cost control. */
export const CLAUDE_MODELS = {
  /** Default for most agent turns. Current non-deprecated Sonnet release. */
  fast: 'claude-sonnet-4-5',
  /** Larger context / reasoning for document & recast analysis. */
  flagship: 'claude-sonnet-4-5',
} as const

export type ClaudeModelName = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]
