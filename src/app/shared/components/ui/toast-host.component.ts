import { Component, inject, signal } from '@angular/core';
import { ToastComponent } from './toast.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'zimra-toast-host',
  standalone: true,
  imports: [ToastComponent],
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[360px] flex-col gap-2">
      @for (t of toasts(); track t.id) {
        <div class="pointer-events-auto">
          <zimra-toast
            [text]="t.text"
            [variant]="t.variant"
            [sticky]="t.sticky"
            [progress]="progress(t)"
            (dismiss)="dismiss(t.id)"
          />
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  private readonly toast = inject(ToastService);
  readonly toasts = this.toast.toasts;
  readonly now = signal(Date.now());

  constructor() {
    window.setInterval(() => this.now.set(Date.now()), 100);
  }

  progress(t: { createdAt: number; ttlMs: number; sticky: boolean }): number {
    if (t.sticky) return 100;
    const elapsed = this.now() - t.createdAt;
    return Math.max(0, 100 - (elapsed / Math.max(1, t.ttlMs)) * 100);
  }

  dismiss(id: string): void {
    this.toast.dismiss(id);
  }
}

