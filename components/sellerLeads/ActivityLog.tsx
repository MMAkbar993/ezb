'use client'

import { useState } from 'react'
import { LeadActivity, addLeadActivity } from '@/lib/sellerLeads'

interface ActivityLogProps {
  leadId: string
  activities: LeadActivity[]
  onActivityAdded: (activity: LeadActivity) => void
}

const ACTIVITY_TYPES = ['Note', 'Call', 'Email', 'Meeting']

export default function ActivityLog({ leadId, activities, onActivityAdded }: ActivityLogProps) {
  const [type, setType] = useState('Note')
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!text.trim()) return
    setAdding(true)
    setError('')
    try {
      const created = await addLeadActivity(leadId, type.toLowerCase(), text.trim())
      onActivityAdded(created)
      setText('')
      setType('Note')
    } catch (err: any) {
      setError(err.message || 'Failed to add activity')
    } finally {
      setAdding(false)
    }
  }

  const formatWhen = (iso: string | null) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(iso).toLocaleDateString()
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Activity Log
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Add activity */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                border: type === t ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: type === t ? '#dbeafe' : '#fff',
                color: type === t ? '#1d4ed8' : '#64748b',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Add a ${type.toLowerCase()}...`}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !text.trim()}
            style={{ padding: '10px 16px', background: adding || !text.trim() ? '#cbd5e1' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: adding || !text.trim() ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            Add
          </button>
        </div>
      </div>

      {/* List */}
      {activities.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '16px', border: '2px dashed #e2e8f0', borderRadius: '8px' }}>
          No activity yet.
        </div>
      ) : (
        <div>
          {activities.map((a) => (
            <div key={a.id} style={{ padding: '10px 12px', border: '1px solid #f1f5f9', borderRadius: '8px', marginBottom: '8px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '999px' }}>
                  {a.type}
                </span>
                {a.created_at && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatWhen(a.created_at)}</span>}
              </div>
              <div style={{ fontSize: '14px', color: '#334155' }}>{a.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
