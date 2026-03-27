import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { FiscalDayStatus, GetConfigResponse, GetStatusResponse, ReceiptType } from '../../core/models/api.models';
import { ReceiptHistoryService, StoredSubmittedReceipt } from '../../core/services/receipt-history.service';

function money(v: number): string {
  return v.toFixed(2);
}

function localYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Component({
  selector: 'zimra-zx-report-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <div class="mb-4 flex items-center justify-between">
          <h1 class="text-2xl font-semibold tracking-tight">{{ reportLabel() }}</h1>
          <div class="flex gap-2 print:hidden">
            <zimra-button variant="secondary" (click)="goHistory()">Receipt History</zimra-button>
            <zimra-button variant="primary" (click)="print()">Print</zimra-button>
          </div>
        </div>

        <zimra-card>
          <pre class="font-mono text-xs leading-5 whitespace-pre-wrap">
{{ reportText() }}
          </pre>
        </zimra-card>
      </div>
    </div>
  `,
})
export class ZxReportScreenComponent implements OnInit {
  private readonly fiscalDayService = inject(FiscalDayService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly receiptHistory = inject(ReceiptHistoryService);
  private readonly router = inject(Router);

  readonly status = signal<GetStatusResponse | null>(null);
  readonly config = signal<GetConfigResponse | null>(null);
  readonly receipts = signal<StoredSubmittedReceipt[]>([]);
  readonly deviceID = signal<number | null>(null);

  readonly reportLabel = computed(() => {
    const s = this.status()?.fiscalDayStatus;
    return s === FiscalDayStatus.FiscalDayClosed ? 'Z REPORT' : 'X REPORT';
  });

  async ngOnInit(): Promise<void> {
    let id = this.fdmsContext.getDeviceID();
    if (id == null) id = (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);
    if (!id) return;
    this.fiscalDayService.getConfig({ deviceID: id }).subscribe({ next: (c) => this.config.set(c) });
    this.fiscalDayService.getStatus({ deviceID: id }).subscribe({
      next: (s) => {
        this.status.set(s);
        const day = s.lastFiscalDayNo ?? 0;
        this.receipts.set(this.receiptHistory.listByFiscalDay(day));
      },
    });
  }

  reportText(): string {
    const cfg = this.config();
    const st = this.status();
    const rows = this.receipts();
    const dayNo = st?.lastFiscalDayNo ?? '-';
    const dayStatus = st?.fiscalDayStatus ?? '-';
    const opened = rows.length ? rows[rows.length - 1].receipt.receiptDate.slice(0, 10) : localYmd(new Date());

    const byCurrency = new Map<string, number>();
    for (const r of rows) {
      const c = r.receipt.receiptCurrency;
      byCurrency.set(c, (byCurrency.get(c) ?? 0) + r.receipt.receiptTotal);
    }

    const taxRows = new Map<string, { taxRate: string; net: number; tax: number; gross: number }>();
    for (const r of rows) {
      for (const t of r.receipt.receiptTaxes) {
        const rate = t.taxPercent == null ? '-' : `${t.taxPercent}`;
        const key = `${r.receipt.receiptCurrency}|${rate}`;
        const curr = taxRows.get(key) ?? { taxRate: rate, net: 0, tax: 0, gross: 0 };
        const gross = t.salesAmountWithTax;
        const tax = t.taxAmount;
        curr.gross += gross;
        curr.tax += tax;
        curr.net += gross - tax;
        taxRows.set(key, curr);
      }
    }

    const docCounts = {
      invoice: rows.filter((r) => r.receipt.receiptType === ReceiptType.FiscalInvoice).length,
      credit: rows.filter((r) => r.receipt.receiptType === ReceiptType.CreditNote).length,
      debit: rows.filter((r) => r.receipt.receiptType === ReceiptType.DebitNote).length,
      total: rows.length,
    };

    const lines: string[] = [];
    lines.push(`${this.reportLabel()}`.padEnd(48, ' '));
    lines.push('='.repeat(48));
    lines.push(`Taxpayer : ${cfg?.taxPayerName ?? '-'}`);
    lines.push(`TIN      : ${cfg?.taxPayerTIN ?? '-'}`);
    lines.push(`VAT      : ${cfg?.vatNumber ?? '-'}`);
    lines.push(`Branch   : ${cfg?.deviceBranchName ?? '-'}`);
    lines.push('-'.repeat(48));
    lines.push(`FiscalDayNo : ${dayNo}`);
    lines.push(`Status      : ${dayStatus}`);
    lines.push(`FiscalDate  : ${opened}`);
    lines.push('-'.repeat(48));
    lines.push('DAILY TOTALS BY CURRENCY');
    for (const [c, v] of byCurrency.entries()) lines.push(`  ${c.padEnd(6)} ${money(v).padStart(14)}`);
    if (!byCurrency.size) lines.push('  -');
    lines.push('-'.repeat(48));
    lines.push('NET / TAX / GROSS BY TAX RATE');
    for (const [k, v] of taxRows.entries()) {
      const [cur] = k.split('|');
      lines.push(`  ${cur} rate ${v.taxRate}%`);
      lines.push(`    NET  ${money(v.net).padStart(12)} TAX ${money(v.tax).padStart(12)} GROSS ${money(v.gross).padStart(12)}`);
    }
    if (!taxRows.size) lines.push('  -');
    lines.push('-'.repeat(48));
    lines.push('DOCUMENT COUNTS');
    lines.push(`  Invoices    : ${String(docCounts.invoice).padStart(8)}`);
    lines.push(`  CreditNotes : ${String(docCounts.credit).padStart(8)}`);
    lines.push(`  DebitNotes  : ${String(docCounts.debit).padStart(8)}`);
    lines.push(`  Total       : ${String(docCounts.total).padStart(8)}`);
    lines.push('='.repeat(48));
    return lines.join('\n');
  }

  goHistory(): void {
    void this.router.navigate(['/reports/history']);
  }

  print(): void {
    window.print();
  }
}

