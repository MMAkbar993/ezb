// =============================================================================
// Training Center — types + Supabase data layer
// =============================================================================

import { supabase } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/apiFetch'

// --- Types ---
export interface TrainingModule {
  id: string
  title: string
  description: string | null
  icon: string | null
  order: number
  is_published: boolean
  created_at?: string | null
  // joined/derived
  lessons?: TrainingLesson[]
  lesson_count?: number
  completed_count?: number
  progress_pct?: number
  certified?: boolean
}

export interface TrainingLesson {
  id: string
  module_id: string
  title: string
  content: string | null
  video_url: string | null
  pdf_url: string | null
  order: number
  duration_minutes: number
  is_published: boolean
  created_at?: string | null
  // derived
  completed?: boolean
  quiz_count?: number
}

export interface QuizQuestion {
  id: string
  lesson_id: string
  question: string
  options: string[]
  correct_answer: string
  created_at?: string | null
}

export interface TrainingProgress {
  id: string
  broker_id: string
  lesson_id: string
  completed: boolean
  completed_at: string | null
  rating: number | null
  created_at?: string | null
}

export interface TrainingCertificate {
  id: string
  broker_id: string
  module_id: string
  certificate_url: string | null
  issued_at: string | null
  verification_code?: string | null
  verified_at?: string | null
  template?: string
  certificate_key?: string | null
}

export interface TrainingUpload {
  id: string
  broker_id: string
  title: string
  file_url: string
  file_type: string
  module_id: string | null
  uploaded_at: string | null
}

// --- Modules + lessons ---
export async function fetchModules(): Promise<TrainingModule[]> {
  // Server-side route uses the service-role client to bypass RLS (training
  // content is `select to authenticated` only). Never hit the anon client here.
  const res = await authedFetch('/api/training')
  if (!res.ok) throw new Error('Failed to load training modules')
  const json = await res.json()
  return (json.modules as TrainingModule[]) || []
}

