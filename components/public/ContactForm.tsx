'use client'

import { useState } from 'react'
import { ToastProvider, useToast } from '@/components/ui/Toast'

function ContactFormInner() {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast('Name, email, and message are required', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSent(true)
        toast("Message sent — we'll be in touch shortly.", 'success')
      } else {
        toast(data.error || 'Something went wrong. Please try again.', 'error')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#1a1a2e', fontWeight: 700 }}>Message sent</div>
        <div style={{ fontSize: 14, color: '#888', marginTop: 6 }}>A member of our team will reach out shortly.</div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #ece8dc', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input className="input" placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className="input" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <textarea className="textarea" rows={5} placeholder="How can we help? *" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
      <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Sending…' : 'Send Message'}</button>
    </form>
  )
}

export default function ContactForm() {
  return (
    <ToastProvider>
      <ContactFormInner />
    </ToastProvider>
  )
}
