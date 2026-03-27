import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '../../shared/components/ui/card.component';
import { InputComponent } from '../../shared/components/ui/input.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { DeviceService } from '../../core/services/device.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import {
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  VerifyTaxpayerInformationRequest,
  VerifyTaxpayerInformationResponse,
} from '../../core/models/api.models';

@Component({
  standalone: true,
  selector: 'zimra-setup',
  imports: [CommonModule, CardComponent, InputComponent, ButtonComponent],
  template: `
    <div class="mx-auto w-full max-w-5xl px-4 py-10">
      <zimra-card>
        <div class="mb-6 flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-semibold text-slate-600">FDMS</div>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Device Registration & Setup
            </h1>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Step {{ stepLabel() }}. Configure the device, verify taxpayer info, then register the device certificate.
            </p>
          </div>
          <div class="text-right">
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode</div>
            <div class="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100">
              {{ currentBaseUrl() }}
            </div>
          </div>
        </div>

        @if (error()) {
          <div class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {{ error() }}
          </div>
        }

        @if (loading()) {
          <div class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Working...</div>
        }

        <div class="grid gap-6 md:grid-cols-2">
          @if (step() === 1) {
            <div class="md:col-span-2">
              <div class="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Step 1: Context + Device Details
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <zimra-input label="FDMS Base URL" [value]="baseUrl()" (valueChange)="baseUrl.set($event)" placeholder="https://fdmsapitest.zimra.co.zw" />
                <zimra-input label="Device Model Name" [value]="deviceModelName()" (valueChange)="deviceModelName.set($event)" placeholder="e.g. ZIMRA-Model" />
                <zimra-input label="Device Model Version" [value]="deviceModelVersion()" (valueChange)="deviceModelVersion.set($event)" placeholder="e.g. 1.0.0" />
                <zimra-input label="Device ID" [value]="deviceID()" (valueChange)="deviceID.set($event)" type="number" placeholder="e.g. 1111" />
                <zimra-input label="Activation Key" [value]="activationKey()" (valueChange)="activationKey.set($event)" placeholder="8-char key" />
                <zimra-input label="Device Serial No" [value]="deviceSerialNo()" (valueChange)="deviceSerialNo.set($event)" placeholder="e.g. SN-001" />
              </div>

              <div class="mt-6 flex justify-end gap-3">
                <zimra-button [variant]="'secondary'" (click)="applyContextAndGo(2)">
                  Save & Verify
                </zimra-button>
              </div>
            </div>
          }

          @if (step() === 2) {
            <div class="md:col-span-2">
              <div class="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Step 2: Verify taxpayer information
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-200">
                  <div class="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Input</div>
                  <div>DeviceID: <span class="font-semibold">{{ deviceID() || '—' }}</span></div>
                  <div>ActivationKey: <span class="font-semibold">{{ activationKey() || '—' }}</span></div>
                  <div>SerialNo: <span class="font-semibold">{{ deviceSerialNo() || '—' }}</span></div>
                </div>

                <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-200">
                  <div class="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Result</div>
                  @if (!verifyResult()) {
                    <div class="text-slate-500 dark:text-slate-400">Not verified yet.</div>
                  } @else {
                    <div class="space-y-1">
                      <div><span class="font-semibold">Taxpayer:</span> {{ verifyResult()?.taxPayerName }}</div>
                      <div><span class="font-semibold">TIN:</span> {{ verifyResult()?.taxPayerTIN }}</div>
                      <div><span class="font-semibold">VAT:</span> {{ verifyResult()?.vatNumber ?? '—' }}</div>
                      <div><span class="font-semibold">Branch:</span> {{ verifyResult()?.deviceBranchName }}</div>
                    </div>
                  }
                </div>
              </div>

              <div class="mt-6 flex justify-end gap-3">
                <zimra-button [variant]="'secondary'" (click)="verify()">
                  Verify
                </zimra-button>
                <zimra-button [variant]="'primary'" (click)="step.set(3)" [disabled]="!verifyResult()">
                  Continue
                </zimra-button>
              </div>
            </div>
          }

          @if (step() === 3) {
            <div class="md:col-span-2">
              <div class="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Step 3: Register device (CSR)
              </div>

              <div class="grid gap-4 md:grid-cols-1">
                <label class="block">
                  <div class="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    Certificate Signing Request (CSR) - PEM
                  </div>
                  <textarea
                    class="min-h-40 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900
                           placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                    [value]="certificateRequest()"
                    (input)="certificateRequest.set(($any($event.target).value ?? ''))"
                    placeholder="Paste CSR PEM here..."
                  ></textarea>
                </label>
              </div>

              <div class="mt-6 grid gap-4 md:grid-cols-2">
                <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-200">
                  <div class="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Certificate</div>
                  @if (!registerResult()) {
                    <div class="text-slate-500 dark:text-slate-400">Not registered yet.</div>
                  } @else {
                    <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{{ registerResult()!.certificate }}</pre>
                  }
                </div>
                <div class="flex items-end justify-end">
                  <div class="w-full">
                    <div class="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</div>
                    <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <zimra-button [variant]="'secondary'" (click)="step.set(2)">
                        Back
                      </zimra-button>
                      <zimra-button [variant]="'primary'" (click)="register()" [disabled]="!certificateRequest()">
                        Register Device
                      </zimra-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </zimra-card>
    </div>
  `,
})
export class SetupComponent {
  readonly fdmsContext = inject(FdmsContextService);
  private readonly deviceService = inject(DeviceService);

