'use client'

import { DealStage, PipelineItem, PIPELINE_STAGES, formatMoney } from '@/lib/pipeline'

interface DealDetailProps {
  deal: PipelineItem
  onClose: () => void
  onMoveStage: (stage: DealStage) => void
  onEdit: () => void
  onDelete: (deal: PipelineItem) => void
}

export default function DealDetail({ deal, onClose, onMoveStage, onEdit, onDelete }: DealDetailProps) {
  const formatDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', width: '440px', maxWidth: '100%', height: '100%',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header with image */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, flex: 1 }}>
              {deal.business_name || 'Unnamed Deal'}
            </h2>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
          {deal.industry && <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>{deal.industry}</div>}
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Key stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <StatBox label="Purchase Price" value={formatMoney(deal.purchase_price)} />
            <StatBox label="Asking Price" value={formatMoney(deal.asking_price)} />
            <StatBox label="Stage" value={stageLabel(deal.stage)} />
            <StatBox label="Updated" value={formatDate(deal.updated_at)} />
          </div>

          {/* Headline */}
          {deal.headline && (
            <div style={{ marginBottom: '20px' }}>
              <div style={sectionLabel}>Headline</div>
              <div style={{ fontSize: '14px', color: '#334155' }}>{deal.headline}</div>
            </div>
          )}

          {/* Move stage */}
          <div style={{ marginBottom: '20px' }}>
            <div style={sectionLabel}>Move to Stage</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PIPELINE_STAGES.map((s) => {
                const active = deal.stage === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => onMoveStage(s.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      border: active ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: active ? '#dbeafe' : '#fff',
                      color: active ? '#1d4ed8' : '#64748b',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={onEdit} style={{
              flex: 1, padding: '11px', background: '#1a1a2e', color: '#e0c97e', border: 'none',
              borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif',
            }}>
              ✎ Edit Deal
            </button>
            <button
              onClick={() => onDelete(deal)}
              style={{
                flex: 1, padding: '11px', background: 'transparent', color: '#b91c1c',
                border: '1px solid #f0c4c4', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif',
              }}
            >
              🗑 Delete
            </button>
          </div>

          {/* Metadata */}
          <div style={{ marginBottom: '20px' }}>
            <div style={sectionLabel}>Details</div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>Deal ID</span><span style={{ color: '#334155', fontFamily: 'monospace' }}>{deal.id.slice(0, 8)}…</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>Listing</span><span style={{ color: '#334155' }}>{deal.listing_id ? deal.listing_id.slice(0, 8) + '…' : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>Created</span><span style={{ color: '#334155' }}>{formatDate(deal.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '8px',
}

function stageLabel(s: string): string {
  return PIPELINE_STAGES.find((st) => st.id === s)?.label || s
}
