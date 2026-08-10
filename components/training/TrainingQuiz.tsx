'use client'

import { useState } from 'react'
import { QuizQuestion } from '@/lib/training'
import { useToast } from '@/components/ui/Toast'

export default function TrainingQuiz({ questions, onPass }: { questions: QuizQuestion[]; onPass: (score: number) => Promise<void> | void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const toast = useToast()

  const answered = Object.keys(answers).length
  const allAnswered = answered === questions.length

  const submit = () => {
    if (!allAnswered) { toast('Answer all questions before submitting.', 'info'); return }
    let correct = 0
    questions.forEach((q) => { if (answers[q.id] === q.correct_answer) correct++ })
    const pct = Math.round((correct / questions.length) * 100)
    setScore(pct)
    setSubmitted(true)
    onPass(pct)
  }

  const reset = () => { setAnswers({}); setSubmitted(false); setScore(0) }

  return (
    <div style={{ marginTop: 28, border: '1px solid var(--line)', borderRadius: 10, background: '#fff', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 20 }}>📝 Lesson Quiz</h3>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{answered}/{questions.length} answered</div>
      </div>

      {submitted && (
        <div
          style={{
            padding: '14px 18px', borderRadius: 8, marginBottom: 18,
            background: score >= 80 ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${score >= 80 ? '#22c55e' : '#ef4444'}`,
            color: score >= 80 ? '#166534' : '#991b1b', fontWeight: 700,
          }}
        >
          {score >= 80
            ? `✓ Excellent! You scored ${score}% — lesson marked complete.`
            : `Score: ${score}%. 80%+ required to certify. Review and retake.`}
          <div style={{ fontWeight: 400, marginTop: 4, fontSize: 13 }}>
            {questions.map((q, i) => {
              const isCorrect = answers[q.id] === q.correct_answer
              return (
                <div key={q.id} style={{ margin: '4px 0' }}>
                  {isCorrect ? '✅' : '❌'} {i + 1}. {q.question}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {questions.map((q, qi) => (
        <fieldset key={q.id} disabled={submitted} style={{ border: 'none', padding: 0, marginBottom: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>
            {qi + 1}. {q.question}
          </div>
          {(q.options || []).map((opt) => {
            const selected = answers[q.id] === opt
            const isRight = submitted && opt === q.correct_answer
            const isWrong = submitted && selected && opt !== q.correct_answer
            return (
              <label
                key={opt}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', margin: '6px 0',
                  borderRadius: 8, cursor: submitted ? 'default' : 'pointer',
                  border: `1px solid ${
                    isRight ? '#22c55e' : isWrong ? '#ef4444' : selected ? 'var(--gold)' : 'var(--line)'
                  }`,
                  background: isRight ? '#ecfdf5' : isWrong ? '#fef2f2' : selected ? '#fdf6e3' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={selected}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  disabled={submitted}
                />
                <span>{opt}</span>
                {isRight && <span style={{ marginLeft: 'auto', color: '#22c55e' }}>✓</span>}
                {isWrong && <span style={{ marginLeft: 'auto', color: '#ef4444' }}>✕</span>}
              </label>
            )
          })}
        </fieldset>
      ))}

      <div style={{ marginTop: 8 }}>
        {!submitted ? (
          <button className="btn" onClick={submit} disabled={!allAnswered}>Submit Quiz</button>
        ) : (
          <button className="btn" onClick={reset} style={{ background: 'var(--navy)', color: '#fff' }}>Retake Quiz</button>
        )}
      </div>
    </div>
  )
}
