import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { OpenDayRequest, OpenDayResponse } from '../../core/models/api.models';
import { FiscalDayStore } from '../../core/store/fiscal-day.store';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalDateTimeValue(d: Date): string {
  // datetime-local expects `YYYY-MM-DDTHH:mm` in local time.
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localDateTimeToApiString(value: string): string {
  // Convert `YYYY-MM-DDTHH:mm` -> `YYYY-MM-DDTHH:mm:00` (no timezone suffix).
  const [datePart, timePart] = value.split('T');
  const [hh, mm] = (timePart ?? '').split(':');
  if (!datePart || !hh || !mm) return value;
  return `${datePart}T${hh}:${mm}:00`;
}

@Component({
  selector: 'zimra-open-fiscal-day',
  standalone: true,
  imports: [CardComponent, ButtonComponent, ModalComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <div class="mb-4">
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Open Fiscal Day</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Select the local date/time and (optionally) the fiscal day number.
          </p>
        </div>

        @if (loadError()) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {{ loadError() }}
          </div>
        }

        <zimra-card>
          <div class="grid gap-5 md:grid-cols-2">
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Fiscal Day Opened At</label>
              <input
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                type="datetime-local"
                [value]="openedAtValue()"
                (input)="onOpenedAtInput($any($event.target).value)"
              />
              <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">Uses your local time (no timezone).</div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">Fiscal Day No (optional)</label>
              <input
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                type="number"
                inputmode="numeric"
                [value]="fiscalDayNoInput()"
                (input)="onFiscalDayNoInput($any($event.target).value)"
                placeholder="Auto"
              />
              <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Rules: must be 1 for the first fiscal day; otherwise lastFiscalDayNo + 1.
              </div>

              @if (fiscalDayNoInput() !== '') {
                @if (fiscalDayNoError()) {
                  <div class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{{ fiscalDayNoError() }}</div>
                } @else {
                  <div class="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Looks valid</div>
                }
              }
            </div>
          </div>

          <div class="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div class="text-xs text-slate-500 dark:text-slate-400">Please confirm before submitting to the FDMS gateway.</div>
            <zimra-button variant="primary" [disabled]="submitDisabled() || openConfirmOpen()" (click)="openConfirmModal()">
              Open Day
            </zimra-button>
          </div>
        </zimra-card>

        @if (openedSuccess()) {
          <div class="mt-6 animate-[fadeSlideIn_350ms_ease_both]">
            <zimra-card>
              <div class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Day Opened</div>
              <div class="mt-2 text-sm text-slate-700 dark:text-slate-200">
                Fiscal day number: <span class="font-mono font-semibold">{{ openedFiscalDayNo() }}</span>
              </div>
              <div class="mt-4 flex justify-end gap-3">
                <zimra-button variant="secondary" (click)="router.navigate(['/fiscal-day/close'])">
                  Go to Close Day
                </zimra-button>
                <zimra-button variant="primary" (click)="router.navigate(['/fiscal-day/status'])">
                  View Status
                </zimra-button>
              </div>
            </zimra-card>
          </div>
        }

        <zimra-modal [open]="openConfirmOpen()" (closed)="setOpenConfirm(false)">
          <div modal-title>Confirm Open Day</div>
          <div class="text-sm text-slate-700 dark:text-slate-200">
            Open fiscal day with the selected date/time and fiscal day number (if provided).
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <zimra-button variant="secondary" (click)="setOpenConfirm(false)">Cancel</zimra-button>
            <zimra-button variant="primary" (click)="confirmOpenDay()" [disabled]="submitDisabled()">Confirm</zimra-button>
          </div>
        </zimra-modal>

        <zimra-modal [open]="guardRedirectModalOpen()" (closed)="guardRedirectModalOpen.set(false)">
          <div modal-title>Open Day Required</div>
          <div class="text-sm text-slate-700 dark:text-slate-200">
            Fiscal day is not open. Open fiscal day to continue with receipt operations.
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <zimra-button variant="primary" (click)="guardRedirectModalOpen.set(false)">Continue</zimra-button>
          </div>
        </zimra-modal>
      </div>
    </div>
  `,
})
export class OpenDayScreenComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly fiscalDayStore = inject(FiscalDayStore);

  private alive = true;

  readonly loadError = signal<string | null>(null);
  readonly dayState = this.fiscalDayStore.view;

  readonly openedAt = signal<string>(toLocalDateTimeValue(new Date()));
  readonly fiscalDayNoInput = signal<string>('');

  readonly openedSuccessFlag = signal<boolean>(false);
  readonly openedFiscalDayNo = signal<number | null>(null);

  readonly openConfirmOpen = signal<boolean>(false);
  readonly guardRedirectModalOpen = signal<boolean>(false);

  ngOnInit(): void {
    const requireOpenDay = this.route.snapshot.queryParamMap.get('requireOpenDay');
    if (requireOpenDay === '1') {
      this.guardRedirectModalOpen.set(true);
    }
    void this.loadStatus();
  }

  ngOnDestroy(): void {
    this.alive = false;
  }

  openedAtValue(): string {
    return this.openedAt();
  }

  onOpenedAtInput(value: string): void {
    this.openedAt.set(value);
  }

  onFiscalDayNoInput(value: string): void {
    this.fiscalDayNoInput.set(value === '' ? '' : String(value));
  }

  setOpenConfirm(open: boolean): void {
    this.openConfirmOpen.set(open);
  }

  openConfirmModal(): void {
    this.openConfirmOpen.set(true);
  }

  private async resolveDeviceID(): Promise<number | null> {
    if (this.fdmsContext.getDeviceID() != null) return this.fdmsContext.getDeviceID();
    const cert = await this.storage.getAnyDeviceCertificate();
    return cert?.deviceID ?? null;
  }

  private async loadStatus(): Promise<void> {
    const deviceID = await this.resolveDeviceID();
    if (!deviceID) {
      this.loadError.set('Device ID is missing. Please complete setup first.');
      return;
    }
    if (!this.alive) return;

    try {
      await this.fiscalDayStore.loadStatus(deviceID);
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : String(e));
    }
  }

  readonly fiscalDayNoError = computed(() => {
    const raw = this.fiscalDayNoInput();
    if (raw === '') return null;
    const provided = Number(raw);
    if (!Number.isFinite(provided) || !Number.isInteger(provided) || provided <= 0) {
      return 'Fiscal day no must be a positive integer.';
    }

    const prev = this.dayState().fiscalDayNo;
    const isFirst = prev == null;
    if (isFirst) {
      return provided === 1 ? null : 'For the first fiscal day, fiscal day no must be 1.';
    }
    return provided === prev + 1 ? null : `Must be previousFiscalDayNo + 1 (expected ${prev + 1}).`;
  });

  submitDisabled(): boolean {
    const openedAt = this.openedAt();
    if (!openedAt) return true;
    return Boolean(this.fiscalDayNoError());
  }

  confirmOpenDay(): void {
    void this.confirmOpenDayAsync();
  }

  private async confirmOpenDayAsync(): Promise<void> {
    const deviceID = await this.resolveDeviceID();
    if (!deviceID) {
      this.loadError.set('Device ID is missing. Complete setup first.');
      this.openConfirmOpen.set(false);
      return;
    }
    if (this.fiscalDayNoError()) return;

    this.openConfirmOpen.set(false);
    const fiscalDayOpened = localDateTimeToApiString(this.openedAt());
    const raw = this.fiscalDayNoInput();
    const fiscalDayNo = raw === '' ? undefined : Number(raw);

    const req: OpenDayRequest = {
      deviceID,
      fiscalDayOpened,
      ...(fiscalDayNo !== undefined ? { fiscalDayNo } : {}),
    };

    try {
      const res: OpenDayResponse = await this.fiscalDayStore.openDay(req);
      this.openedSuccessFlag.set(true);
      this.openedFiscalDayNo.set(res.fiscalDayNo);
      await this.fiscalDayStore.loadStatus(deviceID);
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : String(e));
    }
  }

  openedSuccess(): boolean {
    return this.openedSuccessFlag();
  }
}

