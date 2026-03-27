import { Component, computed, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { CertificateService } from '../../core/services/certificate.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import {
  generateZimraCsrPem,
  getZimraCsrCN,
  isPemCertificateRequest,
  parseCertificateValidity,
  tryParseCsrPem,
} from './lib/crypto-utils';
import { IssueCertificateRequest } from '../../core/models/api.models';

type DeviceCertificateRecord = {
  deviceID: number;
  deviceSerialNo: string;
  certificatePem: string;
  validFrom: string;
  validTill: string;
};

function formatIsoDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

@Component({
  selector: 'zimra-issue-certificate',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Issue / Renew Certificate
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Your device certificate is currently stored locally. Renew it using a CSR.
        </p>

        @if (!loaded()) {
          <div class="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-200">
            Loading your saved certificate details...
          </div>
        }

        @if (loaded() && !currentCertificate()) {
          <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            No existing certificate was found. Please register a new device.
          </div>
          <div class="mt-4">
            <zimra-button variant="primary" (click)="router.navigate(['/setup/verify'])">Register New Device</zimra-button>
          </div>
        }

        @if (loaded() && currentCertificate()) {
          <div class="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Current Certificate Expiry</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div>
                    <span class="font-semibold">Valid till:</span>
                    {{ formatIso(currentCertificate()!.validTill) }}
                  </div>
                  <div>
                    <span class="font-semibold">Valid from:</span>
                    {{ formatIso(currentCertificate()!.validFrom) }}
                  </div>
                  <div class="text-sm">
                    <span class="font-semibold">Countdown:</span>
                    <span
                      class="{{ isExpiringSoon() ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300' }}"
                    >
                      {{ daysLeftNumber() }} days
                    </span>
                  </div>
                  @if (isExpiringSoon()) {
                    <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                      Warning: certificate expires in less than 30 days.
                    </div>
                  }
                </div>
                <details class="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-zimra-charcoal">
                  <summary class="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Current certificate (PEM)
                  </summary>
                  <textarea
                    class="mt-3 w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                    rows="7"
                    readonly
                    [value]="currentCertificate()!.certificatePem"
                  ></textarea>
                </details>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Certificate Signing Request (CSR)</div>
                <div class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Generate a new CSR, or paste your own. ZIMRA will use it to issue a renewed certificate.
                </div>

                <div class="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zimra-charcoal">
                  <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">CN format requirement</div>
                  <div class="mt-1 font-mono text-sm text-slate-900 dark:text-slate-100">
                    {{ zimraCsrCN() }}
                  </div>
                </div>

                <div class="mt-5 grid gap-5">
                  <div>
                    <zimra-button variant="secondary" [disabled]="renewLoading()" (click)="generateCsr()">
                      Generate CSR for me
                    </zimra-button>
                    <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      ECC secp256r1 / P-256 via Web Crypto.
                    </div>
                  </div>

                  <div>
                    <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Paste my own CSR</label>
                    <textarea
                      class="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                      rows="10"
                      [value]="csrPem()"
                      (input)="onCsrPaste($any($event.target).value)"
                      placeholder="-----BEGIN CERTIFICATE REQUEST----- ... -----END CERTIFICATE REQUEST-----"
                    ></textarea>
                    @if (csrError()) {
                      <div class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{{ csrError() }}</div>
                    } @else {
                      <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        CSR is {{ csrValid() ? 'valid' : 'not validated yet' }}.
                      </div>
                    }
                  </div>
                </div>

                <div class="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    Renewing will replace your current certificate.
                  </div>
                  <zimra-button variant="primary" [disabled]="renewDisabled()" (click)="renewCertificate()">
                    Renew certificate
                  </zimra-button>
                </div>

                @if (renewError()) {
                  <div class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                    {{ renewError() }}
                  </div>
                }
              </zimra-card>
            </div>
          </div>

          @if (renewedCertificatePem()) {
            <div class="mt-6">
              <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Old vs New Certificates</div>
              <div class="mt-3 grid gap-4 lg:grid-cols-2">
                <zimra-card>
                  <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Old</div>
                  <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Valid till: {{ formatIso(currentCertificate()!.validTill) }}
                    <br />
                    Valid from: {{ formatIso(currentCertificate()!.validFrom) }}
                  </div>
                  <details class="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-zimra-charcoal">
                    <summary class="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">PEM</summary>
                    <textarea
                      class="mt-3 w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                      rows="7"
                      readonly
                      [value]="currentCertificate()!.certificatePem"
                    ></textarea>
                  </details>
                </zimra-card>

                <zimra-card>
                  <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">New</div>
                  <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Valid till: {{ formatIso(renewedCertificateValidTill()) }}
                    <br />
                    Valid from: {{ formatIso(renewedCertificateValidFrom()) }}
                  </div>
                  <details class="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-zimra-charcoal">
                    <summary class="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">PEM</summary>
                    <textarea
                      class="mt-3 w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                      rows="7"
                      readonly
                      [value]="renewedCertificatePem() ?? ''"
                    ></textarea>
                  </details>
                </zimra-card>
              </div>

              <div class="mt-4 flex justify-end">
                <zimra-button variant="primary" (click)="router.navigate(['/setup/get-config'])">Continue to Device Config</zimra-button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class IssueCertificateScreenComponent {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly certificateService = inject(CertificateService);
  private readonly storage = inject(StorageService);

  readonly loaded = signal<boolean>(false);
  readonly currentCertificate = signal<DeviceCertificateRecord | null>(null);
  readonly now = signal<number>(Date.now());

  readonly csrPem = signal<string>('');
  readonly csrError = signal<string | null>(null);
  readonly csrValid = signal<boolean>(false);

  readonly generating = signal<boolean>(false);
  readonly renewLoading = signal<boolean>(false);
  readonly renewError = signal<string | null>(null);

  readonly renewedCertificatePem = signal<string | null>(null);
  readonly renewedCertificateValidFrom = signal<string>('');
  readonly renewedCertificateValidTill = signal<string>('');
  readonly renewDisabled = computed(() => {
    return this.renewLoading() || this.generating() || !this.csrValid() || !this.deviceID();
  });

  readonly deviceID = computed(() => {
    // Prefer context (if user did registration in this session), otherwise fall back to saved certificate.
    const ctxDeviceID = this.fdmsContext.getDeviceID();
    return ctxDeviceID ?? this.currentCertificate()?.deviceID ?? null;
  });

  readonly zimraCsrCN = computed(() => {
    const deviceID = this.deviceID();
    const deviceSerialNo = this.deviceSerialNo();
    if (!deviceID || !deviceSerialNo) return '';
    return getZimraCsrCN(deviceSerialNo, deviceID);
  });

  readonly deviceSerialNo = computed(() => {
    const ctx = this.fdmsContext.getDeviceSerialNo();
    return ctx || this.currentCertificate()?.deviceSerialNo || '';
  });

  readonly daysLeft = computed(() => {
    const cert = this.currentCertificate();
    if (!cert) return null;
    const till = new Date(cert.validTill).getTime();
    const now = this.now();
    return Math.ceil((till - now) / (1000 * 60 * 60 * 24));
  });

  readonly daysLeftNumber = computed(() => {
    return this.daysLeft() ?? 0;
  });

  readonly isExpiringSoon = computed(() => {
    const d = this.daysLeft();
    return d != null && d < 30;
  });

  ngOnInit(): void {
    // Recompute expiry warnings periodically so the UI stays accurate.
    this.intervalId = setInterval(() => this.now.set(Date.now()), 60_000);
    void this.loadSavedCertificate();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private async loadSavedCertificate(): Promise<void> {
    this.loaded.set(false);
    this.renewError.set(null);
    try {
      const deviceIDFromContext = this.fdmsContext.getDeviceID();
      const record = await (deviceIDFromContext != null
        ? this.storage.getDeviceCertificate(deviceIDFromContext)
        : this.storage.getAnyDeviceCertificate());

      if (record) {
        this.currentCertificate.set(record as DeviceCertificateRecord);
        this.fdmsContext.setDeviceRegistrationContext({
          deviceID: (record as DeviceCertificateRecord).deviceID,
          activationKey: this.fdmsContext.getActivationKey() || '',
          deviceSerialNo: (record as DeviceCertificateRecord).deviceSerialNo,
          verifyResult: this.fdmsContext.getVerifyResult(),
        });
      }
    } finally {
      this.loaded.set(true);
    }
  }

  formatIso(dateIso: string): string {
    if (!dateIso) return '';
    const d = new Date(dateIso);
    return formatIsoDate(d);
  }

  async generateCsr(): Promise<void> {
    const deviceID = this.deviceID();
    const deviceSerialNo = this.deviceSerialNo();
    if (!deviceID || !deviceSerialNo) return;

    this.generating.set(true);
    this.csrError.set(null);
    try {
      const pem = await generateZimraCsrPem({ deviceSerialNo, deviceID });
      this.csrPem.set(pem);
      const parsed = tryParseCsrPem(pem);
      this.csrValid.set(parsed.ok);
      if (!parsed.ok) this.csrError.set(parsed.error);
    } catch (e) {
      this.csrValid.set(false);
      this.csrError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.generating.set(false);
    }
  }

  onCsrPaste(pem: string): void {
    const trimmed = pem.trim();
    this.csrPem.set(trimmed);
    this.csrError.set(null);
    this.renewError.set(null);

    if (!isPemCertificateRequest(trimmed)) {
      this.csrValid.set(false);
      this.csrError.set('Paste the full CSR PEM block.');
      return;
    }

    const parsed = tryParseCsrPem(trimmed);
    this.csrValid.set(parsed.ok);
    if (!parsed.ok) this.csrError.set(parsed.error);
  }

  renewCertificate(): void {
    const deviceID = this.deviceID();
    if (!deviceID) return;
    if (!this.csrValid()) return;

    const req: IssueCertificateRequest = { deviceID, certificateRequest: this.csrPem().trim() };
    this.renewLoading.set(true);
    this.renewError.set(null);
    this.renewedCertificatePem.set(null);
    this.renewedCertificateValidFrom.set('');
    this.renewedCertificateValidTill.set('');

    try {
      this.certificateService.issueCertificate(req).subscribe({
        next: async (res) => {
          const newPem = res.certificate;
          this.renewedCertificatePem.set(newPem);
          try {
            const { validFrom, validTill } = parseCertificateValidity(newPem);
            this.renewedCertificateValidFrom.set(validFrom.toISOString());
            this.renewedCertificateValidTill.set(validTill.toISOString());
          } catch {
            // keep empty
          }

          // Save new certificate.
          try {
            const { validFrom, validTill } = parseCertificateValidity(newPem);
            await this.storage.saveDeviceCertificate({
              deviceID,
              deviceSerialNo: this.deviceSerialNo(),
              certificatePem: newPem,
              validFrom: validFrom.toISOString(),
              validTill: validTill.toISOString(),
            });
            // Update current certificate in UI.
            this.currentCertificate.set({
              deviceID,
              deviceSerialNo: this.deviceSerialNo(),
              certificatePem: newPem,
              validFrom: validFrom.toISOString(),
              validTill: validTill.toISOString(),
            });
          } catch {
            // Save best-effort.
          }
          this.renewLoading.set(false);
        },
        error: (e) => {
          this.renewError.set(e instanceof Error ? e.message : 'Renewal failed.');
          this.renewLoading.set(false);
        },
        complete: () => this.renewLoading.set(false),
      });
    } catch (e) {
      this.renewError.set(e instanceof Error ? e.message : String(e));
      this.renewLoading.set(false);
    }
  }
}

