import React from 'react'

interface UICardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
}

export function Card({ children, style, className, onClick }: UICardProps) {
  return (
    <div className={`card ${className || ''}`} style={style} onClick={onClick}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div className="section-title">{title}</div>
        {subtitle && <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--muted)' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px', color: 'var(--muted)', fontFamily: 'Georgia, serif' }}>
      <span
        style={{
          width: '18px', height: '18px', borderRadius: '50%',
          border: '2px solid var(--gold)', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {label}
    </div>
  )
}

export function EmptyState({ icon = '📄', title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
      <div style={{ fontSize: '42px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--navy)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '13px', marginTop: '4px' }}>{subtitle}</div>}
    </div>
  )
}

export function StatCard({ label, value, icon, accent = '#c9a84c' }: { label: string; value: string | number; icon?: string; accent?: string }) {
  return (
    <Card style={{ padding: '18px 20px', borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="section-title">{label}</div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: 'var(--navy)', marginTop: '4px', fontFamily: 'Georgia, serif' }}>
            {value}
          </div>
        </div>
        {icon && <div style={{ fontSize: '26px', opacity: 0.7 }}>{icon}</div>}
      </div>
    </Card>
  )
}

export function Badge({ children, color = '#c9a84c' }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: color + '1a', color, fontSize: '12px', fontWeight: 700,
        padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
