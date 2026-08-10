'use client'

import { PipelineItem, formatMoney } from '@/lib/pipeline'

interface DealCardProps {
  deal: PipelineItem
  onClick: () => void
  onEdit: () => void
  stageDuration: string | null
}

export default function DealCard({ deal, onClick, onEdit, stageDuration }: DealCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
        padding: 12, marginBottom: 10, cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(26,26,46,0.05)', transition: 'box-shadow 0.15s, border 0.15s',
      }}
    >
      {/* Image + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {deal.primary_image_url ? (
          <img
            src={deal.primary_image_url}
            alt={deal.business_name || 'Deal'}
            onError={(e) => (e.currentTarget.style.display = 'none')}
            style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#f1eee4' }}
          />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--gold-light)', flexShrink: 0 }}>
            {initials(deal.business_name)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {deal.business_name || 'Unnamed Deal'}
          </div>
          {deal.industry && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{deal.industry}</div>}
        </div>
      </div>

      {/* Price + edit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-dark)' }}>
          {formatMoney(deal.purchase_price ?? deal.asking_price)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}
        >
          ✎ Edit
        </button>
      </div>

      {/* Stage duration */}
      {stageDuration && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>⏱</span> {stageDuration} in stage
        </div>
      )}
    </div>
  )
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((n) => n[0] || '').join('').toUpperCase().slice(0, 2)
}
