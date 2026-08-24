import { create } from 'zustand'

interface DialogState {
  isOpen: boolean
  title: string
  message: string
  isConfirm: boolean
  resolve: ((val: boolean) => void) | null
  show: (message: string, isConfirm?: boolean, title?: string) => Promise<boolean>
  close: (val: boolean) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  title: 'ApexBill Notification',
  message: '',
  isConfirm: false,
  resolve: null,
  show: (message, isConfirm = false, title = 'ApexBill Notification') => {
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, title, message, isConfirm, resolve })
    })
  },
  close: (val) => {
    const { resolve } = get()
    if (resolve) resolve(val)
    set({ isOpen: false, resolve: null })
  }
}))
