import { create } from 'zustand'

export interface WhatsAppShareState {
  isOpen: boolean
  doc: any | null
  phone: string
  cleanedPhone: string
  textMsg: string
  filename: string
  pdfBlob: Blob | null
  isGeneratingPdf: boolean
  step1Completed: boolean
  step2Completed: boolean
  
  // Actions
  open: (payload: {
    doc: any
    phone: string
    cleanedPhone: string
    textMsg: string
    filename: string
    pdfBlob?: Blob | null
    isGeneratingPdf?: boolean
  }) => void
  setPdfBlob: (blob: Blob | null) => void
  setIsGeneratingPdf: (isGenerating: boolean) => void
  setStep1Completed: (completed: boolean) => void
  setStep2Completed: (completed: boolean) => void
  close: () => void
}

export const useWhatsAppShareStore = create<WhatsAppShareState>((set) => ({
  isOpen: false,
  doc: null,
  phone: '',
  cleanedPhone: '',
  textMsg: '',
  filename: '',
  pdfBlob: null,
  isGeneratingPdf: false,
  step1Completed: false,
  step2Completed: false,

  open: (payload) => set({
    isOpen: true,
    doc: payload.doc,
    phone: payload.phone,
    cleanedPhone: payload.cleanedPhone,
    textMsg: payload.textMsg,
    filename: payload.filename,
    pdfBlob: payload.pdfBlob || null,
    isGeneratingPdf: payload.isGeneratingPdf ?? false,
    step1Completed: false,
    step2Completed: false
  }),

  setPdfBlob: (blob) => set({ pdfBlob: blob, isGeneratingPdf: false }),
  setIsGeneratingPdf: (isGenerating) => set({ isGeneratingPdf: isGenerating }),
  setStep1Completed: (completed) => set({ step1Completed: completed }),
  setStep2Completed: (completed) => set({ step2Completed: completed }),
  close: () => set({
    isOpen: false,
    doc: null,
    pdfBlob: null,
    isGeneratingPdf: false,
    step1Completed: false,
    step2Completed: false
  })
}))
