/**
 * qrImageHelper.ts
 * Generates an official, high-resolution UPI Payment QR Code Scanner Card image (PNG blob & DataURL).
 * Designed specifically for WhatsApp image attachments, mobile photo gallery scanning,
 * and instant camera scanning by Google Pay, PhonePe, Paytm, BHIM, Cred, and all UPI apps.
 */

import { formatINR, formatDate } from './upiHelper'

export interface PaymentQrCardParams {
  qrCanvasElement: HTMLCanvasElement | null
  upiLink: string
  docNumber: string
  docDate?: string
  grandTotal: number
  paidAmount: number
  balanceDue: number
  customerName?: string
  storeName?: string
  upiId?: string | null
  payeeName?: string | null
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Renders a crisp 800x1060 Standee Card on an HTML5 canvas and exports as a PNG Blob.
 */
export async function generatePaymentQrCardBlob(params: {
  qrCanvasElement: HTMLCanvasElement | null
  upiLink: string
  docNumber: string
  docDate?: string
  grandTotal: number
  paidAmount: number
  balanceDue: number
  customerName?: string
  storeName?: string
  upiId?: string | null
  payeeName?: string | null
}): Promise<{ blob: Blob | null; dataUrl: string | null }> {
  const {
    qrCanvasElement,
    docNumber,
    docDate,
    grandTotal,
    balanceDue,
    customerName,
    storeName,
    upiId,
    payeeName,
  } = params

  const width = 800
  const height = 1060
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: null, dataUrl: null }

