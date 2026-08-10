// =============================================================================
// Onboarding — types + Supabase data layer for the Agent Onboarding checklist
// =============================================================================

import { supabase } from '@/lib/supabase/client'

export interface OnboardingStep {
  id: string
  title: string
  description: string | null
  step_key: string
  icon: string | null
  order: number
  is_required: boolean
}

export interface OnboardingTask {
  id: string
  broker_id: string
  step_id: string
  completed: boolean
  completed_at: string | null
  progress: number
  // joined
  step?: OnboardingStep
}

export interface OnboardingSummary {
  steps: OnboardingStep[]
  tasks: OnboardingTask[]
  total: number
  completed: number
  requiredTotal: number
  requiredCompleted: number
  pct: number
}

export async function fetchOnboardingSteps(): Promise<OnboardingStep[]> {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .select('*')
    .order('order', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load onboarding steps')
  return (data as OnboardingStep[]) || []
}

export async function fetchOnboardingTasks(brokerId: string): Promise<OnboardingTask[]> {
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .select('*, onboarding_steps(*)')
    .eq('broker_id', brokerId)
  if (error) throw new Error(error.message || 'Failed to load onboarding tasks')
  const rows = (data || []) as Array<OnboardingTask & { onboarding_steps?: OnboardingStep | null }>
  return rows.map((r) => ({ ...r, step: r.onboarding_steps ?? undefined }))
}

// Load both + compute progress. Ensures a task row exists for every required step.
export async function fetchOnboardingSummary(brokerId: string): Promise<OnboardingSummary> {
  const [steps, tasks] = await Promise.all([fetchOnboardingSteps(), fetchOnboardingTasks(brokerId)])
  const existing = new Set(tasks.map((t) => t.step_id))
  // Create missing task rows for steps the broker hasn't started yet.
  const missing = steps.filter((s) => !existing.has(s.id))
  if (missing.length) {
    for (const s of missing) {
      await supabase
        .from('onboarding_tasks')
        .upsert({ broker_id: brokerId, step_id: s.id, completed: false, progress: 0 }, { onConflict: 'broker_id,step_id' })
        .select()
    }
  }
  const fresh = missing.length ? await fetchOnboardingTasks(brokerId) : tasks
  const latest = missing.length ? fresh : tasks
  const required = steps.filter((s) => s.is_required)
  const done = latest.filter((t) => t.completed).map((t) => t.step_id)
  const requiredDone = required.filter((s) => done.includes(s.id)).length
  const pct = required.length ? Math.round((requiredDone / required.length) * 100) : 100
  return {
    steps,
    tasks: latest,
    total: steps.length,
    completed: done.length,
    requiredTotal: required.length,
    requiredCompleted: requiredDone,
    pct,
  }
}

export async function upsertOnboardingTask(
  brokerId: string,
  stepId: string,
  opts: { completed?: boolean; progress?: number }
) {
  const completed = opts.completed ?? (opts.progress !== undefined ? opts.progress >= 100 : false)
  const progress = Math.max(0, Math.min(100, opts.progress ?? (completed ? 100 : 0)))
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .upsert({
      broker_id: brokerId,
      step_id: stepId,
      completed,
      progress,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'broker_id,step_id' })
    .select()
    .single()
  if (error) throw new Error(error.message || 'Failed to update onboarding')
  return data
}
