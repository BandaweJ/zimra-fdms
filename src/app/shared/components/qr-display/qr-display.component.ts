import { Component, Input } from '@angular/core';

@Component({
  selector: 'zimra-qr-display',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="mb-3 text-sm font-semibold text-slate-900">Receipt QR</div>
      <div class="flex items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6">
        <div class="text-xs font-semibold text-slate-400">QR will render here</div>
      </div>
    </div>
  `,
})
export class QrDisplayComponent {
  @Input() value = '';
}