  // 1. Full Canvas Background (slate-100)
  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, width, height)

  // 2. Main Standee Card Container (White)
  const cardX = 24
  const cardY = 24
  const cardW = width - 48
  const cardH = height - 48
  const cardR = 24

  ctx.save()
  // Subtle card drop shadow
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#ffffff'
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fill()
  ctx.restore()

  // Card border
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.stroke()

  // 3. Header Banner (Executive Dark Slate / Navy)
  const headerH = 112
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cardX + cardR, cardY)
  ctx.lineTo(cardX + cardW - cardR, cardY)
  ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + cardR)
  ctx.lineTo(cardX + cardW, cardY + headerH)
  ctx.lineTo(cardX, cardY + headerH)
  ctx.lineTo(cardX, cardY + cardR)
  ctx.quadraticCurveTo(cardX, cardY, cardX + cardR, cardY)
  ctx.closePath()
  ctx.fillStyle = '#0f172a'
  ctx.fill()
  ctx.restore()

  // Header bottom accent line (Emerald/Amber gradient style)
  ctx.fillStyle = '#10b981'
  ctx.fillRect(cardX, cardY + headerH - 3, cardW, 3)

  // Header Text: Store Name
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 26px Inter, system-ui, -apple-system, sans-serif'
  const displayStore = (storeName || 'ApexBill').trim()
  ctx.fillText(displayStore.length > 36 ? displayStore.substring(0, 34) + '…' : displayStore, width / 2, cardY + 44)

  // Header Subtitle: Official UPI QR Badge
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 12.5px Inter, system-ui, -apple-system, sans-serif'
  ctx.fillText('⚡ OFFICIAL UPI SCAN & PAY', width / 2, cardY + 80)

  // 4. Center QR Code Container
  const qrBoxW = 390
  const qrBoxH = 390
  const qrBoxX = (width - qrBoxW) / 2
  const qrBoxY = cardY + headerH + 28
  const qrBoxR = 20

  // QR box background with soft border
  ctx.fillStyle = '#ffffff'
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, qrBoxR)
  ctx.fill()
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, qrBoxR)
  ctx.stroke()

  // Draw QR Code onto Canvas
  const qrSize = 340
  const qrX = qrBoxX + (qrBoxW - qrSize) / 2
  const qrY = qrBoxY + 16

  if (qrCanvasElement) {
    ctx.drawImage(qrCanvasElement, qrX, qrY, qrSize, qrSize)
  } else {
    // Placeholder in case QR canvas element wasn't ready
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(qrX, qrY, qrSize, qrSize)
    ctx.fillStyle = '#64748b'
    ctx.font = '14px Inter, sans-serif'
    ctx.fillText('QR Code Generating...', width / 2, qrY + qrSize / 2)
  }

  // QR Box caption
  ctx.fillStyle = '#64748b'
  ctx.font = '500 12px Inter, sans-serif'
  ctx.fillText('Scan with GPay, PhonePe, Paytm, BHIM or any UPI app', width / 2, qrBoxY + qrBoxH - 14)

  // 5. Amount Due Banner
  const amtBoxW = cardW - 64
  const amtBoxH = 88
  const amtBoxX = cardX + 32
  const amtBoxY = qrBoxY + qrBoxH + 24
  const amtBoxR = 16

  ctx.fillStyle = '#fef2f2' // Soft red background
  drawRoundedRect(ctx, amtBoxX, amtBoxY, amtBoxW, amtBoxH, amtBoxR)
  ctx.fill()
  ctx.strokeStyle = '#fca5a5' // Red border
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, amtBoxX, amtBoxY, amtBoxW, amtBoxH, amtBoxR)
  ctx.stroke()

  // Amount Due Label
  ctx.fillStyle = '#b91c1c'
  ctx.font = 'bold 12px Inter, sans-serif'
  ctx.fillText('AMOUNT TO PAY (BALANCE DUE)', width / 2, amtBoxY + 26)

  // Amount Due Value
  ctx.fillStyle = '#991b1b'
  ctx.font = 'bold 36px Inter, sans-serif'
  ctx.fillText(formatINR(balanceDue), width / 2, amtBoxY + 62)

  // 6. Invoice Details Section
  const detailsBoxW = cardW - 64
  const detailsBoxH = 175
  const detailsBoxX = cardX + 32
  const detailsBoxY = amtBoxY + amtBoxH + 20
  const detailsBoxR = 16

  ctx.fillStyle = '#f8fafc'
  drawRoundedRect(ctx, detailsBoxX, detailsBoxY, detailsBoxW, detailsBoxH, detailsBoxR)
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, detailsBoxX, detailsBoxY, detailsBoxW, detailsBoxH, detailsBoxR)
  ctx.stroke()

  // Details Content Rows
  const rowLeftX = detailsBoxX + 24
  const rowRightX = detailsBoxX + detailsBoxW / 2 + 16
  ctx.textAlign = 'left'

  // Row 1: Invoice No & Date
  const r1Y = detailsBoxY + 32
  ctx.font = '500 13px Inter, sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Invoice No:', rowLeftX, r1Y)
  ctx.font = 'bold 14px monospace, sans-serif'
  ctx.fillStyle = '#0f172a'
  ctx.fillText(docNumber, rowLeftX + 90, r1Y)

  ctx.font = '500 13px Inter, sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Date:', rowRightX, r1Y)
  ctx.font = '600 13px Inter, sans-serif'
  ctx.fillStyle = '#0f172a'
  ctx.fillText(formatDate(docDate || ''), rowRightX + 45, r1Y)

  // Row 2: Customer Name & Total Bill
  const r2Y = detailsBoxY + 68
  ctx.font = '500 13px Inter, sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Customer:', rowLeftX, r2Y)
  ctx.font = '600 13px Inter, sans-serif'
  ctx.fillStyle = '#0f172a'
  const dispCust = (customerName || 'Valued Customer').trim()
  ctx.fillText(dispCust.length > 20 ? dispCust.substring(0, 18) + '…' : dispCust, rowLeftX + 90, r2Y)

  ctx.font = '500 13px Inter, sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Total Bill:', rowRightX, r2Y)
  ctx.font = '600 13px Inter, sans-serif'
  ctx.fillStyle = '#0f172a'
  ctx.fillText(formatINR(grandTotal), rowRightX + 75, r2Y)

  // Row 3: Payee & UPI ID
  const r3Y = detailsBoxY + 104
  if (payeeName) {
    ctx.font = '500 13px Inter, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('Payee:', rowLeftX, r3Y)
    ctx.font = '600 13px Inter, sans-serif'
    ctx.fillStyle = '#0f172a'
    const dispPayee = payeeName.trim()
    ctx.fillText(dispPayee.length > 32 ? dispPayee.substring(0, 30) + '…' : dispPayee, rowLeftX + 90, r3Y)
  }

  // Row 4: UPI ID Pill
  const r4Y = detailsBoxY + 138
  if (upiId) {
    const pillW = detailsBoxW - 48
    const pillH = 26
    ctx.fillStyle = '#e0f2fe'
    drawRoundedRect(ctx, rowLeftX, r4Y - 18, pillW, pillH, 8)
    ctx.fill()
    ctx.font = 'bold 12px monospace, sans-serif'
    ctx.fillStyle = '#0369a1'
    ctx.fillText(`UPI ID: ${upiId}`, rowLeftX + 12, r4Y)
  }

  // 7. Footer: Supported UPI Apps
  ctx.textAlign = 'center'
  ctx.fillStyle = '#475569'
  ctx.font = '600 12px Inter, sans-serif'
  ctx.fillText('Accepted on Google Pay · PhonePe · Paytm · BHIM · Any UPI App', width / 2, cardY + cardH - 52)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 10.5px Inter, sans-serif'
  ctx.fillText('Powered by ApexBill • Payment Reminder', width / 2, cardY + cardH - 24)

  // Export as Blob and DataURL
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0)
  })

  return { blob, dataUrl }
}
