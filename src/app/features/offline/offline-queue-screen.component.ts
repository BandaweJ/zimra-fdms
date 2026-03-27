import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { OfflineQueueService, OfflineQueuedReceipt } from '../../core/services/offline-queue.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { DeviceOperatingMode } from '../../core/models/api.models';

@Component({
  selector: 'zimra-offline-queue-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">Offline Queue</h1>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Receipts stored locally and not yet submitted via file.</p>
          </div>
          <zimra-button variant="primary" [disabled]="buildDisabled()" (click)="goBuild()">Build File</zimra-button>
        </div>

        @if (warning()) {
          <div class="mb-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            {{ warning() }}
          </div>
        }

        <zimra-card>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">Invoice</th>
                  <th class="px-3 py-2">Global No</th>
                  <th class="px-3 py-2">Fiscal Day</th>
                  <th class="px-3 py-2">Type</th>
                  <th class="px-3 py-2">Total</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.localID) {
                  <tr class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-3 py-2">{{ r.receipt.invoiceNo }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptGlobalNo }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.fiscalDayNo }}</td>
                    <td class="px-3 py-2">{{ r.receipt.receiptType }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.receipt.receiptTotal }}</td>
                    <td class="px-3 py-2">{{ statusLabel(r) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class OfflineQueueScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly queue = inject(OfflineQueueService);
  private readonly fiscalDay = inject(FiscalDayService);

  readonly rows = signal<OfflineQueuedReceipt[]>([]);
  readonly warning = signal<string>('');
  readonly deviceID = signal<number | null>(null);
  readonly offlineMode = signal<boolean>(false);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    let id = this.ctx.getDeviceID();
    if (id == null) id = (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);
    if (id == null) return;
    this.rows.set(await this.queue.listReceipts(id));
    this.fiscalDay.getConfig({ deviceID: id }).subscribe({
      next: (cfg) => {
        this.offlineMode.set(cfg.deviceOperatingMode === DeviceOperatingMode.Offline);
        if (!this.offlineMode()) this.warning.set('Device is not in Offline mode. File submission screens are disabled by spec.');
      },
    });
  }

  statusLabel(r: OfflineQueuedReceipt): string {
    if (r.state === 'InFile') return `In file${r.fileSequence != null ? ` #${r.fileSequence}` : ''}`;
    return r.state;
  }

  buildDisabled(): boolean {
    return !this.offlineMode() || this.rows().filter((r) => r.state !== 'Sent').length === 0;
  }

  goBuild(): void {
    this.router.navigate(['/offline/build']);
  }
}

