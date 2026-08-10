import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/apiAuth'

// ---------------------------------------------------------------------------
// Training API — serve published training modules + lessons to the Training
// Center. Runs server-side with the service role client so it bypasses RLS
// (training content is `select to authenticated` only, which the anon browser
// client cannot read). The service key never reaches the browser bundle.
// Requires a signed-in session — training content and quiz answers are for
// brokers only, not the public internet.
// ---------------------------------------------------------------------------

export const runtime = 'nodejs'

const SVC = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || 'NO_KEY', {
      auth: { persistSession: false },
    })
  : null

// GET /api/training?include=lessons&id=...&module=... -> { ok, modules: [...] }
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth) return unauthorized()

  const svc = SVC
  if (!svc) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })

  const includeLessons = (req.nextUrl.searchParams.get('include') || '') === 'lessons'
  const id = req.nextUrl.searchParams.get('id') || null
  const module = req.nextUrl.searchParams.get('module') || null
  const lesson = req.nextUrl.searchParams.get('lesson') || null
  const quiz = req.nextUrl.searchParams.get('quiz') || null

  try {
    // Quiz questions for a lesson — only for a published lesson.
    if (quiz) {
      const { data: lessonRow } = await svc
        .from('training_lessons')
        .select('id')
        .eq('id', quiz)
        .eq('is_published', true)
        .maybeSingle()
      if (!lessonRow) return NextResponse.json({ ok: true, quizQuestions: [] })
      const { data } = await svc
        .from('training_quiz_questions')
        .select('*')
        .eq('lesson_id', quiz)
      return NextResponse.json({ ok: true, quizQuestions: data || [] })
    }

    // Single-lesson lookup — published only.
    if (lesson) {
      const { data } = await svc
        .from('training_lessons')
        .select('*')
        .eq('id', lesson)
        .eq('is_published', true)
        .limit(1)
      return NextResponse.json({ ok: true, lesson: data?.[0] || null })
    }

    let query = svc
      .from('training_modules')
      .select(includeLessons ? '*, lessons:training_lessons(*)' : '*')
      .eq('is_published', true)
      .order('order', { ascending: true })
    if (id) query = query.eq('id', id).limit(1)
    if (module) query = query.eq('id', module)

    const { data, error } = await query
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // Add lesson_count (either from joined lessons or a count query).
    let lessonCounts: Record<string, number> = {}
    if (includeLessons) {
      (data || []).forEach((m: any) => {
        lessonCounts[m.id] = (m.lessons?.filter((l: any) => l.is_published)?.length) || 0
      })
    } else {
      let countQ = svc.from('training_lessons').select('module_id').eq('is_published', true)
      if (id || module) countQ = countQ.eq('module_id', id || module)
      const { data: counts } = await countQ
      counts?.forEach((c) => { lessonCounts[c.module_id] = (lessonCounts[c.module_id] || 0) + 1 })
    }

    const modules = (data || []).map((m: any) => ({
      ...m,
      lessons: includeLessons ? (m.lessons?.filter((l: any) => l.is_published) ?? []) : undefined,
      lesson_count: includeLessons ? (lessonCounts[m.id] || 0) : (lessonCounts[m.id] || 0),
    }))

    return NextResponse.json({ ok: true, modules })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
