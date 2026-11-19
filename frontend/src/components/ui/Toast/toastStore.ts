import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message: string, variant: ToastVariant = 'info', durationMs = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant }],
    }));

    if (durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
    }
  },
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const toast = {
  success: (message: string, durationMs = 4000) => {
    useToastStore.getState().addToast(message, 'success', durationMs);
  },
  error: (message: string, durationMs = 5000) => {
    useToastStore.getState().addToast(message, 'error', durationMs);
  },
  info: (message: string, durationMs = 4000) => {
    useToastStore.getState().addToast(message, 'info', durationMs);
  },
  warning: (message: string, durationMs = 4500) => {
    useToastStore.getState().addToast(message, 'warning', durationMs);
  },
};
