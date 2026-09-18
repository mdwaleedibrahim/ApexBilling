import { create } from 'zustand'

export interface WhatsAppShareState {
  isOpen: boolean
  mode: 'share' | 'reminder'
  doc: any | null
  phone: string
  cleanedPhone: string
  textMsg: string
  filename: string
  pdfBlob: Blob | null
  isGeneratingPdf: boolean
  step1Completed: boolean
  step2Completed: boolean
  balanceDue?: number
  upiLink?: string | null
  upiId?: string | null
  payeeName?: string | null

  // Actions
  open: (payload: {
    doc: any
    phone: string
    cleanedPhone: string
    textMsg: string
    filename: string
    pdfBlob?: Blob | null
    isGeneratingPdf?: boolean
    mode?: 'share' | 'reminder'
    balanceDue?: number
    upiLink?: string | null
    upiId?: string | null
    payeeName?: string | null
  }) => void
  setPdfBlob: (blob: Blob | null) => void
  setIsGeneratingPdf: (isGenerating: boolean) => void
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
  pdfBlob: null,
  isGeneratingPdf: false,
  step1Completed: false,
  step2Completed: false,
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
    pdfBlob: payload.pdfBlob || null,
    isGeneratingPdf: payload.isGeneratingPdf ?? false,
    step1Completed: false,
    step2Completed: false,
    balanceDue: payload.balanceDue ?? 0,
    upiLink: payload.upiLink || null,
    upiId: payload.upiId || null,
    payeeName: payload.payeeName || null
  }),

  setPdfBlob: (blob) => set({ pdfBlob: blob, isGeneratingPdf: false }),
  setIsGeneratingPdf: (isGenerating) => set({ isGeneratingPdf: isGenerating }),
  setStep1Completed: (completed) => set({ step1Completed: completed }),
  setStep2Completed: (completed) => set({ step2Completed: completed }),
  close: () => set({
    isOpen: false,
    mode: 'share',
    doc: null,
    pdfBlob: null,
    isGeneratingPdf: false,
    step1Completed: false,
    step2Completed: false,
    balanceDue: 0,
    upiLink: null,
    upiId: null,
    payeeName: null
  })
}))
