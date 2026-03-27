import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ReceiptType } from '../../core/models/api.models';
import { ReceiptHistoryService, ReceiptValidationLevel } from '../../core/services/receipt-history.service';

@Component({
  selector: 'zimra-receipt-history-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <div class="mb-4 flex items-center justify-between">
          <h1 class="text-2xl font-semibold tracking-tight">Receipt History</h1>
          <div class="flex gap-2">
            <zimra-button variant="secondary" (click)="goZx()">Back to Z/X Report</zimra-button>
            <zimra-button variant="primary" (click)="bulkPrint()">Bulk Print</zimra-button>
          </div>
        </div>

        <zimra-card>
          <div class="grid gap-3 md:grid-cols-5">
            <input class="rounded border p-2" type="date" [value]="fromDate()" (input)="fromDate.set($any($event.target).value)" />
            <input class="rounded border p-2" type="date" [value]="toDate()" (input)="toDate.set($any($event.target).value)" />
            <select class="rounded border p-2" [value]="typeFilter()" (change)="typeFilter.set($any($event.target).value)">
              <option value="">All types</option>
              <option [value]="ReceiptType.FiscalInvoice">FiscalInvoice</option>
              <option [value]="ReceiptType.CreditNote">CreditNote</option>
              <option [value]="ReceiptType.DebitNote">DebitNote</option>
            </select>
            <input class="rounded border p-2" placeholder="Currency" [value]="currencyFilter()" (input)="currencyFilter.set(($any($event.target).value || '').toUpperCase())" />
            <select class="rounded border p-2" [value]="validationFilter()" (change)="validationFilter.set($any($event.target).value)">
              <option value="">All validations</option>
              <option value="white">white</option>
              <option value="grey">grey</option>
              <option value="yellow">yellow</option>
              <option value="red">red</option>
            </select>
          </div>
        </zimra-card>

        <zimra-card class="mt-4">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">Date</th>
                  <th class="px-3 py-2">Invoice</th>
                  <th class="px-3 py-2">Type</th>
                  <th class="px-3 py-2">Currency</th>
                  <th class="px-3 py-2">Total</th>
                  <th class="px-3 py-2">Validation</th>
                </tr>
              </thead>
              <tbody>
                @for (r of filtered(); track r.localID) {
                  <tr class="border-t border-slate-200 dark:border-slate-800 cursor-pointer" (click)="toggle(r.localID)">
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptDate }}</td>
                    <td class="px-3 py-2">{{ r.receipt.invoiceNo }}</td>
                    <td class="px-3 py-2">{{ r.receipt.receiptType }}</td>
                    <td class="px-3 py-2">{{ r.receipt.receiptCurrency }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptTotal }}</td>
                    <td class="px-3 py-2">{{ r.validationLevel }}</td>
                  </tr>
                  @if (expanded() === r.localID) {
                    <tr class="border-t border-slate-100 dark:border-slate-900">
                      <td colspan="6" class="px-3 py-2">
                        <pre class="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">{{ asJson(r) }}</pre>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class ReceiptHistoryScreenComponent {
  private readonly history = inject(ReceiptHistoryService);
  private readonly router = inject(Router);
  readonly ReceiptType = ReceiptType;

  readonly expanded = signal<string>('');
  readonly fromDate = signal<string>('');
  readonly toDate = signal<string>('');
  readonly typeFilter = signal<string>('');
  readonly currencyFilter = signal<string>('');
  readonly validationFilter = signal<string>('');

  readonly filtered = computed(() => {
    return this.history.listAll().filter((r) => {
      const d = r.receipt.receiptDate.slice(0, 10);
      if (this.fromDate() && d < this.fromDate()) return false;
      if (this.toDate() && d > this.toDate()) return false;
      if (this.typeFilter() !== '' && String(r.receipt.receiptType) !== this.typeFilter()) return false;
      if (this.currencyFilter() && r.receipt.receiptCurrency.toUpperCase() !== this.currencyFilter()) return false;
      if (this.validationFilter() && r.validationLevel !== (this.validationFilter() as ReceiptValidationLevel)) return false;
      return true;
    });
  });

  toggle(id: string): void {
    this.expanded.set(this.expanded() === id ? '' : id);
  }

  asJson(v: unknown): string {
    return JSON.stringify(v, null, 2);
  }

  bulkPrint(): void {
    const items = this.filtered();
    const html = `
      <html><head><title>Bulk Receipt History</title><style>body{font-family:monospace;padding:16px;} pre{white-space:pre-wrap;border:1px solid #ddd;padding:10px;margin-bottom:12px;}</style></head>
      <body>
      ${items.map((i) => `<pre>${this.escapeHtml(this.asJson(i.receipt))}</pre>`).join('')}
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  goZx(): void {
    void this.router.navigate(['/reports/zx']);
  }
}

