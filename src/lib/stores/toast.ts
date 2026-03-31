import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

export const toasts = writable<Toast[]>([]);

let toastCounter = 0;

function addToast(message: string, type: Toast['type'] = 'info', duration = 3000) {
  const id = `toast-${++toastCounter}`;
  const toast: Toast = { id, message, type, duration };
  toasts.update(t => [...t, toast]);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id: string) {
  toasts.update(t => t.filter(toast => toast.id !== id));
}

export const toast = {
  info: (message: string, duration?: number) => addToast(message, 'info', duration),
  success: (message: string, duration?: number) => addToast(message, 'success', duration),
  error: (message: string, duration?: number) => addToast(message, 'error', duration ?? 5000),
  warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
};
