import { NgClass } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { CryptoService } from '../../core/services/crypto.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { FiscalDayProcessingError, FiscalDayStatus, GetStatusResponse, SignatureData } from '../../core/models/api.models';
import { SignatureInspectorComponent } from '../../shared/components/signature-inspector/signature-inspector.component';
import { FiscalDayStore } from '../../core/store/fiscal-day.store';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fiscalCounterTaxOrMoney(counter: any): string {
  if (counter.fiscalCounterTaxID != null) {
    const pct = counter.fiscalCounterTaxPercent != null ? ` (${counter.fiscalCounterTaxPercent}%)` : '';
    return `TaxID ${counter.fiscalCounterTaxID}${pct}`;
  }
  if (counter.fiscalCounterMoneyType != null) return `MoneyType ${counter.fiscalCounterMoneyType}`;
  return '-';
}

@Component({
  selector: 'zimra-close-fiscal-day',
  standalone: true,
  imports: [NgClass, CardComponent, ButtonComponent, ModalComponent, SignatureInspectorComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <div class="mb-4">
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Close Fiscal Day</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Review counters, generate device signature, validate checklist, then submit.
          </p>
        </div>

        @if (loadError()) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {{ loadError() }}
          </div>
        }

        @if (!status()) {
          <div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-zimra-charcoal">
            Loading fiscal day status...
          </div>
        }

        @if (status()) {
          <zimra-card>
            <div class="flex flex-col gap-4">
              <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zimra-charcoal-light">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Day summary</div>
                <div class="mt-2 text-sm">
                  Fiscal day no: <span class="font-mono font-semibold">{{ fiscalDayNoLabel() }}</span>
                </div>
                <div class="mt-1 text-sm">
                  Receipt counter: <span class="font-mono font-semibold">{{ receiptCounterLabel() }}</span>
                </div>
              </div>

              <div class="grid gap-6 lg:grid-cols-2">
                <div>
                  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Fiscal Counters</div>
                  <div class="mt-2 overflow-x-auto">
                    <table class="w-full text-left text-sm">
                      <thead class="text-xs font-semibold text-slate-500">
                        <tr>
                          <th class="px-3 py-2">Type</th>
                          <th class="px-3 py-2">Currency</th>
                          <th class="px-3 py-2">Tax/Money type</th>
                          <th class="px-3 py-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (c of counters(); track $index) {
                          <tr class="border-t border-slate-200 dark:border-slate-800">
                            <td class="px-3 py-2 font-mono">{{ c.fiscalCounterType }}</td>
                            <td class="px-3 py-2">{{ c.fiscalCounterCurrency }}</td>
                            <td class="px-3 py-2">{{ fiscalCounterTaxOrMoney(c) }}</td>
                            <td class="px-3 py-2 font-mono">{{ c.fiscalCounterValue }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Device Signature</div>

                  <div class="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zimra-charcoal-light">
                    <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Hash to be signed</div>
                    <pre class="mt-2 max-h-28 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700 dark:border-slate-800 dark:bg-zimra-charcoal">
{{ signingHash() || '—' }}
                    </pre>

                    <div class="mt-4">
                      <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">Private key (PEM PKCS#8)</div>
                      <textarea
                        class="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                        rows="6"
                        [value]="privateKeyPem()"
                        (input)="onPrivateKeyPemInput($any($event.target).value)"
                        placeholder="-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----"
                      ></textarea>
                      @if (privateKeyError()) {
                        <div class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                          {{ privateKeyError() }}
                        </div>
                      }

                      <div class="mt-3">
                        <input type="file" accept=".pem" (change)="onPrivateKeyFile($event)" />
                      </div>

                      <div class="mt-4 flex items-center justify-between gap-3">
                        <zimra-button variant="secondary" (click)="clearPrivateKey()">Clear</zimra-button>
                        <zimra-button variant="primary" [disabled]="!canGenerateSignature()" (click)="generateSignature()">
                          Generate Signature
                        </zimra-button>
                      </div>
                    </div>

                    <div class="mt-4">
                      <zimra-signature-inspector [payload]="signingPayloadText()" [signature]="generatedSignatureText()" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Validation Checklist</div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Spec-limited: getStatus exposes Grey/Red presence via close error code, but not receipt counts.
                </div>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  <div class="rounded-xl border p-3 text-sm"
                    [ngClass]="greyReceiptsOk() ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:border-emerald-900/30'">
                    No Grey receipts outstanding
                    <div class="mt-1 text-xs opacity-90">{{ greyReceiptsLabel() }}</div>
                  </div>
                  <div class="rounded-xl border p-3 text-sm"
                    [ngClass]="redReceiptsOk() ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 dark:border-emerald-900/30'">
                    No Red receipts
                    <div class="mt-1 text-xs opacity-90">{{ redReceiptsLabel() }}</div>
                  </div>
                  <div class="rounded-xl border p-3 text-sm sm:col-span-2"
                    [ngClass]="countersOk() ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'">
                    All counters calculated correctly
                    <div class="mt-1 text-xs opacity-90">{{ countersLabel() }}</div>
                  </div>
                </div>
              </div>

              @if (status()!.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseFailed) {
                <div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  Close failed: {{ closeErrorCodeLabel() }}
                  <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">{{ closeActionGuidance() }}</div>
                </div>
              }

              <div class="mt-6 flex justify-end gap-3">
                <zimra-button variant="secondary" (click)="router.navigate(['/fiscal-day/status'])">Back to Status</zimra-button>
                <zimra-button variant="primary" [disabled]="submitDisabled()" (click)="openConfirmModal()">
                  Submit Close Day
                </zimra-button>
              </div>
            </div>
          </zimra-card>
        }

        <zimra-modal [open]="confirmOpen()" (closed)="setConfirmOpen(false)">
          <div modal-title>Confirm Close Day</div>
          <div class="text-sm text-slate-700 dark:text-slate-200">
            This will close the current fiscal day and submit the generated device signature.
          </div>
          <div class="mt-4 flex justify-end gap-3">
            <zimra-button variant="secondary" (click)="setConfirmOpen(false)">Cancel</zimra-button>
            <zimra-button variant="primary" [disabled]="submitDisabled()" (click)="confirmCloseDay()">Confirm</zimra-button>
          </div>
        </zimra-modal>
      </div>
    </div>
  `,
})
export class CloseDayScreenComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);
  private readonly crypto = inject(CryptoService);
  private readonly fiscalDayStore = inject(FiscalDayStore);

  readonly loadError = signal<string | null>(null);
  readonly dayState = this.fiscalDayStore.view;
  readonly status = computed<GetStatusResponse | null>(() => {
    const s = this.dayState();
    if (!s.status) return null;
    return {
      operationID: '',
      fiscalDayStatus: s.status,
      fiscalDayReconciliationMode: s.reconciliationMode ?? undefined,
      fiscalDayServerSignature: s.serverSignature ?? undefined,
      fiscalDayClosingErrorCode: s.closingErrorCode ?? undefined,
      fiscalDayCounters: s.counters,
      fiscalDayDocumentQuantities: s.documentQuantities,
      lastReceiptGlobalNo: s.lastReceiptGlobalNo ?? undefined,
      lastFiscalDayNo: s.fiscalDayNo ?? undefined,
    };
  });
  private deviceID: number | null = null;

  readonly confirmOpen = signal<boolean>(false);

  readonly privateKeyPem = signal<string>('');
  readonly privateKeyError = signal<string | null>(null);

  readonly generatedSignature = signal<SignatureData | null>(null);
  readonly signingHash = signal<string | null>(null);
  readonly signingPayload = signal<string>('');

  readonly FiscalDayStatus = FiscalDayStatus;
  readonly fiscalCounterTaxOrMoney = fiscalCounterTaxOrMoney;
  readonly counters = computed(() => this.status()?.fiscalDayCounters ?? []);

  private alive = true;

  ngOnInit(): void {
    void this.loadStatus();
  }

  ngOnDestroy(): void {
    this.alive = false;
  }

  private async resolveDeviceID(): Promise<number | null> {
    if (this.fdmsContext.getDeviceID() != null) return this.fdmsContext.getDeviceID();
    const cert = await this.storage.getAnyDeviceCertificate();
    return cert?.deviceID ?? null;
  }

  private async loadStatus(): Promise<void> {
    this.loadError.set(null);
    try {
      this.deviceID = await this.resolveDeviceID();
      if (!this.deviceID) {
        this.loadError.set('Device ID is missing. Complete setup first.');
        return;
      }
      await this.fiscalDayStore.loadStatus(this.deviceID);
      // Precompute payload string + hash once counters are loaded.
      void this.buildSigningPayloadAndHash().catch(() => {});
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : String(e));
    }
  }

  fiscalDayNoLabel(): string {
    const s = this.status();
    if (!s?.lastFiscalDayNo) return '-';
    return String(s.lastFiscalDayNo);
  }

  receiptCounterLabel(): string {
    const d = this.dayState();
    if (d.receiptCounter == null) return '-';
    return String(d.receiptCounter);
  }

  private buildSigningPayloadString(): string {
    const s = this.status();
    if (!s) return '';
    if (this.deviceID == null) return '';
    const fiscalDayNo = s.lastFiscalDayNo ?? 0;
    const counters = s.fiscalDayCounters ?? [];
    // Spec (13.3): fiscalDayDate is `YYYY-MM-DD` (local), and counters are concatenated in the preimage.
    const fiscalDayDateYYYYMMDD = this.crypto.localDateYmd(new Date());
    return this.crypto.buildFiscalDayDeviceSignatureConcatString({
      deviceID: this.deviceID,
      fiscalDayNo,
      fiscalDayDateYYYYMMDD,
      counters,
    });
  }

  private async buildSigningPayloadAndHash(): Promise<void> {
    const payloadString = this.buildSigningPayloadString();
    if (!payloadString) return;

    this.signingPayload.set(payloadString);
    const bytes = new TextEncoder().encode(payloadString);
    const hashB64 = await this.crypto.sha256Base64(bytes);
    this.signingHash.set(hashB64);
  }

  onPrivateKeyPemInput(value: string): void {
    this.privateKeyPem.set(value);
    this.privateKeyError.set(null);
  }

  async onPrivateKeyFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const text = await file.text();
    this.privateKeyPem.set(text);
    this.privateKeyError.set(null);
  }

  clearPrivateKey(): void {
    this.privateKeyPem.set('');
    this.privateKeyError.set(null);
    this.generatedSignature.set(null);
  }

  canGenerateSignature(): boolean {
    return Boolean(this.privateKeyPem().trim()) && Boolean(this.signingHash());
  }

  signingPayloadText(): string {
    return this.signingPayload();
  }

  signingHashText(): string {
    return this.signingHash() ?? '';
  }

  generatedSignatureText(): string {
    const sig = this.generatedSignature();
    if (!sig) return '';
    return JSON.stringify(sig, null, 2);
  }

  private validatePrivateKeyPem(): string | null {
    const pem = this.privateKeyPem().trim();
    if (!pem) return 'Private key is required.';
    if (!pem.includes('BEGIN PRIVATE KEY')) return 'Expected PKCS#8 PEM: BEGIN PRIVATE KEY / END PRIVATE KEY.';
    return null;
  }

  async generateSignature(): Promise<void> {
    const err = this.validatePrivateKeyPem();
    if (err) {
      this.privateKeyError.set(err);
      return;
    }

    try {
      this.privateKeyError.set(null);
      const payloadString = this.signingPayload();
      if (!payloadString) throw new Error('Signing payload is missing.');
      const bytes = new TextEncoder().encode(payloadString);

      // Signing payload bytes -> signature bytes.
      const sigBytes = await this.crypto.sign(bytes, this.privateKeyPem());
      const sigB64 = toBase64(sigBytes);
      const hashB64 = this.signingHash();
      if (!hashB64) throw new Error('Signing hash missing.');

      this.generatedSignature.set({ hash: hashB64, signature: sigB64 });
    } catch (e) {
      this.privateKeyError.set(e instanceof Error ? e.message : String(e));
    }
  }

  greyReceiptsOk(): boolean {
    const code = this.status()?.fiscalDayClosingErrorCode;
    return code !== FiscalDayProcessingError.MissingReceipts;
  }

  greyReceiptsLabel(): string {
    const code = this.status()?.fiscalDayClosingErrorCode;
    if (code === FiscalDayProcessingError.MissingReceipts) return 'Server indicates grey receipts outstanding (count unavailable).';
    return 'No grey receipts indicated.';
  }

  redReceiptsOk(): boolean {
    const code = this.status()?.fiscalDayClosingErrorCode;
    return code !== FiscalDayProcessingError.ReceiptsWithValidationErrors;
  }

  redReceiptsLabel(): string {
    const code = this.status()?.fiscalDayClosingErrorCode;
    if (code === FiscalDayProcessingError.ReceiptsWithValidationErrors) return 'Server indicates red receipts present (count unavailable).';
    return 'No red receipts indicated.';
  }

  countersOk(): boolean {
    const code = this.status()?.fiscalDayClosingErrorCode;
    return code !== FiscalDayProcessingError.CountersMismatch;
  }

  countersLabel(): string {
    const code = this.status()?.fiscalDayClosingErrorCode;
    if (code === FiscalDayProcessingError.CountersMismatch) return 'Server indicates counters mismatch. Fix and retry.';
    return 'No counters mismatch indicated.';
  }

  closeErrorCodeLabel(): string {
    return String(this.status()?.fiscalDayClosingErrorCode ?? '-');
  }

  closeActionGuidance(): string {
    const code = this.status()?.fiscalDayClosingErrorCode;
    switch (code) {
      case FiscalDayProcessingError.BadCertificateSignature:
        return 'Certificate signature failed. Renew your device certificate.';
      case FiscalDayProcessingError.MissingReceipts:
        return 'Grey receipts outstanding. Ensure all receipts are submitted and processed.';
      case FiscalDayProcessingError.ReceiptsWithValidationErrors:
        return 'Red receipts present. Fix validation errors and resubmit.';
      case FiscalDayProcessingError.CountersMismatch:
        return 'Counters mismatch. Ensure all receipts are processed.';
      default:
        return 'Close failed. Check details and retry.';
    }
  }

  submitDisabled(): boolean {
    const s = this.status();
    if (!s) return true;
    if (this.greyReceiptsOk() === false) return true;
    if (this.redReceiptsOk() === false) return true;
    if (this.countersOk() === false) return true;

    if (this.generatedSignature() == null) return true;
    return false;
  }

  openConfirmModal(): void {
    this.confirmOpen.set(true);
  }

  setConfirmOpen(open: boolean): void {
    this.confirmOpen.set(open);
  }

  confirmCloseDay(): void {
    void this.confirmCloseDayAsync();
  }

  private async confirmCloseDayAsync(): Promise<void> {
    const id = this.deviceID;
    if (id == null) return;
    if (this.submitDisabled()) return;

    const d = this.dayState();
    const fiscalDayNo = d.fiscalDayNo;
    const fiscalDayCounters = (d.counters ?? []).filter((c) => Math.round(c.fiscalCounterValue) !== 0);
    const receiptCounter = d.receiptCounter;
    const fiscalDayDeviceSignature = this.generatedSignature();

    if (fiscalDayNo == null || !fiscalDayCounters || receiptCounter == null || !fiscalDayDeviceSignature) {
      this.loadError.set('Missing close-day inputs (fiscal day no/counters/receipt counter/signature).');
      return;
    }

    this.confirmOpen.set(false);

    try {
      await this.fiscalDayStore.closeDay({
        deviceID: id,
        fiscalDayNo,
        fiscalDayCounters,
        fiscalDayDeviceSignature,
        receiptCounter,
      });
      await this.router.navigate(['/reports/zx'], { queryParams: { source: 'close-day' } });
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : String(e));
    }
  }
}

