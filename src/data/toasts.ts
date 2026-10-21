import { create } from 'zustand'
import { uid } from '@/lib/utils'

export interface Toast {
  id: string
  message: string
  tone?: 'default' | 'error' | 'success'
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>, ms?: number) => void
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t, ms = 5000) => {
    const id = uid()
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] })
    setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}))

export const toast = (message: string, tone: Toast['tone'] = 'default') => useToasts.getState().push({ message, tone })
