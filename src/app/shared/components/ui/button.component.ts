import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'zimra-button',
  standalone: true,
  imports: [NgClass],
  template: `
    <button
      type="button"
      [disabled]="disabled || loading"
      (click)="buttonClick.emit()"
      class="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition
             disabled:cursor-not-allowed disabled:opacity-50"
      [ngClass]="[variantClasses, sizeClasses]"
    >
      @if (loading) {
        <span
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        ></span>
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  @Input() disabled = false;
  @Input() loading = false;
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() buttonClick = new EventEmitter<void>();

  get variantClasses(): string {
    switch (this.variant) {
      case 'secondary':
        return 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700';
      case 'ghost':
        return 'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800';
      case 'primary':
      default:
        return 'bg-zimra-gold text-slate-900 hover:bg-yellow-500';
    }
  }

  get sizeClasses(): string {
    switch (this.size) {
      case 'sm':
        return 'px-3 py-1.5 text-xs';
      case 'lg':
        return 'px-5 py-3 text-base';
      case 'md':
      default:
        return 'px-4 py-2 text-sm';
    }
  }
}