  readonly step = signal<1 | 2 | 3>(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly baseUrl = signal('https://fdmsapitest.zimra.co.zw');
  readonly deviceModelName = signal('');
  readonly deviceModelVersion = signal('');

  readonly deviceID = signal('');
  readonly activationKey = signal('');
  readonly deviceSerialNo = signal('');
  readonly certificateRequest = signal('');

  readonly verifyResult = signal<VerifyTaxpayerInformationResponse | null>(null);
  readonly registerResult = signal<RegisterDeviceResponse | null>(null);

  readonly stepLabel = computed(() => (this.step() === 1 ? '1/3' : this.step() === 2 ? '2/3' : '3/3'));
  readonly currentBaseUrl = computed(() => this.fdmsContext.getBaseUrl());

  private get deviceIDNumber(): number | null {
    const n = Number(this.deviceID());
    return Number.isFinite(n) ? n : null;
  }

  applyContextAndGo(nextStep: 2): void {
    this.error.set(null);
    this.registerResult.set(null);
    this.verifyResult.set(null);
    this.step.set(nextStep);
    this.applyContext();
    this.verify();
  }

  private applyContext(): void {
    this.fdmsContext.setBaseUrl(this.baseUrl());
    this.fdmsContext.setDeviceModel(this.deviceModelName(), this.deviceModelVersion());
  }

  verify(): void {
    const deviceID = this.deviceIDNumber;
    const activationKey = this.activationKey();
    const deviceSerialNo = this.deviceSerialNo();

    if (!deviceID) {
      this.error.set('Device ID is required and must be a number.');
      return;
    }
    if (!activationKey || activationKey.length < 1) {
      this.error.set('Activation key is required.');
      return;
    }
    if (!deviceSerialNo) {
      this.error.set('Device serial number is required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const req: VerifyTaxpayerInformationRequest = { deviceID, activationKey, deviceSerialNo };
    this.deviceService.verifyTaxpayerInformation(req).subscribe({
      next: (res) => {
        this.verifyResult.set(res);
        this.step.set(2);
      },
      error: (e) => {
        this.error.set(this.formatError(e));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  register(): void {
    const deviceID = this.deviceIDNumber;
    const activationKey = this.activationKey();
    const certificateRequest = this.certificateRequest();

    if (!deviceID) {
      this.error.set('Device ID is required and must be a number.');
      return;
    }
    if (!activationKey || activationKey.length < 1) {
      this.error.set('Activation key is required.');
      return;
    }
    if (!certificateRequest || certificateRequest.length < 1) {
      this.error.set('CSR (certificate request) is required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const req: RegisterDeviceRequest = { deviceID, activationKey, certificateRequest };
    this.deviceService.registerDevice(req).subscribe({
      next: (res) => {
        this.registerResult.set(res);
        this.step.set(3);
      },
      error: (e) => {
        this.error.set(this.formatError(e));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private formatError(e: unknown): string {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object' && 'message' in e) {
      return String((e as { message?: unknown }).message ?? 'Request failed');
    }
    return 'Request failed. Check FDMS configuration and inputs.';
  }
}

