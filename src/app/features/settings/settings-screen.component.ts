import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { ApiService } from '../../core/services/api.service';
import { StorageService } from '../../core/services/storage.service';
import { OfflineQueueService, OfflineQueuedReceipt } from '../../core/services/offline-queue.service';
import { GetConfigResponse } from '../../core/models/api.models';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';

const TESTING_URL = 'https://fdmsapitest.zimra.co.zw';
const PRODUCTION_URL = 'https://fdmsapi.zimra.co.zw';
const CONFIG_CACHE_KEY = 'zimra:settings:config-cache:v1';

@Component({
  selector: 'zimra-settings-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent, ModalComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Device configuration, environment selection, and offline storage tools.
        </p>

        <div class="mt-6 grid gap-6">
          <zimra-card>
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-lg font-semibold">Device Config Viewer</div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Read-only getConfig details for current device.
                </div>
              </div>
              <zimra-button variant="primary" (click)="refreshConfig()">Refresh config</zimra-button>
            </div>

            @if (configError()) {
              <div class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {{ configError() }}
              </div>
            }

            @if (config()) {
              <div class="mt-4 grid gap-4 lg:grid-cols-2">
                <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div class="mb-2 text-xs font-semibold text-slate-500">Field values</div>
                  <div class="grid gap-2 text-sm">
                    @for (f of configFields(); track f.key) {
                      <div class="grid grid-cols-[170px_1fr] gap-3">
                        <div class="font-semibold text-slate-700 dark:text-slate-300">{{ f.key }}</div>
                        <div class="break-all font-mono text-xs">{{ f.value }}</div>
                      </div>
                    }
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div class="mb-2 text-xs font-semibold text-slate-500">Raw getConfig JSON</div>
                  <pre class="max-h-80 overflow-auto rounded bg-slate-50 p-2 text-xs">{{ configJson() }}</pre>
                </div>
              </div>

              <div class="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div class="text-sm font-semibold">Applicable Taxes</div>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="text-xs text-slate-500">
                      <tr>
                        <th class="px-2 py-1">Tax ID</th>
                        <th class="px-2 py-1">Name</th>
                        <th class="px-2 py-1">Rate</th>
                        <th class="px-2 py-1">Valid From</th>
                        <th class="px-2 py-1">Valid Till</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (t of config()!.applicableTaxes; track t.taxID) {
                        <tr class="border-t border-slate-200 dark:border-slate-800">
                          <td class="px-2 py-1 font-mono">{{ t.taxID }}</td>
                          <td class="px-2 py-1">{{ t.taxName }}</td>
                          <td class="px-2 py-1">{{ t.taxPercent ?? '-' }}</td>
                          <td class="px-2 py-1 font-mono">{{ t.taxValidFrom }}</td>
                          <td class="px-2 py-1 font-mono">{{ t.taxValidTill ?? '-' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </zimra-card>

          <zimra-card>
            <div class="text-lg font-semibold">Environment Switcher</div>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Current base URL: <span class="font-mono">{{ currentBaseUrl() }}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <zimra-button variant="secondary" (click)="switchEnvironment(TESTING_URL)">Use Testing</zimra-button>
              <zimra-button variant="secondary" (click)="switchEnvironment(PRODUCTION_URL)">Use Production</zimra-button>
              <a class="text-sm underline" [href]="testingSwaggerUrl" target="_blank" rel="noreferrer">Testing Swagger UI</a>
            </div>
          </zimra-card>

          <zimra-card>
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-lg font-semibold">Offline Storage Manager</div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Inspect IndexedDB/local cache, clear queue, and export receipts.
                </div>
              </div>
              <zimra-button variant="secondary" (click)="refreshStorage()">Refresh storage</zimra-button>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div class="text-xs font-semibold text-slate-500">Offline receipts (IndexedDB)</div>
                <div class="mt-2 text-2xl font-semibold">{{ offlineReceipts().length }}</div>
              </div>
              <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div class="text-xs font-semibold text-slate-500">Device certificates (IndexedDB)</div>
                <div class="mt-2 text-2xl font-semibold">{{ deviceCertificates().length }}</div>
              </div>
              <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div class="text-xs font-semibold text-slate-500">Config cache entries</div>
                <div class="mt-2 text-2xl font-semibold">{{ configCache() ? 1 : 0 }}</div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <zimra-button variant="secondary" (click)="exportReceipts()">Export receipts JSON</zimra-button>
              <zimra-button variant="secondary" (click)="confirmClearQueue()">Clear offline queue</zimra-button>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div class="mb-2 text-xs font-semibold text-slate-500">Offline receipts preview</div>
                <pre class="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{{ offlineReceiptsPreview() }}</pre>
              </div>
              <div>
                <div class="mb-2 text-xs font-semibold text-slate-500">Config cache preview</div>
                <pre class="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{{ configCachePreview() }}</pre>
              </div>
            </div>
          </zimra-card>
        </div>
      </div>
    </div>

    <zimra-modal [open]="switchConfirmOpen()" (closed)="switchConfirmOpen.set(false)">
      <div modal-title>Confirm environment switch</div>
      <div class="text-sm">
        Switch API base URL to
        <span class="font-mono">{{ pendingEnvironment() }}</span>?
        @if (pendingEnvironment() === PRODUCTION_URL) {
          <div class="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
            Production mode affects live data. Confirm only when intended.
          </div>
        }
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <zimra-button variant="secondary" (click)="switchConfirmOpen.set(false)">Cancel</zimra-button>
        <zimra-button variant="primary" (click)="confirmSwitchEnvironment()">Confirm switch</zimra-button>
      </div>
    </zimra-modal>

    <zimra-modal [open]="clearQueueConfirmOpen()" (closed)="clearQueueConfirmOpen.set(false)">
      <div modal-title>Clear offline queue</div>
      <div class="text-sm">
        This will permanently remove all queued offline receipts from IndexedDB.
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <zimra-button variant="secondary" (click)="clearQueueConfirmOpen.set(false)">Cancel</zimra-button>
        <zimra-button variant="primary" (click)="clearOfflineQueue()">Clear queue</zimra-button>
      </div>
    </zimra-modal>
  `,
})
export class SettingsScreenComponent implements OnInit {
  readonly TESTING_URL = TESTING_URL;
  readonly PRODUCTION_URL = PRODUCTION_URL;
  readonly testingSwaggerUrl = `${TESTING_URL}/swagger`;

  private readonly fiscalDay = inject(FiscalDayService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly offline = inject(OfflineQueueService);

  readonly config = signal<GetConfigResponse | null>(null);
  readonly configError = signal<string | null>(null);
  readonly currentBaseUrl = signal<string>('');
  readonly pendingEnvironment = signal<string>('');
  readonly switchConfirmOpen = signal<boolean>(false);
  readonly clearQueueConfirmOpen = signal<boolean>(false);

  readonly offlineReceipts = signal<OfflineQueuedReceipt[]>([]);
  readonly deviceCertificates = signal<Array<{ deviceID: number; deviceSerialNo: string; validFrom: string; validTill: string }>>([]);
  readonly configCache = signal<GetConfigResponse | null>(null);

  readonly configFields = computed(() => {
    const c = this.config();
    if (!c) return [] as Array<{ key: string; value: string }>;
    return Object.entries(c).map(([key, value]) => {
      const isObj = typeof value === 'object' && value != null;
      return { key, value: isObj ? JSON.stringify(value) : String(value) };
    });
  });

  readonly configJson = computed(() => JSON.stringify(this.config(), null, 2));
  readonly configCachePreview = computed(() => JSON.stringify(this.configCache(), null, 2));
  readonly offlineReceiptsPreview = computed(() => JSON.stringify(this.offlineReceipts().slice(0, 30), null, 2));

  async ngOnInit(): Promise<void> {
    this.currentBaseUrl.set(this.fdmsContext.getBaseUrl());
    await Promise.all([this.refreshConfig(), this.refreshStorage()]);
  }

  async refreshConfig(): Promise<void> {
    this.configError.set(null);
    const deviceID = this.fdmsContext.getDeviceID() ?? (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    if (!deviceID) {
      this.configError.set('Device ID is missing. Complete setup first.');
      return;
    }
    this.fiscalDay.getConfig({ deviceID }).subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cfg));
        this.configCache.set(cfg);
      },
      error: (e) => this.configError.set(e instanceof Error ? e.message : String(e)),
    });
  }

  async refreshStorage(): Promise<void> {
    const [receipts, certs] = await Promise.all([this.offline.listAllReceipts(), this.storage.listDeviceCertificates()]);
    this.offlineReceipts.set(receipts);
    this.deviceCertificates.set(certs);
    this.configCache.set(this.readConfigCache());
  }

  switchEnvironment(url: string): void {
    this.pendingEnvironment.set(url);
    this.switchConfirmOpen.set(true);
  }

  confirmSwitchEnvironment(): void {
    const url = this.pendingEnvironment();
    if (!url) return;
    this.fdmsContext.setBaseUrl(url);
    this.api.setBaseUrl(url);
    this.currentBaseUrl.set(url);
    this.switchConfirmOpen.set(false);
  }

  confirmClearQueue(): void {
    this.clearQueueConfirmOpen.set(true);
  }

  async clearOfflineQueue(): Promise<void> {
    await this.offline.clearAllReceipts();
    this.clearQueueConfirmOpen.set(false);
    await this.refreshStorage();
  }

  exportReceipts(): void {
    const payload = {
      exportedAt: new Date().toISOString(),
      count: this.offlineReceipts().length,
      receipts: this.offlineReceipts(),
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-receipts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private readConfigCache(): GetConfigResponse | null {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GetConfigResponse;
    } catch {
      return null;
    }
  }
}

