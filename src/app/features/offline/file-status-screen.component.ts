import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FileService } from '../../core/services/file.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { FileProcessingError, FileProcessingStatus, FileStatus } from '../../core/models/api.models';
import { OfflineQueueService } from '../../core/services/offline-queue.service';

@Component({
  selector: 'zimra-file-status-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">File Status</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Track submitFile processing status.</p>

        <zimra-card class="mt-4">
          <div class="grid gap-3 md:grid-cols-3">
            <input class="rounded border p-2" placeholder="operationID" [value]="operationID()" (input)="operationID.set($any($event.target).value)" />
            <input class="rounded border p-2" type="date" [value]="fromDate()" (input)="fromDate.set($any($event.target).value)" />
            <input class="rounded border p-2" type="date" [value]="toDate()" (input)="toDate.set($any($event.target).value)" />
          </div>
          <div class="mt-3 flex justify-end">
            <zimra-button variant="primary" (click)="load()">Load Status</zimra-button>
          </div>
        </zimra-card>

        <zimra-card class="mt-4">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">OperationID</th>
                  <th class="px-3 py-2">Day</th>
                  <th class="px-3 py-2">Seq</th>
                  <th class="px-3 py-2">Status</th>
                  <th class="px-3 py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.operationId + '-' + r.fileSequence) {
                  <tr class="border-t border-slate-200 dark:border-slate-800">
                    <td class="px-3 py-2 font-mono">{{ r.operationId }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.dayNo }}</td>
                    <td class="px-3 py-2 font-mono">{{ r.fileSequence }}</td>
                    <td class="px-3 py-2">{{ statusLabel(r.fileProcessingStatus) }}</td>
                    <td class="px-3 py-2 text-xs">
                      @if ((r.fileProcessingError ?? []).length) {
                        @for (e of (r.fileProcessingError ?? []); track $index) {
                          <div>{{ e }} - {{ errorExplain(e) }}</div>
                        }
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </zimra-card>

        @if (missingSequenceMsg()) {
          <div class="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            {{ missingSequenceMsg() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class FileStatusScreenComponent implements OnInit, OnDestroy {
  private readonly fileService = inject(FileService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly queue = inject(OfflineQueueService);

  readonly operationID = signal<string>('');
  readonly fromDate = signal<string>(new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10));
  readonly toDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly rows = signal<FileStatus[]>([]);
  readonly deviceID = signal<number | null>(null);
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly missingSequenceMsg = computed(() => {
    const waiting = this.rows().filter((r) => r.fileProcessingStatus === FileProcessingStatus.WaitingForPreviousFile);
    if (!waiting.length) return '';
    const missing = waiting.map((w) => Math.max(1, w.fileSequence - 1)).join(', ');
    return `WaitingForPreviousFile: likely missing file sequence(s) ${missing}.`;
  });

  async ngOnInit(): Promise<void> {
    let id = this.ctx.getDeviceID();
    if (id == null) id = (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);
    this.operationID.set(this.queue.getLastOperationID());
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  load(): void {
    const id = this.deviceID();
    if (!id) return;
    this.fileService
      .getFileStatus({
        deviceID: id,
        operationID: this.operationID().trim() || undefined,
        fileUploadedFrom: this.fromDate(),
        fileUploadedTill: this.toDate(),
      })
      .subscribe({
        next: (res) => {
          const rows = res.rows ?? [];
          this.rows.set(rows);
          this.syncQueueStates(rows);
          const hasInProgress = rows.some((r) => r.fileProcessingStatus === FileProcessingStatus.FileProcessingInProgress);
          if (hasInProgress) this.startPolling();
          else if (this.pollTimer) clearInterval(this.pollTimer);
        },
      });
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.load(), 10_000);
  }

  private syncQueueStates(rows: FileStatus[]): void {
    for (const row of rows) {
      if (!row.operationId) continue;
      const meta = this.queue.findByOperationID(row.operationId);
      if (!meta) continue;
      if (row.fileProcessingStatus === FileProcessingStatus.FileProcessingIsSuccessful) {
        void this.queue.updateState(meta.queuedReceiptLocalIDs, 'Sent', meta.fileSequence);
      } else if (row.fileProcessingStatus === FileProcessingStatus.FileProcessingInProgress) {
        void this.queue.updateState(meta.queuedReceiptLocalIDs, 'InFile', meta.fileSequence);
      }
    }
  }

  statusLabel(s: FileProcessingStatus): string {
    switch (s) {
      case FileProcessingStatus.FileProcessingInProgress:
        return 'FileProcessingInProgress';
      case FileProcessingStatus.FileProcessingIsSuccessful:
        return 'FileProcessingIsSuccessful';
      case FileProcessingStatus.FileProcessingWithErrors:
        return 'FileProcessingWithErrors';
      case FileProcessingStatus.WaitingForPreviousFile:
        return 'WaitingForPreviousFile';
      default:
        return String(s);
    }
  }

  errorExplain(e: FileProcessingError): string {
    switch (e) {
      case FileProcessingError.IncorrectFileFormat:
        return 'File structure/sequence is invalid.';
      case FileProcessingError.FileSentForClosedDay:
        return 'File sent for already closed day.';
      case FileProcessingError.BadCertificateSignature:
        return 'Bad certificate signature.';
      case FileProcessingError.MissingReceipts:
        return 'Missing receipts (Grey).';
      case FileProcessingError.ReceiptsWithValidationErrors:
        return 'Receipts with validation errors (Red).';
      case FileProcessingError.CountersMismatch:
        return 'Counters mismatch.';
      case FileProcessingError.FileExceededAllowedWaitingTime:
        return 'Previous file missing for too long.';
      default:
        return 'Unknown file processing error.';
    }
  }
}

