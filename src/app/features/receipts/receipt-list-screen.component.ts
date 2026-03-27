import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { StorageService } from '../../core/services/storage.service';
import { ReceiptHistoryService, StoredSubmittedReceipt } from '../../core/services/receipt-history.service';
import { ValidationBadgeComponent } from '../../shared/components/validation-badge/validation-badge.component';

@Component({
  selector: 'zimra-receipt-list-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent, ValidationBadgeComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Receipt List</h1>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Submitted receipts for current fiscal day.</p>
          </div>
          <zimra-button variant="primary" (click)="router.navigate(['/receipts/new'])">New Receipt</zimra-button>
        </div>

        <zimra-card>
          <div class="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Current fiscal day: <span class="font-mono font-semibold">{{ fiscalDayNo() ?? '-' }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs font-semibold text-slate-500">
                <tr>
                  <th class="px-3 py-2">#</th>
                  <th class="px-3 py-2">Invoice No</th>
                  <th class="px-3 py-2">Date</th>
                  <th class="px-3 py-2">Type</th>
                  <th class="px-3 py-2">Currency</th>
                  <th class="px-3 py-2">Total</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.localID; let i = $index) {
                  <tr class="border-t border-slate-200 dark:border-slate-800 cursor-pointer" (click)="toggleExpand(r.localID)">
                    <td class="px-3 py-2 font-mono">{{ i + 1 }}</td>
                    <td class="px-3 py-2">{{ r.receipt.invoiceNo }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptDate }}</td>
                    <td class="px-3 py-2">{{ r.receipt.receiptType }}</td>
                    <td class="px-3 py-2">{{ r.receipt.receiptCurrency }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptTotal }}</td>
                    <td class="px-3 py-2">
                      <zimra-validation-badge [color]="r.validationLevel" [codes]="r.validationCodes ?? []" />
                    </td>
                  </tr>
                  @if (expandedID() === r.localID) {
                    <tr class="border-t border-slate-100 dark:border-slate-900">
                      <td colspan="7" class="px-3 py-3">
                        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
                          <div>Receipt ID: <span class="font-mono">{{ r.response.receiptID }}</span></div>
                          <div>Operation ID: <span class="font-mono">{{ r.response.operationID }}</span></div>
                          <div>Server Date: <span class="font-mono">{{ r.response.serverDate }}</span></div>
                          <div class="mt-2 flex justify-end">
                            <zimra-button variant="secondary" (click)="openPrint(r.localID)">Print View</zimra-button>
                          </div>
                        </div>
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
export class ReceiptListScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly fiscalDay = inject(FiscalDayService);
  private readonly history = inject(ReceiptHistoryService);

  readonly fiscalDayNo = signal<number | null>(null);
  readonly expandedID = signal<string | null>(null);
  readonly rows = computed<StoredSubmittedReceipt[]>(() => {
    const day = this.fiscalDayNo();
    if (day == null) return [];
    return this.history.listByFiscalDay(day);
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    let deviceID = this.fdmsContext.getDeviceID();
    if (deviceID == null) {
      const cert = await this.storage.getAnyDeviceCertificate();
      deviceID = cert?.deviceID ?? null;
    }
    if (deviceID == null) return;
    this.fiscalDay.getStatus({ deviceID }).subscribe({
      next: (s) => this.fiscalDayNo.set(s.lastFiscalDayNo ?? null),
    });
  }

  toggleExpand(id: string): void {
    this.expandedID.set(this.expandedID() === id ? null : id);
  }

  openPrint(id: string): void {
    this.router.navigate(['/receipts/print', id]);
  }

}

