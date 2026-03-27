import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FileService } from '../../core/services/file.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { DeviceOperatingMode, FiscalDayStatus, SubmitFile } from '../../core/models/api.models';

type PartsMode = 'header' | 'header-content' | 'header-footer' | 'header-content-footer';

function localYmd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function localDateTimeNoTz(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

@Component({
  selector: 'zimra-file-builder-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">File Builder</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Build and submit offline file payload.</p>

        @if (error()) {
          <div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error() }}</div>
        }

        <zimra-card class="mt-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="text-xs font-semibold">Fiscal day no (closed day)</div>
              <input class="mt-1 w-full rounded border p-2" type="number" [value]="fiscalDayNo()" (input)="fiscalDayNo.set(+$any($event.target).value)" />
            </div>
            <div>
              <div class="text-xs font-semibold">File sequence</div>
              <input class="mt-1 w-full rounded border p-2" type="number" [value]="fileSequence()" readonly />
            </div>
            <div class="md:col-span-2">
              <div class="text-xs font-semibold">Parts</div>
              <select class="mt-1 w-full rounded border p-2" [value]="partsMode()" (change)="partsMode.set($any($event.target).value)">
                <option value="header">Header only</option>
                <option value="header-content">Header + Content</option>
                <option value="header-footer">Header + Footer</option>
                <option value="header-content-footer">Header + Content + Footer</option>
              </select>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-600 dark:text-slate-300">
            File size: {{ approxSizeKb() }} KB
            @if (sizeWarn()) {
              <span class="text-yellow-700"> — Approaching 3MB. Split by fiscal day/sequence.</span>
            }
          </div>
          @if (validationMsg()) {
            <div class="mt-2 text-xs text-red-600">{{ validationMsg() }}</div>
          }

          <div class="mt-5 flex justify-end gap-2">
            <zimra-button variant="secondary" (click)="router.navigate(['/offline'])">Back</zimra-button>
            <zimra-button variant="primary" [disabled]="submitDisabled()" (click)="submit()">Submit File</zimra-button>
          </div>
        </zimra-card>

        @if (operationID()) {
          <div class="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Submitted successfully. operationID: <span class="font-mono">{{ operationID() }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class FileBuilderScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly fileService = inject(FileService);
  private readonly queue = inject(OfflineQueueService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly fiscalDay = inject(FiscalDayService);

  readonly error = signal<string>('');
  readonly operationID = signal<string>('');
  readonly validationMsg = signal<string>('');
  readonly deviceID = signal<number | null>(null);
  readonly fiscalDayNo = signal<number>(1);
  readonly fileSequence = signal<number>(1);
  readonly partsMode = signal<PartsMode>('header-content-footer');
  readonly offlineMode = signal<boolean>(false);
  readonly fiscalDayStatus = signal<FiscalDayStatus | null>(null);

  readonly approxSizeKb = computed(() => {
    const payload = this.buildPayloadPreview();
    const json = JSON.stringify(payload);
    return Math.ceil((json.length * 1.37) / 1024); // approx base64 expansion
  });
  readonly sizeWarn = computed(() => this.approxSizeKb() > 2400);

  async ngOnInit(): Promise<void> {
    let id = this.ctx.getDeviceID();
    if (id == null) id = (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);
    if (id == null) return;
    this.fiscalDay.getConfig({ deviceID: id }).subscribe({ next: (cfg) => this.offlineMode.set(cfg.deviceOperatingMode === DeviceOperatingMode.Offline) });
    this.fiscalDay.getStatus({ deviceID: id }).subscribe({
      next: (s) => {
        this.fiscalDayNo.set(s.lastFiscalDayNo ?? 1);
        this.fiscalDayStatus.set(s.fiscalDayStatus);
        this.fileSequence.set(this.queue.getNextFileSequence(id!, this.fiscalDayNo()));
      },
    });
  }

  private async buildPayloadPreview(): Promise<SubmitFile>;
  private buildPayloadPreview(): SubmitFile;
  private buildPayloadPreview(): SubmitFile | Promise<SubmitFile> {
    const mode = this.partsMode();
    const id = this.deviceID() ?? 0;
    const day = this.fiscalDayNo();
    const header = { deviceID: id, fiscalDayNo: day, fiscalDayOpened: `${localYmd(new Date())}T00:00:00`, fileSequence: this.fileSequence() };
    const p: SubmitFile = { header };
    return p;
  }

  submitDisabled(): boolean {
    if (!this.deviceID()) return true;
    if (!this.offlineMode()) return true;
    if (!this.fiscalDayNo()) return true;
    return false;
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.validationMsg.set('');
    const id = this.deviceID();
    if (!id) return;
    if (!this.offlineMode()) {
      this.validationMsg.set('Only active when DeviceOperatingMode is Offline.');
      return;
    }
    if (this.fiscalDayStatus() !== FiscalDayStatus.FiscalDayClosed) {
      this.validationMsg.set('fiscalDayNo must be for a closed day.');
      return;
    }

    const queued = await this.queue.listReceipts(id, this.fiscalDayNo());
    const includeContent = this.partsMode() === 'header-content' || this.partsMode() === 'header-content-footer';
    const includeFooter = this.partsMode() === 'header-footer' || this.partsMode() === 'header-content-footer';
    const unsent = queued.filter((q) => q.state !== 'Sent');
    if (unsent.some((q) => q.fiscalDayNo !== this.fiscalDayNo())) {
      this.validationMsg.set('A submitFile payload must contain receipts for a single fiscal day only.');
      return;
    }
    if (includeFooter && unsent.length > 0) {
      this.validationMsg.set('Footer is allowed only in the last file for a fiscal day (no unsent receipts remaining).');
      return;
    }

    const payload: SubmitFile = {
      header: {
        deviceID: id,
        fiscalDayNo: this.fiscalDayNo(),
        fiscalDayOpened: `${localYmd(new Date())}T00:00:00`,
        fileSequence: this.fileSequence(),
      },
      ...(includeContent
        ? {
            content: {
              receipts: unsent.map((q) => q.receipt),
            },
          }
        : {}),
      ...(includeFooter
        ? {
            footer: {
              receiptCounter: Math.max(...queued.map((q) => q.receipt.receiptCounter), 0),
              fiscalDayClosed: localDateTimeNoTz(new Date()),
              fiscalDayDeviceSignature: { hash: '', signature: '' },
              fiscalDayCounters: [],
            },
          }
        : {}),
    };

    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json).byteLength;
    if (bytes > 3 * 1024 * 1024) {
      this.validationMsg.set('File exceeds 3MB limit. Split the fiscal day data into smaller sequential files.');
      return;
    }
    const base64 = btoa(unescape(encodeURIComponent(json)));
    this.fileService.submitFile({ deviceID: id, file: base64 }).subscribe({
      next: (res) => {
        const op = res.operationID;
        this.operationID.set(op);
        this.queue.commitFileSequence(id, this.fiscalDayNo(), this.fileSequence());
        const usedIDs = includeContent ? queued.filter((q) => q.state !== 'Sent').map((q) => q.localID) : [];
        void this.queue.updateState(usedIDs, 'InFile', this.fileSequence());
        this.queue.addSubmissionMeta({
          operationID: op,
          deviceID: id,
          fiscalDayNo: this.fiscalDayNo(),
          fileSequence: this.fileSequence(),
          queuedReceiptLocalIDs: usedIDs,
          createdAt: new Date().toISOString(),
        });
      },
      error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
    });
  }
}

