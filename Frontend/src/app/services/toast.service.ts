import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  /** internal timer handle so we can cancel on manual dismiss */
  _timerId?: ReturnType<typeof setTimeout>;
}

let _counter = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  // ── public API ──────────────────────────────────────────────────────────

  success(title: string, message?: string, action?: ToastAction): void {
    this._add({ type: 'success', title, message, action }, 4000);
  }

  error(title: string, message?: string, action?: ToastAction): void {
    this._add({ type: 'error', title, message, action }, 5000);
  }

  warning(title: string, message?: string, action?: ToastAction): void {
    this._add({ type: 'warning', title, message, action }, 4000);
  }

  info(title: string, message?: string, action?: ToastAction): void {
    this._add({ type: 'info', title, message, action }, 4000);
  }

  dismiss(id: string): void {
    this.toasts.update(list => {
      const toast = list.find(t => t.id === id);
      if (toast?._timerId) clearTimeout(toast._timerId);
      return list.filter(t => t.id !== id);
    });
  }

  // ── private ─────────────────────────────────────────────────────────────

  private _add(
    partial: Omit<Toast, 'id' | '_timerId'>,
    duration: number
  ): void {
    const id = `toast_${++_counter}_${Date.now()}`;
    const timerId = setTimeout(() => this.dismiss(id), duration);
    const toast: Toast = { id, _timerId: timerId, ...partial };
    this.toasts.update(list => [...list, toast]);
  }
}
