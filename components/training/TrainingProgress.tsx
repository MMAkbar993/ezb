'use client'

import { TrainingLesson } from '@/lib/training'

export default function TrainingProgressBar({
  lessons,
  style,
}: {
  lessons: TrainingLesson[]
  style?: React.CSSProperties
}) {
  const total = lessons.length
  const done = lessons.filter((l) => l.completed).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 10, padding: '14px 20px', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
        <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Module Progress</span>
        <span>{done} of {total} lessons · {pct}%</span>
      </div>
      <div style={{ background: 'var(--line)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            height: 10,
            background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, var(--gold-light), var(--gold))',
            borderRadius: 999, transition: 'width .4s',
          }}
        />
      </div>
      {pct === 100 && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#166534', fontWeight: 600 }}>🏆 All lessons complete — certificate issued!</div>
      )}
    </div>
  )
}
