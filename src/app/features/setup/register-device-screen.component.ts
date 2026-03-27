import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { DeviceService } from '../../core/services/device.service';
import { FdmsContextService, TaxpayerVerificationContext } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { generateZimraCsrPem, getZimraCsrCN, isPemCertificateRequest, parseCertificateValidity, tryParseCsrPem } from './lib/crypto-utils';
import { RegisterDeviceRequest } from '../../core/models/api.models';

function formatIsoDate(d: Date): string {
  // Keep it simple/portable: local date.
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

@Component({
  selector: 'zimra-register-device',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Register New Device
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Review your taxpayer details, generate/paste a CSR, and register the device certificate.
        </p>

        @if (!ctx()) {
          <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            Setup context is missing. Please go back and verify again.
          </div>
          <div class="mt-4">
            <zimra-button variant="secondary" (click)="router.navigate(['/setup/verify'])">Back to Verify</zimra-button>
          </div>
        }

        @if (ctx()) {
          <div class="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Verified Taxpayer</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Name:</span> {{ ctx()!.taxPayerName }}</div>
                  <div><span class="font-semibold">TIN:</span> {{ ctx()!.taxPayerTIN }}</div>
                  @if (ctx()!.vatNumber) {
                    <div><span class="font-semibold">VAT:</span> {{ ctx()!.vatNumber }}</div>
                  }
                  <div><span class="font-semibold">Branch:</span> {{ ctx()!.deviceBranchName }}</div>
                  <div class="text-slate-600 dark:text-slate-300">
                    {{ formatAddress(ctx()!.deviceBranchAddress) }}
                  </div>
                  @if (ctx()!.deviceBranchContacts?.phoneNo || ctx()!.deviceBranchContacts?.email) {
                    <div class="text-slate-600 dark:text-slate-300">
                      {{ formatContacts(ctx()!.deviceBranchContacts) }}
                    </div>
                  }
                </div>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Certificate Signing Request (CSR)</div>
                <div class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  A CSR is a request that proves your device owns a cryptographic key. ZIMRA uses it to generate
                  your device certificate.
                </div>

                <div class="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-zimra-charcoal">
                  <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">CN format requirement</div>
                  <div class="mt-1 font-mono text-sm text-slate-900 dark:text-slate-100">
                    {{ zimraCsrCN() }}
                  </div>
                </div>

                <div class="mt-5 grid gap-5">
                  <div>
                    <zimra-button variant="secondary" (click)="generateCsr()">
                      Generate CSR for me
                    </zimra-button>
                    <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Uses Web Crypto (ECC secp256r1 / P-256) and generates a CSR automatically.
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
                      <div class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                        {{ csrError() }}
                      </div>
                    } @else {
                      <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        PEM certificate request is {{ csrValid() ? 'valid' : 'not validated yet' }}.
                      </div>
                    }
                  </div>
                </div>

                <div class="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    Choose either "Generate CSR" or paste your own, then register the device.
                  </div>
                  <zimra-button variant="primary" [disabled]="registerDisabled()" (click)="registerDevice()">
                    Register Device
                  </zimra-button>
                </div>
              </zimra-card>
            </div>
          </div>

          @if (registerError()) {
            <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {{ registerError() }}
            </div>
          }

          @if (registeredCertificatePem()) {
            <div class="mt-6">
              <details class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal">
                <summary class="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Registered certificate (PEM)
                </summary>
                <div class="mt-3 text-sm">
                  <div class="grid gap-1 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <span class="font-semibold">Valid from:</span>
                      {{ certificateValidFromFormatted() }}
                    </div>
                    <div>
                      <span class="font-semibold">Valid till:</span>
                      {{ certificateValidTillFormatted() }}
                    </div>
                  </div>
                  <textarea
                    class="mt-4 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                    rows="10"
                    readonly
                    [value]="registeredCertificatePem()"
                  ></textarea>
                </div>
              </details>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class RegisterDeviceScreenComponent {
  readonly router = inject(Router);
  private readonly deviceService = inject(DeviceService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly ctx = computed(() => this.fdmsContext.getVerifyResult());

  readonly deviceID = computed(() => this.fdmsContext.getDeviceID());
  readonly activationKey = computed(() => this.fdmsContext.getActivationKey());
  readonly deviceSerialNo = computed(() => this.fdmsContext.getDeviceSerialNo());

  readonly zimraCsrCN = computed(() => {
    const serial = this.deviceSerialNo();
    const deviceID = this.deviceID();
    if (!serial || deviceID == null) return '';
    return getZimraCsrCN(serial, deviceID);
  });

  readonly csrPem = signal<string>('');
  readonly csrError = signal<string | null>(null);
  readonly csrValid = signal<boolean>(false);

  readonly generating = signal<boolean>(false);
  readonly registerLoading = signal<boolean>(false);
  readonly registerError = signal<string | null>(null);

  readonly registeredCertificatePem = signal<string | null>(null);
  readonly certificateValidFromFormatted = signal<string>('');
  readonly certificateValidTillFormatted = signal<string>('');

  readonly registerDisabled = computed(() => {
    return (
      this.registerLoading() ||
      this.generating() ||
      !this.csrValid() ||
      this.deviceID() == null ||
      !this.activationKey() ||
      !this.deviceSerialNo()
    );
  });

  async generateCsr(): Promise<void> {
    const deviceID = this.deviceID();
    const deviceSerialNo = this.deviceSerialNo();
    if (deviceID == null || !deviceSerialNo) return;

    this.generating.set(true);
    this.registerError.set(null);
    this.csrError.set(null);

    try {
      const pem = await generateZimraCsrPem({ deviceSerialNo, deviceID });
      this.csrPem.set(pem);
      // Generation already comes from a trusted generator, but we still validate.
      const parsed = tryParseCsrPem(pem);
      this.csrValid.set(parsed.ok);
      if (!parsed.ok) this.csrError.set(parsed.error);
    } catch (e) {
      this.csrError.set(e instanceof Error ? e.message : String(e));
      this.csrValid.set(false);
    } finally {
      this.generating.set(false);
    }
  }

  onCsrPaste(pem: string): void {
    const trimmed = pem.trim();
    this.csrPem.set(trimmed);
    this.csrError.set(null);
    this.registerError.set(null);

    if (!isPemCertificateRequest(trimmed)) {
      this.csrValid.set(false);
      // Avoid overly noisy messages while typing.
      this.csrError.set('Paste the full CSR PEM block.');
      return;
    }

    const parsed = tryParseCsrPem(trimmed);
    this.csrValid.set(parsed.ok);
    if (!parsed.ok) this.csrError.set(parsed.error);
  }

  registerDevice(): void {
    const deviceID = this.deviceID();
    if (deviceID == null) return;

    const certificateRequest = this.csrPem().trim();
    if (!certificateRequest || !this.csrValid()) return;

    const req: RegisterDeviceRequest = {
      deviceID,
      activationKey: this.activationKey(),
      certificateRequest,
    };

    this.registerLoading.set(true);
    this.registerError.set(null);
    this.registeredCertificatePem.set(null);

    try {
      this.deviceService.registerDevice(req).subscribe({
        next: async (res) => {
          try {
            const { validFrom, validTill } = parseCertificateValidity(res.certificate);
            this.certificateValidFromFormatted.set(formatIsoDate(validFrom));
            this.certificateValidTillFormatted.set(formatIsoDate(validTill));
          } catch {
            // If parsing fails, still show certificate.
            this.certificateValidFromFormatted.set('Unknown');
            this.certificateValidTillFormatted.set('Unknown');
          }

          this.registeredCertificatePem.set(res.certificate);

          // Save to IndexedDB for GetConfig + renew flow.
          try {
            const { validFrom, validTill } = parseCertificateValidity(res.certificate);
            await this.storage.saveDeviceCertificate({
              deviceID,
              deviceSerialNo: this.deviceSerialNo(),
              certificatePem: res.certificate,
              validFrom: validFrom.toISOString(),
              validTill: validTill.toISOString(),
            });
          } catch {
            // Storage is best-effort.
          }

          // Move the user forward immediately.
          this.router.navigate(['/setup/get-config']);
        },
        error: (e) => {
          this.registerError.set(e instanceof Error ? e.message : 'Register device failed.');
          this.registerLoading.set(false);
        },
        complete: () => this.registerLoading.set(false),
      });
    } catch (e) {
      this.registerError.set(e instanceof Error ? e.message : String(e));
      this.registerLoading.set(false);
    }
  }

  formatAddress(address: any): string {
    if (!address) return '';
    const { province, city, street, houseNo } = address;
    return [province, city, street ? `${street} ${houseNo ?? ''}` : undefined].filter(Boolean).join(', ');
  }

  formatContacts(contacts: any): string {
    if (!contacts) return '';
    const phone = contacts.phoneNo ? `Phone: ${contacts.phoneNo}` : '';
    const email = contacts.email ? `Email: ${contacts.email}` : '';
    return [phone, email].filter(Boolean).join(' | ');
  }
}

