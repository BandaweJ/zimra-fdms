import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export type BadgeColor = 'grey' | 'yellow' | 'red' | 'green' | 'blue';
export type BadgeStyle = 'solid' | 'outlined';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'zimra-badge',
  standalone: true,
  imports: [NgClass],
  template: `
    <span class="inline-flex items-center rounded-full font-semibold" [ngClass]="[classes, sizeClasses]">
      {{ text }}
    </span>
  `,
})
export class BadgeComponent {
  @Input({ required: true }) text!: string;
  @Input() color: BadgeColor = 'grey';
  // Backward-compatible alias.
  @Input() variant: BadgeColor = 'grey';
  @Input() style: BadgeStyle = 'solid';
  @Input() size: BadgeSize = 'md';

  get classes(): string {
    const color = this.color ?? this.variant;
    if (this.style === 'outlined') {
      switch (color) {
        case 'green':
          return 'bg-transparent text-emerald-800 border border-emerald-300';
        case 'yellow':
          return 'bg-transparent text-yellow-900 border border-yellow-300';
        case 'red':
          return 'bg-transparent text-red-800 border border-red-300';
        case 'blue':
          return 'bg-transparent text-blue-800 border border-blue-300';
        case 'grey':
        default:
          return 'bg-transparent text-slate-700 border border-slate-300';
      }
    }
    switch (color) {
      case 'green':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-100';
      case 'yellow':
        return 'bg-yellow-50 text-yellow-900 border border-yellow-200';
      case 'red':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'blue':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'grey':
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  }

  get sizeClasses(): string {
    return this.size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';
  }
}

