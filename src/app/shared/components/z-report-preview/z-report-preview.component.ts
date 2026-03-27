import { Component } from '@angular/core';

@Component({
  selector: 'zimra-z-report-preview',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="mb-2 text-sm font-semibold text-slate-900">Z / X Report Preview</div>
      <div class="border border-dashed border-slate-200 rounded-xl p-4 text-sm text-slate-500">
        Placeholder renderer for Z/X report print views.
      </div>
    </div>
  `,
})
export class ZReportPreviewComponent {}

