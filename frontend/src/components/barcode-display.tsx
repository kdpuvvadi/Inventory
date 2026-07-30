import JsBarcode from 'jsbarcode'
import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

import { cn } from '@/lib/utils'

interface BarcodeDisplayProps {
  value: string
  className?: string
  width?: number
  height?: number
  displayValue?: boolean
}

export function BarcodeDisplay({
  value,
  className,
  width = 2,
  height = 60,
  displayValue = true,
}: BarcodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return

    try {
      JsBarcode(canvasRef.current, value, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        margin: 8,
      })
    } catch {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [value, width, height, displayValue])

  if (!value) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No barcode value
      </div>
    )
  }

  return <canvas ref={canvasRef} className={cn('max-w-full', className)} />
}

interface QRCodeDisplayProps {
  value: string
  size?: number
  className?: string
  level?: 'L' | 'M' | 'Q' | 'H'
}

export function QRCodeDisplay({
  value,
  size = 128,
  className,
  level = 'M',
}: QRCodeDisplayProps) {
  if (!value) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        No QR code value
      </div>
    )
  }

  return (
    <QRCodeSVG
      value={value}
      size={size}
      level={level}
      className={cn('rounded-md border bg-white p-2', className)}
    />
  )
}
