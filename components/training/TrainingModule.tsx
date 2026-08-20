'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  type TrainingModule as TrainingModuleType,
  type TrainingLesson,
  type TrainingProgress,
  type TrainingCertificate,
  fetchModule, fetchLessons, fetchProgress, fetchCertificates, lessonModuleComplete, getCurrentBrokerIdentity,
} from '@/lib/training'
import { LoadingState, EmptyState, Badge } from '@/components/ui'
import TrainingProgressBar from './TrainingProgress'

export default function TrainingModule({ moduleId }: { moduleId: string }) {
  const [module, setModule] = useState<TrainingModuleType | null>(null)
  const [lessons, setLessons] = useState<TrainingLesson[]>([])
  const [progress, setProgress] = useState<TrainingProgress[]>([])
  const [certs, setCerts] = useState<TrainingCertificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { id: brokerId } = await getCurrentBrokerIdentity()
      // Load module + lessons independently so RLS-affected progress/cert
      // fetches (anon client) can't blank out the whole page on failure.
      let m: TrainingModuleType | null = null
      let l: TrainingLesson[] = []
      try {
        ;[m, l] = await Promise.all([fetchModule(moduleId), fetchLessons(moduleId)])
      } catch (e) {
        console.error('Failed to load module/lessons:', e)
      }

      const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
        p.catch((e) => { console.warn('Aux module fetch failed (non-fatal):', e); return fallback })
      const [p, c] = await Promise.all([
        safe(fetchProgress(brokerId), []),
        safe(fetchCertificates(brokerId), []),
      ])

      const completedIds = new Set(p.filter((x) => x.completed).map((x) => x.lesson_id))
      setModule(m)
      setLessons((l || []).map((lesson) => ({ ...lesson, completed: completedIds.has(lesson.id) })))
      setProgress(p)
      setCerts(c)
      setLoading(false)
    })()
  }, [moduleId])

  if (loading) return <LoadingState label="Loading module..." />
  if (!module) return <EmptyState icon="⚠️" title="Module not found" subtitle="It may have been unpublished or removed." />

  const allComplete = lessonModuleComplete(lessons, progress)
  const certified = certs.some((c) => c.module_id === module.id)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/training" style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontSize: 14 }}>← Back to Training</Link>
      </div>

      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 48 }}>{module.icon || '📘'}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Badge color="#c9a84c">Module {module.order}</Badge>
          {certified && <Badge color="#22c55e">✓ Certified</Badge>}
          {allComplete && !certified && <Badge color="#f59e0b">All Lessons Complete</Badge>}
          <h1 style={{ margin: '8px 0 4px', fontSize: 26 }}>{module.title}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>{module.description}</p>
        </div>
      </header>

      <TrainingProgressBar lessons={lessons} style={{ marginBottom: 24 }} />

      {/* Lessons list */}
      {lessons.length === 0 ? (
        <EmptyState icon="📄" title="No lessons in this module yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lessons.map((lesson, i) => (
            <Link key={lesson.id} href={`/dashboard/training/${module.id}/${lesson.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
                  background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10,
                  transition: 'border-color .15s, transform .15s',
                }}
              >
                <div
                  style={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif',
                    background: lesson.completed ? '#22c55e' : 'var(--navy)', color: '#fff',
                  }}
                >
                  {lesson.completed ? '✓' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>{lesson.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {lesson.duration_minutes} min · {lesson.video_url ? '🎬 Video' : ''}
                    {lesson.pdf_url ? ' 📕 PDF' : ''}
                    {lesson.quiz_count ? ` 📝 Quiz (${lesson.quiz_count})` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gold-dark)' }}>{lesson.completed ? 'Completed' : 'Start →'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
