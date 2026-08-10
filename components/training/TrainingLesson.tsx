'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrainingLesson, TrainingProgress, QuizQuestion,
  fetchLesson, fetchProgress, fetchQuiz, markLessonComplete, ensureModuleCertificate,
} from '@/lib/training'
import { LoadingState, EmptyState, Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import TrainingQuiz from './TrainingQuiz'
import { authedFetch } from '@/lib/apiFetch'

export default function TrainingLessonView({ moduleId, lessonId }: { moduleId: string; lessonId: string }) {
  const [lesson, setLesson] = useState<TrainingLesson | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [progress, setProgress] = useState<TrainingProgress[]>([])
  const [module, setModule] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const brokerId = getBrokerId()
      // Load the lesson (+ quiz) independently so the RLS-affected anon
      // progress fetch can't blank out the whole page when it fails.
      let l: TrainingLesson | null = null
      let q: QuizQuestion[] = []
      try {
        ;[l, q] = await Promise.all([fetchLesson(lessonId), fetchQuiz(lessonId)])
      } catch (e) {
        console.error('Failed to load lesson/quiz:', e)
      }

      const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        p.catch((e) => { console.warn('Aux lesson fetch failed (non-fatal):', e); return fallback })
      const [p] = await Promise.all([safe(fetchProgress(brokerId), [])])

      setLesson(l)
      setQuiz(q)
      setProgress(p)
      if (l) {
        // prefetch module for certificate issuance later
        const mod = await import('@/lib/training').then((m) => m.fetchModule(l.module_id))
        setModule(mod)
      }
      setLoading(false)
    })()
  }, [lessonId])

  if (loading) return <LoadingState label="Loading lesson..." />
  if (!lesson) return <EmptyState icon="⚠️" title="Lesson not found" />

  const alreadyDone = progress.some((p) => p.lesson_id === lesson.id && p.completed)

  const handleQuizPass = async (score: number) => {
    try {
      const brokerId = getBrokerId()
      await markLessonComplete(brokerId, lesson.id, score >= 80 ? 5 : 4)
      const m = await import('@/lib/training')
      const lessons = await m.fetchLessons(lesson.module_id)
      const prog = await m.fetchProgress(brokerId)
      const brokerName = (window.localStorage.getItem('concord_broker_name') || '').trim()
      const brokerEmail = (window.localStorage.getItem('concord_broker_email') || '').trim()

      // If this lesson completes the module, issue the certificate server-side
      // (writes with service role + fires the certificate email + QR code).
      if (m.lessonModuleComplete(lessons, prog)) {
        const res = await authedFetch('/api/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brokerId,
            moduleId: module?.id || lesson.module_id,
            moduleTitle: module?.title || undefined,
            brokerName: brokerName || undefined,
            brokerEmail: brokerEmail || undefined,
          }),
        })
        await res.json()
      } else {
        // keep the old inline record as a fallback if the API is unavailable
        if (module) await m.ensureModuleCertificate(brokerId, module, lessons, prog)
      }
      toast(score >= 80 ? 'Lesson complete — great score! 🎉' : 'Lesson saved. Retake quiz to score 80%+ for a better rating.', 'success')
    } catch (e) {
      toast('Failed to save progress: ' + (e as Error).message, 'error')
    }
  }

  const renderContent = (content: string) => content.split('\n').map((line, i) => (
    <p key={i} style={{ margin: '8px 0', lineHeight: 1.7 }}>{line || '\u00A0'}</p>
  ))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/dashboard/training/${moduleId}`} style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontSize: 14 }}>← Back to module</Link>
      </div>

      <article style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: '32px 36px', maxWidth: 860 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Badge color="#c9a84c">{lesson.duration_minutes} min</Badge>
          {lesson.video_url && <Badge color="#3b82f6">🎬 Video</Badge>}
          {lesson.pdf_url && <Badge color="#8b5cf6">📕 PDF Guide</Badge>}
          {quiz.length > 0 && <Badge color="#f59e0b">📝 Quiz ({quiz.length})</Badge>}
          {alreadyDone && <Badge color="#22c55e">✓ Done</Badge>}
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: 28 }}>{lesson.title}</h1>

        {/* Video */}
        {lesson.video_url && (
          <div style={{ margin: '20px 0', position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
            <iframe
              src={embedVideo(lesson.video_url)}
              title={lesson.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Content */}
        {lesson.content && (
          <div style={{ margin: '16px 0' }}>{renderContent(lesson.content)}</div>
        )}

        {/* PDF */}
        {lesson.pdf_url && (
          <a
            href={lesson.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="btn"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            📕 Download PDF Guide
          </a>
        )}

        {/* Quiz */}
        {quiz.length > 0 && <TrainingQuiz questions={quiz} onPass={handleQuizPass} />}
      </article>
    </div>
  )
}

function embedVideo(url: string) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube') || u.hostname.includes('youtu.be')) {
      const v = u.searchParams.get('v') || url.split('/').pop()
      return v ? `https://www.youtube.com/embed/${v}` : url
    }
    if (u.hostname.includes('vimeo')) return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}`
    if (u.hostname.includes('loom')) return url.replace('share', 'embed')
    return url
  } catch {
    return url
  }
}

function getBrokerId(): string {
  if (typeof window === 'undefined') return ''
  const stored = window.localStorage.getItem('concord_broker_id')
  if (stored) return stored
  const id = 'broker-' + Math.random().toString(36).slice(2, 10)
  window.localStorage.setItem('concord_broker_id', id)
  return id
}
