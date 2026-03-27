import { NgClass } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { CertificateService } from '../../core/services/certificate.service';
import { StorageService } from '../../core/services/storage.service';
import { FiscalDayStore } from '../../core/store/fiscal-day.store';
import {
  FiscalDayProcessingError,
  FiscalDayReconciliationMode,
  FiscalDayStatus,
  GetStatusResponse,
  ReceiptType,
} from '../../core/models/api.models';
import { SignatureInspectorComponent } from '../../shared/components/signature-inspector/signature-inspector.component';
import { SignatureVerificationComponent } from '../../shared/components/signature-verification/signature-verification.component';

function receiptTypeLabel(t: number): string {
  switch (t) {
    case ReceiptType.FiscalInvoice:
      return 'Fiscal Invoice';
    case ReceiptType.CreditNote:
      return 'Credit Note';
    case ReceiptType.DebitNote:
      return 'Debit Note';
    default:
      return String(t);
  }
}

@Component({
  selector: 'zimra-fiscal-day-status',
  standalone: true,
  imports: [NgClass, CardComponent, ButtonComponent, SignatureInspectorComponent, SignatureVerificationComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <div class="mb-4">
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Fiscal Day Status</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">We poll while close is in progress.</p>
        </div>

        @if (loadError()) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {{ loadError() }}
          </div>
        }

        <zimra-card>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3">
              <div class="rounded-2xl border px-4 py-2 text-sm font-semibold" [ngClass]="badgeClass()">
                {{ statusLabel() }}
              </div>
              <div class="text-sm">
                Fiscal day no: <span class="font-mono font-semibold">{{ status()?.lastFiscalDayNo ?? '-' }}</span>
              </div>
            </div>

            <div class="text-xs text-slate-500 dark:text-slate-400">
              @if (processing()) { Polling every 10 seconds... } @else { Not processing }
            </div>
          </div>

          @if (processing()) {
            <div class="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
              <div class="flex items-center gap-3">
                <span class="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-500 dark:bg-yellow-300"></span>
                <span>Fiscal day close is being processed by the gateway.</span>
              </div>
              <div class="mt-3 h-1.5 w-full overflow-hidden rounded bg-yellow-200/70 dark:bg-yellow-900/40">
                <div class="h-full w-1/3 animate-pulse rounded bg-yellow-500 dark:bg-yellow-300"></div>
              </div>
            </div>
          }

          @if (status()) {
            @if (status()!.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseFailed) {
              <div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                Close failed: {{ closeErrorCodeLabel() }}
                <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {{ closeActionGuidance() }}
                </div>
              </div>
            }

            <div class="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Document Quantities</div>
                <div class="mt-2 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="text-xs font-semibold text-slate-500">
                      <tr>
                        <th class="px-3 py-2">Receipt type</th>
                        <th class="px-3 py-2">Currency</th>
                        <th class="px-3 py-2">Qty</th>
                        <th class="px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of status()!.fiscalDayDocumentQuantities ?? []; track row.receiptType) {
                        <tr class="border-t border-slate-200 dark:border-slate-800">
                          <td class="px-3 py-2">{{ receiptTypeLabel(row.receiptType) }}</td>
                          <td class="px-3 py-2">{{ row.receiptCurrency }}</td>
                          <td class="px-3 py-2 font-mono">{{ row.receiptQuantity }}</td>
                          <td class="px-3 py-2 font-mono">{{ row.receiptTotalAmount }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                @if (status()!.fiscalDayReconciliationMode === FiscalDayReconciliationMode.Manual) {
                  <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Counters (Manual Reconciliation)</div>
                  <div class="mt-2 overflow-x-auto">
                    <table class="w-full text-left text-sm">
                      <thead class="text-xs font-semibold text-slate-500">
                        <tr>
                          <th class="px-3 py-2">Counter type</th>
                          <th class="px-3 py-2">Currency</th>
                          <th class="px-3 py-2">Tax/Money type</th>
                          <th class="px-3 py-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (c of status()!.fiscalDayCounters ?? []; track $index) {
                          <tr class="border-t border-slate-200 dark:border-slate-800">
                            <td class="px-3 py-2">{{ c.fiscalCounterType }}</td>
                            <td class="px-3 py-2">{{ c.fiscalCounterCurrency }}</td>
                            <td class="px-3 py-2">
                              {{ formatCounterTaxOrMoney(c) }}
                            </td>
                            <td class="px-3 py-2 font-mono">{{ c.fiscalCounterValue }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-zimra-charcoal/60 dark:text-slate-300">
                    Reconciliation mode is not Manual; counters table is hidden.
                  </div>
                }
              </div>
            </div>

            @if (status()!.fiscalDayStatus === FiscalDayStatus.FiscalDayClosed) {
              <div class="mt-6">
                <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Day Server Signature</div>
                <div class="mt-2 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200">
                  Verification capability: partial with current payload. Full 13.3.2 verification requires fiscalDayDate and (for AUTO mode) fiscalDayDeviceSignature, which are not returned by getStatus.
                </div>
                <details class="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zimra-charcoal/60">
                  <summary class="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Show signature payload</summary>
                  <div class="mt-3">
                    <zimra-signature-inspector
                      [payload]="signaturePayloadText()"
                      [signature]="signatureText()"
                    />
                    <div class="mt-3">
                      <zimra-signature-verification
                        [signatureData]="status()!.fiscalDayServerSignature"
                        [payloadText]="signaturePayloadText()"
                        [recomputedHash]="status()!.fiscalDayServerSignature?.hash"
                      />
                    </div>
                    <div class="mt-3 flex justify-end">
                      <zimra-button variant="secondary" (click)="verifySignature()">Verify</zimra-button>
                    </div>
                    @if (verifyMsg()) {
                      <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">{{ verifyMsg() }}</div>
                    }
                  </div>
                </details>
              </div>
            }

            @if (status()!.fiscalDayStatus === FiscalDayStatus.FiscalDayOpened) {
              <div class="mt-6 flex justify-end">
                <zimra-button variant="primary" (click)="router.navigate(['/fiscal-day/close'])">
                  Close Day
                </zimra-button>
              </div>
            }
          }
        </zimra-card>
      </div>
    </div>
  `,
})
export class FiscalDayStatusScreenComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly certificateService = inject(CertificateService);
  private readonly fiscalDayStore = inject(FiscalDayStore);
  private readonly storage = inject(StorageService);

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
      fiscalDayCounters: s.counters ?? [],
      fiscalDayDocumentQuantities: s.documentQuantities ?? [],
      lastReceiptGlobalNo: s.lastReceiptGlobalNo ?? undefined,
      lastFiscalDayNo: s.fiscalDayNo ?? undefined,
    };
  });

  private pollTimer?: ReturnType<typeof setInterval>;
  private deviceID: number | null = null;

  readonly verifyMsg = signal<string | null>(null);

  readonly FiscalDayStatus = FiscalDayStatus;
  readonly FiscalDayReconciliationMode = FiscalDayReconciliationMode;
  readonly receiptTypeLabel = receiptTypeLabel;

  readonly processing = computed(() => this.status()?.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseInitiated);

  ngOnInit(): void {
    void this.loadAndMaybePoll();
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private async resolveDeviceID(): Promise<number | null> {
    if (this.fdmsContext.getDeviceID() != null) return this.fdmsContext.getDeviceID();
    const cert = await this.storage.getAnyDeviceCertificate();
    return cert?.deviceID ?? null;
  }

  private async loadAndMaybePoll(): Promise<void> {
    try {
      this.loadError.set(null);
      this.deviceID = await this.resolveDeviceID();
      if (!this.deviceID) {
        this.loadError.set('Device ID is missing. Please complete setup first.');
        return;
      }

      void this.fiscalDayStore.loadStatus(this.deviceID).catch(() => {});

      this.pollTimer = setInterval(() => {
        if (this.status()?.fiscalDayStatus === FiscalDayStatus.FiscalDayCloseInitiated) {
            void this.fiscalDayStore.loadStatus(this.deviceID!).catch(() => {});
        } else {
          // Stop polling once not close initiated.
          if (this.pollTimer) clearInterval(this.pollTimer);
        }
      }, 10_000);
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : String(e));
    }
  }

  // Status is sourced from `FiscalDayStore`; polling calls `loadStatus()`.

  statusLabel(): string {
    const s = this.status();
    if (!s) return '—';
    switch (s.fiscalDayStatus) {
      case FiscalDayStatus.FiscalDayClosed:
        return 'FiscalDayClosed';
      case FiscalDayStatus.FiscalDayOpened:
        return 'FiscalDayOpened';
      case FiscalDayStatus.FiscalDayCloseInitiated:
        return 'FiscalDayCloseInitiated';
      case FiscalDayStatus.FiscalDayCloseFailed:
      default:
        return 'FiscalDayCloseFailed';
    }
  }

  badgeClass(): string {
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

  closeErrorCodeLabel(): string {
    const s = this.status();
    const code = s?.fiscalDayClosingErrorCode;
    if (code == null) return '-';
    return String(code);
  }

  closeActionGuidance(): string {
    const code = this.status()?.fiscalDayClosingErrorCode;
    switch (code) {
      case FiscalDayProcessingError.BadCertificateSignature:
        return 'Certificate signature failed. Renew your device certificate in Setup > Issue / Renew Certificate.';
      case FiscalDayProcessingError.MissingReceipts:
        return 'Grey receipts outstanding. Ensure all submitted receipts are processed for this fiscal day.';
      case FiscalDayProcessingError.ReceiptsWithValidationErrors:
        return 'Red receipts present. Fix receipt validation errors and resubmit before closing.';
      case FiscalDayProcessingError.CountersMismatch:
        return 'Counters mismatch. Recheck totals and ensure receipts are correctly submitted.';
      default:
        return 'Check the FDMS error details and retry close.';
    }
  }

  formatCounterTaxOrMoney(c: any): string {
    if (c.fiscalCounterTaxID != null) {
      const pct = c.fiscalCounterTaxPercent != null ? ` (${c.fiscalCounterTaxPercent}%)` : '';
      return `TaxID ${c.fiscalCounterTaxID}${pct}`;
    }
    if (c.fiscalCounterMoneyType != null) return `MoneyType ${c.fiscalCounterMoneyType}`;
    return '-';
  }

  signaturePayloadText(): string {
    const sig = this.status()?.fiscalDayServerSignature;
    if (!sig) return '';
    return JSON.stringify(sig, null, 2);
  }

  signatureText(): string {
    const sig = this.status()?.fiscalDayServerSignature;
    if (!sig) return '';
    return `hash=${sig.hash}\nsignature=${sig.signature}\n`;
  }

  verifySignature(): void {
    const sig = this.status()?.fiscalDayServerSignature;
    if (!sig) {
      this.verifyMsg.set('No server signature available to verify.');
      return;
    }
    if (!sig.certificateThumbprint?.trim()) {
      this.verifyMsg.set('Missing certificate thumbprint in server signature payload.');
      return;
    }
    if (!sig.hash?.trim() || !sig.signature?.trim()) {
      this.verifyMsg.set('Server signature payload is incomplete (hash/signature missing).');
      return;
    }
    this.verifyMsg.set('Verifying server certificate thumbprint...');
    this.certificateService.getServerCertificate({ thumbprint: sig.certificateThumbprint }).subscribe({
      next: (res) => void this.finishVerifyWithCertificate(sig.certificateThumbprint, res.certificate ?? []),
      error: (e) =>
        this.verifyMsg.set(`Could not fetch FDMS certificate by thumbprint. ${e instanceof Error ? e.message : String(e)}`),
    });
  }

  private async finishVerifyWithCertificate(expectedThumbprint: string, certChain: string[]): Promise<void> {
    const leafPem = certChain[0];
    if (!leafPem) {
      this.verifyMsg.set('FDMS certificate response did not include a certificate chain.');
      return;
    }

    const der = this.pemCertToDer(leafPem);
    if (!der) {
      this.verifyMsg.set('Could not parse returned FDMS certificate PEM.');
      return;
    }

    const actualSha1Hex = await this.sha1Hex(der);
    const expectedHex = this.normalizeThumbprintToHex(expectedThumbprint);
    if (!expectedHex) {
      this.verifyMsg.set('Server signature thumbprint format is not recognized (expected hex or base64).');
      return;
    }

    if (actualSha1Hex !== expectedHex) {
      this.verifyMsg.set('FDMS certificate thumbprint mismatch. Server signature cannot be trusted.');
      return;
    }

    this.verifyMsg.set(
      'FDMS certificate thumbprint matches. Note: full fiscalDayServerSignature cryptographic verification (spec 13.3.2) requires fiscalDayDate and fiscalDayDeviceSignature inputs that are not present in current getStatus payload.'
    );
  }

  private normalizeThumbprintToHex(value: string): string | null {
    const raw = value.trim();
    if (!raw) return null;

    const compactHex = raw.replace(/[:\s-]/g, '').toLowerCase();
    if (/^[0-9a-f]+$/.test(compactHex) && compactHex.length % 2 === 0) {
      return compactHex;
    }

    try {
      const b64 = raw.replace(/\s+/g, '');
      const binary = atob(b64);
      let hex = '';
      for (let i = 0; i < binary.length; i++) {
        hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return hex.toLowerCase();
    } catch {
      return null;
    }
  }

  private pemCertToDer(pem: string): Uint8Array | null {
    const body = pem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/[\r\n\s]/g, '');
    if (!body) return null;
    try {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      return null;
    }
  }

  private async sha1Hex(bytes: Uint8Array): Promise<string> {
    const arr = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-1', arr);
    const out = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, '0');
    return hex.toLowerCase();
  }
}

