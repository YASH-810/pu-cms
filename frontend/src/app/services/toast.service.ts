import { Injectable, computed, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messages = signal<ToastMessage[]>([]);
  readonly toasts = computed(() => this.messages());
  private nextId = 1;

  success(title: string, message?: string) {
    this.push('success', title, message);
  }

  error(title: string, message?: string) {
    this.push('error', title, message);
  }

  info(title: string, message?: string) {
    this.push('info', title, message);
  }

  dismiss(id: number) {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }

  fromApiError(error: any, fallback: string) {
    const message = error?.error?.errors?.[0]?.message ?? fallback;
    this.error(fallback, message);
  }

  private push(type: ToastMessage['type'], title: string, message?: string) {
    const toast: ToastMessage = {
      id: this.nextId++,
      type,
      title,
      message
    };

    this.messages.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), 4500);
  }
}
