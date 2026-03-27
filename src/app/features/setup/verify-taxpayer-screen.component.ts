import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService, TaxpayerVerificationContext } from '../../core/services/fdms-context.service';
import { DeviceService } from '../../core/services/device.service';
import {
  ProblemDetails,
  VerifyTaxpayerInformationRequest,
  VerifyTaxpayerInformationResponse,
} from '../../core/models/api.models';

function formatActivationKey(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

function activationKeyRaw(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

@Component({
  selector: 'zimra-verify-taxpayer',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Verify Taxpayer Information
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter the device details and activation key to verify your business.
        </p>

        <div class="mt-6">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal">
            <div class="grid gap-5 sm:grid-cols-3">
              <!-- Device ID -->
              <div class="sm:col-span-1">
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Device ID</label>
                <input
                  class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                  type="text"
                  inputmode="numeric"
                  maxlength="10"
                  [value]="deviceIdInput()"
                  (input)="onDeviceIdInput($any($event.target).value)"
                  placeholder="e.g. 123"
                />
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">Number</div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ deviceIdDigits().length }}/10 digits
                  @if (deviceIdInput() && !deviceIdValid()) {
                    <span class="ml-2 text-red-600 dark:text-red-400 font-semibold">Check value</span>
                  }
                </div>
              </div>

              <!-- Activation Key -->
              <div class="sm:col-span-1">
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Activation Key</label>
                <input
                  class="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none transition
                    {{
                      activationKeyDev02Error()
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-slate-200 dark:border-slate-800 focus:border-zimra-gold'
                    }}
                    bg-white dark:bg-zimra-charcoal text-slate-900 dark:text-slate-100"
                  type="text"
                  [value]="activationKeyFormatted()"
                  (input)="onActivationKeyInput($any($event.target).value)"
                  placeholder="XXXX-XXXX"
                  maxlength="9"
                />
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ activationKeyRawValue().length }}/8
                </div>
                @if (activationKeyDev02Error()) {
                  <div class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    {{ activationKeyErrorMessage() }}
                  </div>
                }
              </div>

              <!-- Device Serial No -->
              <div class="sm:col-span-1">
                <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Device Serial No</label>
                <input
                  class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                  type="text"
                  [value]="deviceSerialNoInput()"
                  (input)="onDeviceSerialNoInput($any($event.target).value)"
                  placeholder="Max 20 characters"
                  maxlength="20"
                />
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ deviceSerialNoInput().length }}/20
                </div>
              </div>
            </div>

            <div class="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="text-xs text-slate-500 dark:text-slate-400">
                The activation key must be exactly 8 alphanumeric characters.
              </div>
              <zimra-button
                variant="primary"
                [disabled]="verifyDisabled()"
                (click)="verify()"
              >
                Verify
              </zimra-button>
            </div>

            @if (genericError()) {
              <div class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {{ genericError() }}
              </div>
            }
          </div>
        </div>

        @if (verifyResult()) {
          <div class="mt-8">
            <zimra-card>
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Taxpayer</div>
                  <div class="mt-2 grid gap-2 text-sm">
                    <div>
                      <span class="font-semibold">Name:</span> {{ verifyResult()!.taxPayerName }}
                    </div>
                    <div>
                      <span class="font-semibold">TIN:</span> {{ verifyResult()!.taxPayerTIN }}
                    </div>
                    @if (verifyResult()!.vatNumber) {
                      <div>
                        <span class="font-semibold">VAT:</span> {{ verifyResult()!.vatNumber }}
                      </div>
                    }
                    <div>
                      <span class="font-semibold">Branch:</span> {{ verifyResult()!.deviceBranchName }}
                    </div>
                    <div class="text-slate-600 dark:text-slate-300">
                      {{ formatAddress(verifyResult()!.deviceBranchAddress) }}
                    </div>
                    @if (verifyResult()!.deviceBranchContacts?.phoneNo || verifyResult()!.deviceBranchContacts?.email) {
                      <div class="text-slate-600 dark:text-slate-300">
                        {{
                          formatContacts(verifyResult()!.deviceBranchContacts)
                        }}
                      </div>
                    }
                  </div>
                </div>

                <div class="sm:w-64">
                  <div class="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Is this your business?
                  </div>
                  <div class="mt-3 flex gap-3">
                    <zimra-button variant="primary" (click)="confirmYes()">
                      Yes
                    </zimra-button>
                    <zimra-button variant="secondary" (click)="confirmNo()">
                      No
                    </zimra-button>
                  </div>
                </div>
              </div>
            </zimra-card>
          </div>
        }
      </div>
    </div>
  `,
})
export class VerifyTaxpayerScreenComponent {
  private readonly deviceService = inject(DeviceService);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly router = inject(Router);

  // UI state
  readonly deviceIdInput = signal<string>('');
  readonly activationKeyRawValue = signal<string>('');
  readonly deviceSerialNoInput = signal<string>('');

  readonly loading = signal<boolean>(false);
  readonly genericError = signal<string | null>(null);
  readonly verifyResult = signal<TaxpayerVerificationContext | null>(null);

  readonly dev02ActivationError = signal<boolean>(false);
  readonly activationKeyErrorMessage = signal<string>('Invalid activation key.');

  readonly activationKeyFormatted = computed(() => formatActivationKey(this.activationKeyRawValue()));

  readonly deviceIdValid = computed(() => {
    const digits = this.deviceIdDigits();
    if (!digits) return false;
    const n = Number(digits);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0 && digits.length <= 10;
  });

  readonly deviceIdDigits = computed(() => this.deviceIdInput().replace(/\D/g, '').slice(0, 10));

  readonly activationKeyValid = computed(() => /^[A-Z0-9]{8}$/.test(this.activationKeyRawValue()));
  readonly deviceSerialNoValid = computed(() => this.deviceSerialNoInput().trim().length > 0);

  readonly verifyDisabled = computed(() => {
    return this.loading() || !this.deviceIdValid() || !this.activationKeyValid() || !this.deviceSerialNoValid();
  });

  readonly activationKeyDev02Error = computed(() => {
    return this.dev02ActivationError();
  });

  constructor() {}

  // ------------------------
  // Inputs
  // ------------------------
  onDeviceIdInput(value: string): void {
    this.dev02ActivationError.set(false);
    this.genericError.set(null);
    const digits = value.replace(/\D/g, '').slice(0, 10);
    this.deviceIdInput.set(digits);
  }

  onActivationKeyInput(value: string): void {
    this.dev02ActivationError.set(false);
    this.genericError.set(null);
    this.activationKeyRawValue.set(activationKeyRaw(value));
  }

  onDeviceSerialNoInput(value: string): void {
    this.genericError.set(null);
    this.deviceSerialNoInput.set(value.slice(0, 20));
  }

  // ------------------------
  // Verify flow
  // ------------------------
  verify(): void {
    this.genericError.set(null);
    this.dev02ActivationError.set(false);

    const deviceID = Number(this.deviceIdInput());
    const activationKey = this.activationKeyRawValue();
    const deviceSerialNo = this.deviceSerialNoInput().trim();

    if (!this.deviceIdValid() || !this.activationKeyValid() || !deviceSerialNo) return;

    const req: VerifyTaxpayerInformationRequest = { deviceID, activationKey, deviceSerialNo };

    this.loading.set(true);
    try {
      this.deviceService.verifyTaxpayerInformation(req).subscribe({
        next: (res) => {
          this.verifyResult.set(this.mapVerifyResult(res));
          this.loading.set(false);
        },
        error: (e) => {
          const code = this.extractErrorCode(e);
          if (code === 'DEV02') {
            this.dev02ActivationError.set(true);
            this.activationKeyErrorMessage.set('DEV02: Activation Key is incorrect. Please verify it and try again.');
          } else {
            this.genericError.set(this.formatError(e));
          }
          this.loading.set(false);
        },
      });
    } catch (e) {
      this.genericError.set(e instanceof Error ? e.message : String(e));
      this.loading.set(false);
    }
  }

  confirmYes(): void {
    const ctx = this.verifyResult();
    if (!ctx) return;

    this.fdmsContext.setDeviceRegistrationContext({
      deviceID: Number(this.deviceIdInput()),
      activationKey: this.activationKeyRawValue(),
      deviceSerialNo: this.deviceSerialNoInput().trim(),
      verifyResult: ctx,
    });

    this.router.navigate(['/setup/register']);
  }

  confirmNo(): void {
    this.verifyResult.set(null);
    this.dev02ActivationError.set(false);
    this.genericError.set('Please re-enter the details and verify again.');
  }

  // ------------------------
  // Helpers
  // ------------------------
  private mapVerifyResult(res: VerifyTaxpayerInformationResponse): TaxpayerVerificationContext {
    return {
      taxPayerName: res.taxPayerName,
      taxPayerTIN: res.taxPayerTIN,
      vatNumber: res.vatNumber,
      deviceBranchName: res.deviceBranchName,
      deviceBranchAddress: res.deviceBranchAddress,
      deviceBranchContacts: res.deviceBranchContacts,
    };
  }

  private extractErrorCode(e: unknown): string | undefined {
    const anyE = e as any;
    return anyE?.error?.errorCode ?? anyE?.errorCode ?? anyE?.error?.error ?? anyE?.error?.code;
  }

  private formatError(e: unknown): string {
    const anyE = e as any;
    const details = anyE?.error as ProblemDetails | undefined;
    if (details?.title) return details.title;
    return anyE?.message ? String(anyE.message) : 'Verification failed. Please try again.';
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

