import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

@Component({
  selector: 'zimra-toast',
  standalone: true,
  imports: [NgIf, NgClass],
  template: `
    <div
      *ngIf="text"
      class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
      [ngClass]="classes"
      role="status"
    >
      <div class="mb-1 flex items-start justify-between gap-3">
        <span>{{ text }}</span>
        <button type="button" class="text-xs font-semibold opacity-70 hover:opacity-100" (click)="dismiss.emit()">x</button>
      </div>
      <div class="h-1 w-full overflow-hidden rounded bg-slate-200/70" *ngIf="!sticky">
        <div class="h-full bg-current transition-all duration-150" [style.width.%]="progress"></div>
      </div>
    </div>
  `,
})
export class ToastComponent {
  @Input() text = '';
  @Input() variant: ToastVariant = 'info';
  @Input() sticky = false;
  @Input() progress = 100;
  @Output() dismiss = new EventEmitter<void>();

  get classes(): string {
    switch (this.variant) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-900';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-900';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-900';
      case 'info':
      default:
        return 'border-slate-200 bg-white text-slate-900';
    }
  }
}

