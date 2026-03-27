import { Component, Input } from '@angular/core';

@Component({
  selector: 'zimra-fiscal-counter-card',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="text-xs font-semibold text-slate-500">Fiscal Counter</div>
      <div class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {{ value }}
      </div>
      <div class="mt-1 text-xs text-slate-500">Placeholder counter display.</div>
    </div>
  `,
})
export class FiscalCounterCardComponent {
  @Input() value = 0;
}

