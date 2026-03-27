import { Component, Input } from '@angular/core';
import { ReceiptPrintForm } from '../../../core/models/enums';

@Component({
  selector: 'zimra-receipt-preview',
  standalone: true,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-sm font-semibold text-slate-900">Receipt Preview</div>
        <span class="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {{ typeLabel }}
        </span>
      </div>

      <div class="border border-dashed border-slate-200 rounded-xl p-4 text-sm text-slate-500">
        Placeholder renderer for the spec-defined Receipt48 / InvoiceA4 layout.
      </div>
    </div>
  `,
})
export class ReceiptPreviewComponent {
  @Input() receiptPrintForm: ReceiptPrintForm = ReceiptPrintForm.Receipt48;

  get typeLabel(): string {
    return this.receiptPrintForm === ReceiptPrintForm.InvoiceA4 ? 'Invoice A4' : 'Receipt 48';
  }
}