export async function fetchModule(id: string): Promise<TrainingModule | null> {
  const res = await authedFetch(`/api/training?id=${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const json = await res.json()
  return (json.modules?.[0] as TrainingModule) || null
}

export async function fetchLessons(moduleId: string): Promise<TrainingLesson[]> {
  const res = await authedFetch(`/api/training?module=${encodeURIComponent(moduleId)}&include=lessons`)
  if (!res.ok) return []
  const json = await res.json()
  const mod = json.modules?.[0]
  return (mod?.lessons as TrainingLesson[]) || []
}

export async function fetchLesson(id: string): Promise<TrainingLesson | null> {
  const res = await authedFetch(`/api/training?lesson=${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const json = await res.json()
  return (json.lesson as TrainingLesson) || null
}

export async function fetchQuiz(lessonId: string): Promise<QuizQuestion[]> {
  const res = await authedFetch(`/api/training?quiz=${encodeURIComponent(lessonId)}`)
  if (!res.ok) return []
  const json = await res.json()
  return (json.quizQuestions as QuizQuestion[]) || []
}

// --- Progress ---
// Read helpers return empty results on RLS/permission errors rather than
// throwing, so a stale/expired session never blanks out a training page.
export async function fetchProgress(brokerId: string): Promise<TrainingProgress[]> {
  const { data, error } = await supabase
    .from('training_progress')
    .select('*')
    .eq('broker_id', brokerId)
  if (error) {
    console.warn('fetchProgress failed (non-fatal):', error.message)
    return []
  }
  return (data as TrainingProgress[]) || []
}

export async function markLessonComplete(brokerId: string, lessonId: string, rating?: number) {
  const { data, error } = await supabase
    .from('training_progress')
    .upsert({
      broker_id: brokerId,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
      rating: rating ?? null,
    }, { onConflict: 'broker_id,lesson_id' })
    .select()
    .single()
  if (error) throw new Error(error.message || 'Failed to save progress')
  return data
}

// --- Certificates ---
export async function fetchCertificates(brokerId: string): Promise<TrainingCertificate[]> {
  const { data, error } = await supabase
    .from('training_certificates')
    .select('*')
    .eq('broker_id', brokerId)
  if (error) {
    console.warn('fetchCertificates failed (non-fatal):', error.message)
    return []
  }
  return (data as TrainingCertificate[]) || []
}

// Generate a short, human-readable verification code + a base64 payload for QR.
function makeVerificationPayload(brokerId: string, moduleId: string, issuedAt: string) {
  const code = Array.from({ length: 8 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('')
  const key = Buffer.from(
    JSON.stringify({ broker: brokerId, module: moduleId, issued: issuedAt, code })
  ).toString('base64')
  return { code, key }
}

export async function saveCertificate(brokerId: string, moduleId: string, certUrl?: string, template = 'gold') {
  const issuedAt = new Date().toISOString()
  const { code, key } = makeVerificationPayload(brokerId, moduleId, issuedAt)
  const { data, error } = await supabase
    .from('training_certificates')
    .upsert({
      broker_id: brokerId,
      module_id: moduleId,
      certificate_url: certUrl ?? null,
      issued_at: issuedAt,
      verification_code: code,
      certificate_key: key,
      template,
    }, { onConflict: 'broker_id,module_id' })
    .select()
    .single()
  if (error) throw new Error(error.message || 'Failed to save certificate')
  return data
}

// Helper: if all lessons in a module are complete, issue a certificate.
// Returns the resulting TrainingCertificate (or null if not yet complete).
export async function ensureModuleCertificate(brokerId: string, module: TrainingModule, lessons: TrainingLesson[], progress: TrainingProgress[], template = 'gold') {
  if (!lessonModuleComplete(lessons, progress)) return null
  return (await saveCertificate(brokerId, module.id, undefined, template)) as TrainingCertificate
}

export function lessonModuleComplete(lessons: TrainingLesson[], progress: TrainingProgress[]): boolean {
  if (!lessons.length) return false
  const completedIds = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id))
  return lessons.every((l) => completedIds.has(l.id))
}

// --- Uploads ---
export async function fetchUploads(brokerId?: string): Promise<TrainingUpload[]> {
  let q = supabase.from('training_uploads').select('*').order('uploaded_at', { ascending: false })
  if (brokerId) q = q.eq('broker_id', brokerId)
  const { data, error } = await q
  if (error) {
    console.warn('fetchUploads failed (non-fatal):', error.message)
    return []
  }
  return (data as TrainingUpload[]) || []
}

export async function createUpload(input: { broker_id: string; title: string; file_url: string; file_type: string; module_id?: string }) {
  const { data, error } = await supabase.from('training_uploads').insert({
    broker_id: input.broker_id,
    title: input.title,
    file_url: input.file_url,
    file_type: input.file_type,
    module_id: input.module_id || null,
  }).select().single()
  if (error) throw new Error(error.message || 'Failed to upload')
  return data
}

// --- Certificate verification ---
export interface CertificateVerification {
  valid: boolean
  reason?: string
  certificate?: TrainingCertificate & { broker_name?: string | null; broker_email?: string | null; module_title?: string | null }
}

// Look up a certificate by its human-readable verification code.
export async function verifyCertificateByCode(code: string): Promise<CertificateVerification> {
  const { data, error } = await supabase
    .from('training_certificates')
    .select('*, profiles(full_name, email), training_modules(title)')
    .eq('verification_code', code)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to verify certificate')
  if (!data || !data.id) return { valid: false, reason: 'No certificate matches this code.' }
  const cert = data as TrainingCertificate & {
    profiles?: { full_name: string | null; email: string | null } | null
    training_modules?: { title: string | null } | null
  }
  return {
    valid: true,
    certificate: {
      ...cert,
      broker_name: cert.profiles?.full_name ?? null,
      broker_email: cert.profiles?.email ?? null,
      module_title: cert.training_modules?.title ?? null,
    },
  }
}

// --- Certified brokers roster (via the certified_brokers view) ---
export interface CertifiedBroker {
  broker_id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  modules_certified: number
  last_certified_at: string | null
}

export async function fetchCertifiedBrokers(): Promise<CertifiedBroker[]> {
  const { data, error } = await supabase
    .from('certified_brokers')
    .select('*')
    .order('modules_certified', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load certified brokers')
  return (data as CertifiedBroker[]) || []
}
