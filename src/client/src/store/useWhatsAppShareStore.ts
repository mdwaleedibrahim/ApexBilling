import { create } from 'zustand'

export interface WhatsAppShareState {
  isOpen: boolean
  mode: 'share' | 'reminder'
  doc: any | null
  phone: string
  cleanedPhone: string
  textMsg: string
  filename: string
  qrFilename: string
  pdfBlob: Blob | null
  qrBlob: Blob | null
  qrDataUrl: string | null
  isGeneratingPdf: boolean
  isGeneratingQr: boolean
  step1Completed: boolean
  step2Completed: boolean
  isAutoSharingStep2: boolean
  autoShareAttempted: boolean
  autoShareSuccess: boolean
  balanceDue?: number
  upiLink?: string | null
  upiId?: string | null
  payeeName?: string | null
  reminderNumber?: number

  // Actions
  open: (payload: {
    doc: any
    phone: string
    cleanedPhone: string
    textMsg: string
    filename: string
    qrFilename?: string
    pdfBlob?: Blob | null
    qrBlob?: Blob | null
    qrDataUrl?: string | null
    isGeneratingPdf?: boolean
    isGeneratingQr?: boolean
    mode?: 'share' | 'reminder'
    balanceDue?: number
    upiLink?: string | null
    upiId?: string | null
    payeeName?: string | null
    reminderNumber?: number
  }) => void
  setPdfBlob: (blob: Blob | null) => void
  setQrBlob: (blob: Blob | null, dataUrl?: string | null) => void
  setIsGeneratingPdf: (isGenerating: boolean) => void
  setIsGeneratingQr: (isGenerating: boolean) => void
  setIsAutoSharingStep2: (isSharing: boolean) => void
  setAutoShareResult: (attempted: boolean, success: boolean) => void
  setStep1Completed: (completed: boolean) => void
  setStep2Completed: (completed: boolean) => void
  close: () => void
}

export const useWhatsAppShareStore = create<WhatsAppShareState>((set) => ({
  isOpen: false,
  mode: 'share',
  doc: null,
  phone: '',
  cleanedPhone: '',
  textMsg: '',
  filename: '',
  qrFilename: '',
  pdfBlob: null,
  qrBlob: null,
  qrDataUrl: null,
  isGeneratingPdf: false,
  isGeneratingQr: false,
  step1Completed: false,
  step2Completed: false,
  isAutoSharingStep2: false,
  autoShareAttempted: false,
  autoShareSuccess: false,
  balanceDue: 0,
  upiLink: null,
  upiId: null,
  payeeName: null,

  open: (payload) => set({
    isOpen: true,
    mode: payload.mode || 'share',
    doc: payload.doc,
    phone: payload.phone,
    cleanedPhone: payload.cleanedPhone,
    textMsg: payload.textMsg,
    filename: payload.filename,
    qrFilename: payload.qrFilename || `${payload.filename.replace(/\.pdf$/i, '')}-Payment-QR.png`,
    pdfBlob: payload.pdfBlob || null,
    qrBlob: payload.qrBlob || null,
    qrDataUrl: payload.qrDataUrl || null,
    isGeneratingPdf: payload.isGeneratingPdf ?? false,
    isGeneratingQr: payload.isGeneratingQr ?? false,
    step1Completed: false,
    step2Completed: false,
    isAutoSharingStep2: false,
    autoShareAttempted: false,
    autoShareSuccess: false,
    balanceDue: payload.balanceDue ?? 0,
    upiLink: payload.upiLink || null,
    upiId: payload.upiId || null,
    payeeName: payload.payeeName || null,
    reminderNumber: payload.reminderNumber
  }),

  setPdfBlob: (blob) => set({ pdfBlob: blob, isGeneratingPdf: false }),
  setQrBlob: (blob, dataUrl = null) => set({ qrBlob: blob, qrDataUrl: dataUrl, isGeneratingQr: false }),
  setIsGeneratingPdf: (isGenerating) => set({ isGeneratingPdf: isGenerating }),
  setIsGeneratingQr: (isGenerating) => set({ isGeneratingQr: isGenerating }),
  setIsAutoSharingStep2: (isSharing) => set({ isAutoSharingStep2: isSharing }),
  setAutoShareResult: (attempted, success) => set({ autoShareAttempted: attempted, autoShareSuccess: success }),
  setStep1Completed: (completed) => set({ step1Completed: completed }),
  setStep2Completed: (completed) => set({ step2Completed: completed }),
  close: () => set({
    isOpen: false,
    mode: 'share',
    doc: null,
    pdfBlob: null,
    qrBlob: null,
    qrDataUrl: null,
    isGeneratingPdf: false,
    isGeneratingQr: false,
    step1Completed: false,
    step2Completed: false,
    isAutoSharingStep2: false,
    autoShareAttempted: false,
    autoShareSuccess: false,
    balanceDue: 0,
    upiLink: null,
    upiId: null,
    payeeName: null,
    reminderNumber: undefined
  })
}))
