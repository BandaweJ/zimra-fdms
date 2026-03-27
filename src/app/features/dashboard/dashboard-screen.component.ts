import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { PingService } from '../../core/services/ping.service';
import { StorageService } from '../../core/services/storage.service';
import {
  DeviceOperatingMode,
  FiscalDayStatus,
  FiscalDayProcessingError,
  GetConfigResponse,
  GetStatusResponse,
  OpenDayResponse,
  PingResponse,
} from '../../core/models/api.models';
import { interval, Subscription } from 'rxjs';

type ConnectionState = 'connected' | 'disconnected' | 'unknown';

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toLocalDateTimeNoTz(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

@Component({
  selector: 'zimra-dashboard-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent, NgClass],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <!-- Header -->
      <div class="border-b border-zimra-border bg-white/70 backdrop-blur dark:border-zimra-border-dark dark:bg-zimra-charcoal/70">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="h-2.5 w-2.5 rounded-full" [ngClass]="connectionDotClass()"></div>
            <div class="text-sm font-semibold">Dashboard</div>
          </div>

          <div class="text-xs text-slate-500 dark:text-slate-300">
            @if (lastPingAt()) {
              <span>Last ping: {{ formatDateTime(lastPingAt()!) }}</span>
            } @else {
              <span>Connecting...</span>
            }
          </div>
        </div>
      </div>

      <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <!-- Sidebar -->
        <aside class="rounded-2xl border border-zimra-border bg-white p-4 shadow-sm dark:border-zimra-border-dark dark:bg-zimra-charcoal">
          <div class="mb-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Navigation</div>
          <nav class="flex flex-col gap-2">
            <button class="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
              [ngClass]="navClass('/dashboard', true)"
              (click)="router.navigate(['/dashboard'])">
              Dashboard
            </button>
            <button class="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
              [ngClass]="navClass('/fiscal-day', false)"
              (click)="router.navigate(['/fiscal-day'])">
              Fiscal Day
            </button>
            <button class="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
              [ngClass]="navClass('/receipts', false)"
              (click)="router.navigate(['/receipts'])">
              Receipts
            </button>
            <button class="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
              [ngClass]="navClass('/reports', false)"
              (click)="router.navigate(['/reports'])">
              Z / X Reports
            </button>
            <button class="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
              [ngClass]="navClass('/settings', false)"
              (click)="router.navigate(['/settings'])">
              Settings
            </button>
          </nav>

          <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-zimra-charcoal-light dark:text-slate-300">
            Device model headers are required before API calls.
          </div>
        </aside>

        <!-- Main -->
        <main class="flex flex-col gap-6">
          @if (loadError()) {
            <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {{ loadError() }}
            </div>
          }

          <!-- Status card -->
          <zimra-card>
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex-1">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Fiscal Day Status</div>
                <div class="mt-2 flex flex-wrap items-center gap-3">
                  <div class="rounded-2xl border px-4 py-2 text-sm font-semibold" [ngClass]="fiscalStatusBadgeClass()">
                    {{ fiscalDayStatusLabel() }}
                  </div>
                  <div class="text-sm">
                    Day No: <span class="font-mono font-semibold">{{ fiscalDayNoLabel() }}</span>
                  </div>
                </div>

                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Time since opened</div>
                    <div class="mt-1 font-mono text-base font-semibold">
                      {{ timeSinceOpenedLabel() }}
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    @if (hardStopEnabled()) {
                      <div class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                        Hard stop: max {{ config()?.taxPayerDayMaxHrs ?? '-' }}h exceeded
                      </div>
                    } @else if (warningEnabled()) {
                      <div class="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
                        Warning: {{ config()?.taxpayerDayEndNotificationHrs ?? '-' }}h threshold approaching
                      </div>
                    } @else {
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        No time warnings
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="sm:w-72">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Quick Actions</div>
                <div class="mt-3 flex flex-col gap-3">
                  <zimra-button class="w-full" variant="primary" [disabled]="openDisabled()" (click)="router.navigate(['/fiscal-day/open'])">
                    Open Fiscal Day
                  </zimra-button>

                  <zimra-button class="w-full" variant="secondary" [disabled]="submitDisabled()" (click)="goSubmitReceipt()">
                    Submit Receipt
                  </zimra-button>

                  <zimra-button
                    class="w-full"
                    variant="secondary"
                    [disabled]="closeDisabled()"
                    (click)="router.navigate(['/fiscal-day/close'])"
                  >
                    Close Fiscal Day
                  </zimra-button>
                  @if (closeDisableReason() && closeDisabled()) {
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {{ closeDisableReason() }}
                    </div>
                  }

                  <zimra-button class="w-full" variant="primary" (click)="router.navigate(['/reports'])">
                    View Z Report
                  </zimra-button>
                </div>
              </div>
            </div>
          </zimra-card>

          <!-- Device health -->
          <zimra-card>
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex-1">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Device health</div>
                <div class="mt-3 grid gap-4 sm:grid-cols-2">
                  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Certificate expiry</div>
                    <div class="mt-1 font-mono text-base font-semibold">
                      {{ certificateCountdownLabel() }}
                    </div>
                    <div class="mt-3">
                      <zimra-button variant="secondary" (click)="router.navigate(['/setup/issue-certificate'])">
                        Renew
                      </zimra-button>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Operating mode</div>
                    <div class="mt-1 font-mono text-base font-semibold">
                      {{ operatingModeLabel() }}
                    </div>
                    <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Online = requests allowed<br />
                      Offline = local queues / restricted actions
                    </div>
                  </div>

                  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Last ping</div>
                    <div class="mt-1 font-mono text-sm font-semibold">
                      {{ lastPingAt() ? formatDateTime(lastPingAt()!) : '-' }}
                    </div>
                    <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {{ pingStateLabel() }}
                    </div>
                  </div>

                  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Last config sync</div>
                    <div class="mt-1 font-mono text-sm font-semibold">
                      {{ lastConfigSyncAt() ? formatDateTime(lastConfigSyncAt()!) : '-' }}
                    </div>
                    <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Updated on successful getConfig() call.
                    </div>
                  </div>
                </div>
              </div>

              <div class="lg:w-96">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Status</div>
                <div class="mt-3 grid gap-3 text-sm">
                  <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <span class="text-slate-600 dark:text-slate-300">Day status</span>
                    <span class="font-mono font-semibold">{{ fiscalDayStatusLabel() }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <span class="text-slate-600 dark:text-slate-300">Certificate valid till</span>
                    <span class="font-mono font-semibold">{{ certificateValidTillLabel() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </zimra-card>
        </main>
      </div>
    </div>
  `,
})
export class DashboardScreenComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly fiscalDayService = inject(FiscalDayService);
  private readonly pingService = inject(PingService);
  private readonly storage = inject(StorageService);

  // "Now" is used for live counters in the UI.
  readonly now = signal<number>(Date.now());
  private nowSub?: Subscription;

  readonly deviceID = signal<number | null>(null);

  readonly status = signal<GetStatusResponse | null>(null);
  readonly config = signal<GetConfigResponse | null>(null);

  readonly loadError = signal<string | null>(null);

  // Use global PingService signals so we don't run multiple ping loops.
  readonly lastPingAt = this.pingService.lastPingAt;
  readonly lastPingErrorAt = this.pingService.lastPingErrorAt;
  readonly lastConfigSyncAt = signal<Date | null>(null);

  readonly pingIntervalMs = this.pingService.pingIntervalMs;
  private pingTimer?: ReturnType<typeof setInterval>;
  private lastReportingFrequencyMinutes: number | null = null;

  readonly dayOpenedAtMs = signal<number | null>(null);
  readonly lastDayStatus = signal<FiscalDayStatus | null>(null);
  readonly closeDisableReason = signal<string>('');

  // Template helpers
  readonly formatDateTime = formatDateTime;

  ngOnInit(): void {
    // Live counters: tick every second.
    this.nowSub = interval(1000).subscribe(() => this.now.set(Date.now()));
    void this.loadInitial();
  }

  ngOnDestroy(): void {
    this.nowSub?.unsubscribe();
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  private async loadInitial(): Promise<void> {
    this.loadError.set(null);

    const id = this.fdmsContext.getDeviceID() ?? (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
    this.deviceID.set(id);

    if (!id) {
      this.loadError.set('Device ID is missing. Complete setup first.');
      return;
    }

    await Promise.all([this.refreshStatus(), this.refreshConfig()]);
    this.pingService.start({ deviceID: id }, () => void this.refreshStatus());
  }

  private refreshStatus(): Promise<void> {
    const id = this.deviceID();
    if (!id) return Promise.resolve();

    return new Promise((resolve) => {
      this.fiscalDayService.getStatus({ deviceID: id }).subscribe({
        next: (res) => {
          this.syncDayOpenedAt(res.fiscalDayStatus, res.lastFiscalDayNo);
          this.status.set(res);
          resolve();
        },
        error: () => resolve(),
      });
    });
  }

  private refreshConfig(): Promise<void> {
    const id = this.deviceID();
    if (!id) return Promise.resolve();

    return new Promise((resolve) => {
      this.fiscalDayService.getConfig({ deviceID: id }).subscribe({
        next: (res) => {
          this.config.set(res);
          this.lastConfigSyncAt.set(new Date());
          resolve();
        },
        error: () => resolve(),
      });
    });
  }

  private pingOnceAndStart(): Promise<void> {
    const id = this.deviceID();
    if (!id) return Promise.resolve();

    // First ping immediately, then schedule.
    return new Promise((resolve) => {
      this.pingService.ping({ deviceID: id }).subscribe({
        next: (res: PingResponse) => {
          this.applyPingSuccess(res);
          if (typeof res.reportingFrequency === 'number' && res.reportingFrequency > 0) {
            this.lastReportingFrequencyMinutes = res.reportingFrequency;
            this.startPingTimer(res.reportingFrequency);
          }
          resolve();
        },
        error: () => {
          this.lastPingErrorAt.set(new Date());
          // Fallback interval until we successfully read reportingFrequency.
          this.pingIntervalMs.set(5 * 60 * 1000);
          this.startPingTimer(Math.ceil(this.pingIntervalMs() / 60_000));
          resolve();
        },
      });
    });
  }

  private startPingTimer(reportingFrequencyMinutes: number): void {
    const id = this.deviceID();
    if (!id) return;

    const intervalMs = Math.max(15_000, reportingFrequencyMinutes * 60_000);
    this.pingIntervalMs.set(intervalMs);
    this.lastReportingFrequencyMinutes = reportingFrequencyMinutes;

    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.pingService.ping({ deviceID: id }).subscribe({
        next: (res: PingResponse) => {
          this.applyPingSuccess(res);
          if (
            typeof res.reportingFrequency === 'number' &&
            res.reportingFrequency > 0 &&
            this.lastReportingFrequencyMinutes !== res.reportingFrequency
          ) {
            this.startPingTimer(res.reportingFrequency);
          }
          // Keep fiscal day status fresh in the background.
          void this.refreshStatus();
        },
        error: () => {
          this.lastPingErrorAt.set(new Date());
        },
      });
    }, intervalMs);
  }

  private applyPingSuccess(res: PingResponse): void {
    const now = new Date();
    this.lastPingAt.set(now);
    this.lastPingErrorAt.set(null);
  }

  private getOpenedAtStorageKey(deviceID: number, fiscalDayNo: number): string {
    return `zimra-fdms-openedAt:${deviceID}:${fiscalDayNo}`;
  }

  private getPersistedOpenedAtMs(deviceID: number, fiscalDayNo: number): number | null {
    try {
      const raw = localStorage.getItem(this.getOpenedAtStorageKey(deviceID, fiscalDayNo));
      if (!raw) return null;
      const ms = Number(raw);
      if (!Number.isFinite(ms)) return null;
      return ms;
    } catch {
      return null;
    }
  }

  private setPersistedOpenedAtMs(deviceID: number, fiscalDayNo: number, openedAtMs: number): void {
    try {
      localStorage.setItem(this.getOpenedAtStorageKey(deviceID, fiscalDayNo), String(openedAtMs));
    } catch {
      // best-effort
    }
  }

  private syncDayOpenedAt(status: FiscalDayStatus, fiscalDayNo?: number): void {
    const prev = this.lastDayStatus();
    const isOpenish = (s: FiscalDayStatus | null) =>
      s === FiscalDayStatus.FiscalDayOpened || s === FiscalDayStatus.FiscalDayCloseInitiated;

    if (isOpenish(status) && !isOpenish(prev)) {
      this.dayOpenedAtMs.set(this.now());
    }

    if (!isOpenish(status)) {
      this.dayOpenedAtMs.set(null);
    }

    // Persist/load openedAt so the "time since opened" counter survives reloads.
    if (isOpenish(status)) {
      const id = this.deviceID();
      if (id != null && fiscalDayNo != null) {
        const existing = this.getPersistedOpenedAtMs(id, fiscalDayNo);
        if (existing != null) {
          this.dayOpenedAtMs.set(existing);
        } else if (this.dayOpenedAtMs() != null) {
          this.setPersistedOpenedAtMs(id, fiscalDayNo, this.dayOpenedAtMs()!);
        }
      }
    }

    this.lastDayStatus.set(status);
  }

  // --------------------
  // Labels / Computed UI
  // --------------------
  fiscalDayNoLabel(): string {
    const s = this.status();
    return s?.lastFiscalDayNo != null ? String(s.lastFiscalDayNo) : '-';
  }

  fiscalDayStatusLabel(): string {
    const s = this.status();
    if (!s) return '—';
    return s.fiscalDayStatus === FiscalDayStatus.FiscalDayClosed
      ? 'FiscalDayClosed'
      : s.fiscalDayStatus === FiscalDayStatus.FiscalDayOpened
        ? 'FiscalDayOpened'
        : s.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseInitiated
          ? 'FiscalDayCloseInitiated'
          : 'FiscalDayCloseFailed';
  }

  connectionDotClass(): string {
    const state = this.connectionState();
    switch (state) {
      case 'connected':
        return 'bg-status-green';
      case 'disconnected':
        return 'bg-status-red';
      default:
        return 'bg-status-grey';
    }
  }

  connectionState(): ConnectionState {
    const pingMs = this.pingIntervalMs();
    const okAt = this.lastPingAt();
    const errAt = this.lastPingErrorAt();

    if (!pingMs) return 'unknown';

    const now = this.now();
    if (okAt && now - okAt.getTime() < pingMs * 2) return 'connected';
    if (errAt && now - errAt.getTime() < pingMs * 2) return 'disconnected';
    return 'unknown';
  }

  operatingModeLabel(): string {
    const c = this.config();
    if (!c) return '-';
    return c.deviceOperatingMode === DeviceOperatingMode.Online ? 'Online' : 'Offline';
  }

  certificateValidTillLabel(): string {
    const c = this.config();
    if (!c?.certificateValidTill) return '-';
    const d = new Date(c.certificateValidTill);
    return `${d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}`;
  }

  fiscalStatusBadgeClass(): string {
    const s = this.status();
    if (!s) return 'border-zimra-border bg-white text-slate-700 dark:border-slate-800 dark:text-slate-200';

    switch (s.fiscalDayStatus) {
      case FiscalDayStatus.FiscalDayOpened:
        return 'bg-status-green/20 text-status-green border border-status-green/30';
      case FiscalDayStatus.FiscalDayCloseInitiated:
        return 'bg-status-yellow/20 text-status-yellow border border-status-yellow/30';
      case FiscalDayStatus.FiscalDayCloseFailed:
        return 'bg-status-red/20 text-status-red border border-status-red/30';
      case FiscalDayStatus.FiscalDayClosed:
      default:
        return 'bg-status-grey/20 text-status-grey border border-status-grey/30';
    }
  }

  certificateCountdownLabel(): string {
    const c = this.config();
    if (!c) return '-';
    const till = new Date(c.certificateValidTill).getTime();
    const daysLeft = Math.ceil((till - this.now()) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(daysLeft)) return '-';
    return `${daysLeft} days`;
  }

  // --------------------
  // Warning / Stop logic
  // --------------------
  private dayElapsedHours(): number | null {
    const openedAt = this.dayOpenedAtMs();
    const c = this.config();
    if (!openedAt || !c) return null;
    return (this.now() - openedAt) / (1000 * 60 * 60);
  }

  warningEnabled(): boolean {
    const c = this.config();
    const elapsed = this.dayElapsedHours();
    if (!c || elapsed == null) return false;
    const maxHrs = c.taxPayerDayMaxHrs;
    const notifyHrs = c.taxpayerDayEndNotificationHrs;
    if (maxHrs <= 0) return false;
    const remaining = maxHrs - elapsed;
    return remaining <= notifyHrs && remaining > 0;
  }

  hardStopEnabled(): boolean {
    const c = this.config();
    const elapsed = this.dayElapsedHours();
    if (!c || elapsed == null) return false;
    const maxHrs = c.taxPayerDayMaxHrs;
    if (maxHrs <= 0) return false;
    return elapsed >= maxHrs;
  }

  timeSinceOpenedLabel(): string {
    const openedAt = this.dayOpenedAtMs();
    if (!openedAt) return '—';
    return formatDuration(this.now() - openedAt);
  }

  // --------------------
  // Quick action enable/disable
  // --------------------
  openDisabled(): boolean {
    const c = this.config();
    const s = this.status();
    if (!c || !s) return true;

    const isOffline = c.deviceOperatingMode === DeviceOperatingMode.Offline;
    const alreadyOpen =
      s.fiscalDayStatus === FiscalDayStatus.FiscalDayOpened ||
      s.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseInitiated;

    return isOffline || alreadyOpen;
  }

  submitDisabled(): boolean {
    const s = this.status();
    if (!s || !this.config()) return true;
    return s.fiscalDayStatus !== FiscalDayStatus.FiscalDayOpened;
  }

  closeDisabled(): boolean {
    const c = this.config();
    const s = this.status();
    if (!c || !s) return true;

    const isOffline = c.deviceOperatingMode === DeviceOperatingMode.Offline;
    if (isOffline) return true;

    // Best-effort gating for "Grey/Red receipts" using the closing error code
    // returned by `getStatus()`. (Exact per-receipt colors require a richer API payload.)
    const closingError = s.fiscalDayClosingErrorCode;
    if (
      closingError === FiscalDayProcessingError.MissingReceipts ||
      closingError === FiscalDayProcessingError.ReceiptsWithValidationErrors
    ) {
      if (closingError === FiscalDayProcessingError.MissingReceipts) {
        this.closeDisableReason.set('Grey receipts present (missing receipts).');
      } else {
        this.closeDisableReason.set('Red receipts present (validation errors).');
      }
      return true;
    }

    this.closeDisableReason.set('');
    return s.fiscalDayStatus !== FiscalDayStatus.FiscalDayOpened;
  }

  pingStateLabel(): string {
    const state = this.connectionState();
    if (state === 'connected') return 'Connected';
    if (state === 'disconnected') return 'No response';
    return 'Checking';
  }

  navClass(_path: string, active: boolean): string {
    if (active) return 'bg-zimra-gold/20 border border-zimra-gold/30 text-zimra-gold';
    return 'bg-white text-slate-700 hover:bg-slate-50 border border-transparent dark:text-slate-200';
  }

  // --------------------
  // Actions
  // --------------------
  async openFiscalDay(): Promise<void> {
    const id = this.deviceID();
    if (!id) return;
    if (this.openDisabled()) return;

    await new Promise<void>((resolve) => {
      this.fiscalDayService
        .openDay({ deviceID: id, fiscalDayOpened: toLocalDateTimeNoTz(new Date()) })
        .subscribe({
        next: (res: OpenDayResponse) => {
          // Persist the local openedAt so the counter works even after reload.
          const openedAtMs = Date.now();
          this.dayOpenedAtMs.set(openedAtMs);
          if (res?.fiscalDayNo != null) {
            this.setPersistedOpenedAtMs(id, res.fiscalDayNo, openedAtMs);
          }
          resolve();
        },
        error: (e) => {
          this.loadError.set(e instanceof Error ? e.message : String(e));
          resolve();
        },
      });
    });

    await this.refreshStatus();
    await this.refreshConfig();
  }

  async closeFiscalDay(): Promise<void> {
    const id = this.deviceID();
    const s = this.status();
    if (!id || !s) return;
    if (this.closeDisabled()) return;

    // Best-effort wiring; close requires additional signature/counter inputs.
    const fiscalDayNo = s.lastFiscalDayNo;
    const fiscalDayCounters = s.fiscalDayCounters;
    const sig = s.fiscalDayServerSignature;
    const receiptCounter = s.lastReceiptGlobalNo;

    if (fiscalDayNo == null || !fiscalDayCounters || !sig || receiptCounter == null) {
      this.loadError.set('CloseDay inputs are not available yet (missing counters/signature).');
      return;
    }

    const req = {
      deviceID: id,
      fiscalDayNo,
      fiscalDayCounters,
      fiscalDayDeviceSignature: { hash: sig.hash, signature: sig.signature },
      receiptCounter,
    };

    await new Promise<void>((resolve) => {
      this.fiscalDayService.closeDay(req).subscribe({
        next: () => resolve(),
        error: (e) => {
          this.loadError.set(e instanceof Error ? e.message : String(e));
          resolve();
        },
      });
    });

    await this.refreshStatus();
    await this.refreshConfig();
  }

  goSubmitReceipt(): void {
    if (this.submitDisabled()) return;
    void this.router.navigate(['/receipts']);
  }
}

