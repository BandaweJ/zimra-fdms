import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export type StepState = 'pending' | 'active' | 'complete' | 'error';
export interface StepperStep {
  label: string;
  state: StepState;
}

@Component({
  selector: 'zimra-stepper',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="hidden gap-3 md:flex">
      @for (s of steps; track $index) {
        <div class="flex items-center gap-2">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" [ngClass]="stepClass(s.state)">
            {{ marker(s.state) }}
          </span>
          <span class="text-sm">{{ s.label }}</span>
        </div>
      }
    </div>

    <div class="grid gap-2 md:hidden">
      @for (s of steps; track $index) {
        <div class="flex items-center gap-2">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" [ngClass]="stepClass(s.state)">
            {{ marker(s.state) }}
          </span>
          <span class="text-sm">{{ s.label }}</span>
        </div>
      }
    </div>
  `,
})
export class StepperComponent {
  @Input() steps: StepperStep[] = [];

  marker(state: StepState): string {
    if (state === 'complete') return '✓';
    if (state === 'error') return 'x';
    return '•';
  }

  stepClass(state: StepState): string {
    switch (state) {
      case 'active':
        return 'bg-zimra-gold text-slate-900 animate-pulse';
      case 'complete':
        return 'bg-emerald-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'pending':
      default:
        return 'bg-slate-200 text-slate-700';
    }
  }
}
