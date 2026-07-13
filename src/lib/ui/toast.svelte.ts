export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 0;
let toasts = $state<Toast[]>([]);

export function toastList(): Toast[] {
  return toasts;
}

export function pushToast(message: string, tone: ToastTone = 'info', durationMs = 5000): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }];
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((toast) => toast.id !== id);
}
