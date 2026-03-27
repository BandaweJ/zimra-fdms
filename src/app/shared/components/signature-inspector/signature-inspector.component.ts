import { Component, Input } from '@angular/core';

@Component({
  selector: 'zimra-signature-inspector',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="mb-2 text-sm font-semibold text-slate-900">Signature Inspector</div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <div class="mb-1 text-xs font-semibold text-slate-500">Payload</div>
          <pre class="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
{{ payload ?? '—' }}
          </pre>
        </div>
        <div>
          <div class="mb-1 text-xs font-semibold text-slate-500">Signature</div>
          <pre class="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
{{ signature ?? '—' }}
          </pre>
        </div>
      </div>
      <div class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Placeholder: implement verification logic matching spec sections 13.1–13.3.
      </div>
    </div>
  `,
})
export class SignatureInspectorComponent {
  @Input() payload?: string;
  @Input() signature?: string;
}

