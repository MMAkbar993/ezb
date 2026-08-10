// =============================================================================
// Claude client — thin factory around the official Anthropic SDK.
//
// IMPORTANT:
//   * This module is SERVER-ONLY. It reads ANTHROPIC_API_KEY from the server
//     environment. Never import it from a client component — route all AI calls
//     through an API route (/api/ai/*) so the key never ships to the browser.
//   * The SDK client is created lazily and memoized; keys are read at first use
//     so hot-reload and late .env wiring both work.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk'
import { type AgentContextPayload, type ClaudeModelName } from '@/types/ai'

/**
 * Default Claude model for agent turns.
 * Uses a current, non-deprecated Sonnet release (claude-sonnet-4-5) that is
 * available on default Anthropic billing. The previously-pinned 3.5 checkpoint
 * (claude-3-5-sonnet-20241022) returns HTTP 404 not_found_error as the 3.5
 * generation is near end-of-life.
 */
const DEFAULT_MODEL = 'claude-sonnet-4-5' as const

/** Thrown when ANTHROPIC_API_KEY is missing or misconfigured. */
export class ClaudeConfigError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local (server-side only) to enable AI agents.',
    )
    this.name = 'ClaudeConfigError'
  }
}

let cachedClient: Anthropic | null = null

/**
 * Returns a memoized Anthropic client, or throws ClaudeConfigError if the env
 * key is absent. Safe to call repeatedly.
 */
export function getClaudeClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new ClaudeConfigError()
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: key,
      // Optional: set a per-instance maxRetries / timeout here if needed.
      // maxRetries: 2,
    })
  }
  return cachedClient
}

/** True when the environment has a usable Anthropic API key. */
export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Internal normalized message type used by the SDK callers. We keep the SDK
 * import out of the shared types file (which stays dependency-light).
 */
export interface InternalMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Core completion helper. Runs a single context bundle + conversation through
 * Claude and returns the assistant reply (plus optional JSON).
 *
 * @param context   compiled context payload (facts for the model)
 * @param history   prior user/assistant turns
 * @param opts      model + token budget + JSON mode + max output tokens
 */
export async function complete({
  context,
  history = [],
  system,
  model = DEFAULT_MODEL,
  maxTokens = 1024,
  jsonMode = false,
}: {
  context: AgentContextPayload
  history?: InternalMessage[]
  system: string
  model?: ClaudeModelName
  maxTokens?: number
  jsonMode?: boolean
}): Promise<{ text: string; data?: Record<string, unknown>; usage?: { input: number; output: number } }> {
  const client = getClaudeClient()

  // Build the message list: context + history as user turns (conversational).
  const messages: Anthropic.MessageParam[] = [
    // The compiled facts are the first user turn.
    { role: 'user', content: `[Context]\n${context.text}` },
    // Prior conversation, clamped to a sane window (last 12 turns) to bound cost.
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    // The live question/instruction.
    { role: 'user', content: history.length ? history[history.length - 1].content : 'Continue.' },
  ]

  const fullSystem = [
    system,
    jsonMode
      ? 'Return ONLY a valid JSON object. Do not include markdown fences or prose outside the JSON.'
      : 'Respond concisely and directly in plain text.',
  ].join('\n\n')

  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: fullSystem,
    messages,
  })

  // Assemble the output text(s).
  const text = resp.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((b) => b.text)
    .join('\n')

  const usage =
    resp.usage && typeof resp.usage.input_tokens === 'number'
      ? { input: resp.usage.input_tokens, output: resp.usage.output_tokens }
      : undefined

  // Optional JSON extraction (lenient: strips code fences if the model wrapped).
  let data: Record<string, unknown> | undefined
  if (jsonMode) {
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
      data = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      // Leave data undefined; caller can fall back to raw text.
    }
  }

  return { text, data, usage }
}
