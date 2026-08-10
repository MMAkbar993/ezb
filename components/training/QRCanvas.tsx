'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Renders a scannable QR code (no data dependency outside the payload string).
export default function QRCanvas({ value, size = 120 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1a2e', light: '#ffffff' },
    }).catch(() => {
      /* swallow — non-critical decorative element */
    })
  }, [value, size])

  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />
}
