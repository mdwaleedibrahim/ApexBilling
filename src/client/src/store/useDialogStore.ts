import { create } from 'zustand'

interface DialogState {
  isOpen: boolean
  title: string
  message: string
  isConfirm: boolean
  isPrompt: boolean
  promptPlaceholder?: string
  resolve: ((val: any) => void) | null
  show: (message: string, isConfirm?: boolean, title?: string) => Promise<boolean>
  prompt: (message: string, placeholder?: string, title?: string) => Promise<string | null>
  close: (val: any) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  title: 'ApexBill Notification',
  message: '',
  isConfirm: false,
  isPrompt: false,
  promptPlaceholder: '',
  resolve: null,
  show: (message, isConfirm = false, title = 'ApexBill Notification') => {
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, title, message, isConfirm, isPrompt: false, promptPlaceholder: '', resolve })
    })
  },
  prompt: (message, placeholder = '', title = 'ApexBill Input') => {
    return new Promise<string | null>((resolve) => {
      set({ isOpen: true, title, message, isConfirm: true, isPrompt: true, promptPlaceholder: placeholder, resolve })
    })
  },
  close: (val) => {
    const { resolve } = get()
    if (resolve) resolve(val)
    set({ isOpen: false, isPrompt: false, resolve: null })
  }
}))
