import { computed, Injectable, signal } from '@angular/core';
import type { ToastVariant } from '../../shared/components/ui/toast.component';

export type ToastItem = {
  id: string;
  text: string;
  variant: ToastVariant;
  createdAt: number;
  ttlMs: number;
  sticky: boolean;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<ToastItem[]>([]);

  readonly toasts = computed(() => this.items());

  push(text: string, variant: ToastVariant = 'info', ttlMs = 5000): void {
    const id = this.makeId();
    const sticky = variant === 'error';
    this.items.update((prev) => [...prev, { id, text, variant, createdAt: Date.now(), ttlMs, sticky }]);

    if (!sticky) {
      window.setTimeout(() => {
        this.remove(id);
      }, Math.max(0, ttlMs));
    }
  }

  clear(): void {
    this.items.set([]);
  }

  private remove(id: string): void {
    this.items.update((prev) => prev.filter((t) => t.id !== id));
  }

  dismiss(id: string): void {
    this.remove(id);
  }

  private makeId(): string {
    // No crypto dependency: good enough for in-session toasts.
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

