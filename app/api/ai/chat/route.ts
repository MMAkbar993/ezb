import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateServerInput } from '@cosmstack/blackshield/server'
import { buildAgentContext } from '@/lib/claude/context'
import { complete, isClaudeConfigured, ClaudeConfigError } from '@/lib/claude/client'
import { buildSystemPrompt } from '@/lib/claude/prompts'
import { CLAUDE_MODELS, type AgentKind, type ClaudeModelName } from '@/types/ai'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// =============================================================================
// POST /api/ai/chat
//
// Broker → AI agent chat. The route is SERVER-ONLY: it loads real deal/training
// context from Supabase, calls Claude with the ANTHROPIC_API_KEY, and returns a
// structured response. The browser never sees the API key.
//
// Request body:
//   {
//     "agent":    "lead" | "training" | "document" | "support",
//     "message":  "the broker's prompt",
//     "entityId": optional — scopes doc/lead agents to a listing/entity,
//     "history":  optional — prior [{role:"user"|"assistant",content}] turns,
//     "json":     optional — request a structured JSON reply for the lead agent
//   }
//
// Security:
//   * Input validated against a Zod schema (bounded length, strict enum).
//   * Payload size capped before parsing.
//   * History clamped to a safe window.
//   * Errors returned as structured JSON, never leaking the API key or stack.
// =============================================================================

const MAX_BODY_BYTES = 32 * 1024 // 32 KB cap
const MAX_HISTORY = 12 // max prior turns we honor
const MAX_MESSAGE_LEN = 4000

const agentKindSchema = z.enum(['lead', 'training', 'document', 'support'])

const chatRequestSchema = z.object({
  agent: agentKindSchema,
  message: z.string().min(1).max(MAX_MESSAGE_LEN),
  entityId: z.string().max(80).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_MESSAGE_LEN),
      }),
    )
    .max(MAX_HISTORY)
    .optional(),
  json: z.boolean().optional(),
})

function ok(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

function fail(message: string, status = 400, extra: object = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

export async function POST(req: NextRequest) {
  // -------------------------------------------------------------------------
  // 0a) Auth gate — this route loads real lead/listing/document data into the
  //     Claude prompt and returns the model's reply verbatim, so it must only
  //     run for a signed-in broker.
  // -------------------------------------------------------------------------
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  // -------------------------------------------------------------------------
  // 0b) Feature availability — fail fast with a clear, non-leaky message.
  // -------------------------------------------------------------------------
  if (!isClaudeConfigured()) {
    return fail(
      'AI is not configured yet. Add ANTHROPIC_API_KEY to the server environment to enable agents.',
      503,
      { code: 'AI_NOT_CONFIGURED' },
    )
  }

  // -------------------------------------------------------------------------
  // 1) Bounded body + JSON parse
  // -------------------------------------------------------------------------
  const raw = await req.text().catch(() => '')
  if (!raw) return fail('Empty request body.', 400)
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return fail('Request too large.', 413)
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return fail('Invalid JSON.', 400)
  }

  // -------------------------------------------------------------------------
  // 2) Validate against the Zod contract (blackshield server validator)
  // -------------------------------------------------------------------------
  const validation = validateServerInput(chatRequestSchema, body)
  if (!validation.isValid) {
    const first = Object.values(validation.errors)[0]?.[0]
    return fail('Validation failed.', 422, { detail: first })
  }
  const { agent, message, entityId, history, json } = body as z.infer<
    typeof chatRequestSchema
  >

  // -------------------------------------------------------------------------
  // 3) Load relevant domain context from Supabase (server-side, condensed)
  // -------------------------------------------------------------------------
  let context
  try {
    context = await buildAgentContext({ kind: agent, entityId })
  } catch (err) {
    console.error('[ai/chat] context load failed:', (err as Error)?.message)
    return fail('Failed to load context for this agent.', 500, {
      code: 'CONTEXT_FAILED',
    })
  }

  // -------------------------------------------------------------------------
  // 4) Pick the model + system prompt, then call Claude.
  // -------------------------------------------------------------------------
  // Document analysis and lead scoring benefit from the larger model; the rest
  // run fast/cheap on haiku. json mode forces the lead agent to output score JSON.
  //
  // Legal-compliance: the DOCUMENT and TRAINING agents regularly touch real-estate
  // transfers, licensed-activity disclosures, and drafted legal language, so they
  // get the state-aware legal guardrail auto-appended. Lead/support stay lean.
  const model: ClaudeModelName =
    agent === 'document' ? CLAUDE_MODELS.flagship : CLAUDE_MODELS.fast

  const legal = agent === 'document' || agent === 'training'
  const system = buildSystemPrompt(agent, { legal })

  // Normalize history into the client's expected (user/assistant) shape,
  // appended after the message as the live instruction.
  const turns = (history || []).map((h) => ({ role: h.role, content: h.content }))

  try {
    const result = await complete({
      context,
      history: turns,
      system,
      model,
      jsonMode: Boolean(json) || agent === 'lead',
      maxTokens: agent === 'document' ? 2048 : 1024,
    })

    return ok({
      ok: true,
      agent,
      reply: result.text,
      data: result.data ?? null,
      usage: result.usage ?? null,
    })
  } catch (err) {
    // ClaudeConfigError (key removed mid-flight) and SDK/network errors
    if (err instanceof ClaudeConfigError) {
      return fail('AI is not configured.', 503, { code: 'AI_NOT_CONFIGURED' })
    }
    const msg = (err as Error)?.message || 'Unknown AI error'
    // Log the underlying cause server-side only; never surface to the client.
    console.error('[ai/chat] Claude call failed:', msg)
    return fail('The AI service returned an error. Please try again.', 502, {
      code: 'AI_CALL_FAILED',
    })
  }
}
