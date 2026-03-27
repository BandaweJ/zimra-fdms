import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { ApiService } from '../../core/services/api.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';

@Component({
  selector: 'zimra-setup-context',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Setup Device Context
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Configure the FDMS base URL and device model so the app can call the gateway endpoints.
        </p>

        <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal">
          <div class="grid gap-5 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">FDMS Base URL</label>
              <input
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                type="url"
                [value]="baseUrl()"
                (input)="onBaseUrlInput($any($event.target).value)"
                placeholder="https://fdmsapitest.zimra.co.zw"
              />
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Source: FDMS integration/onboarding docs (sandbox or production endpoint). Do not guess this URL.
              </p>
            </div>

            <div>
              <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Device Model Name</label>
              <input
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                type="text"
                [value]="deviceModelName()"
                (input)="onDeviceModelNameInput($any($event.target).value)"
                placeholder="e.g. ZIMRA-FDMS-Model"
              />
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Source: the certified model name provided by your fiscal device vendor/ZIMRA registration pack.
              </p>
            </div>

            <div>
              <label class="text-xs font-semibold text-slate-600 dark:text-slate-300">Device Model Version</label>
              <input
                class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-zimra-gold dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-100"
                type="text"
                [value]="deviceModelVersion()"
                (input)="onDeviceModelVersionInput($any($event.target).value)"
                placeholder="e.g. 1.0"
              />
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Source: the exact model version approved for your device model (vendor-issued).
              </p>
            </div>
          </div>

          @if (error()) {
            <div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {{ error() }}
            </div>
          }

          <div class="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div class="text-xs text-slate-500 dark:text-slate-400">
              This is required before verifying the taxpayer, registering the device, or loading config.
            </div>
            <zimra-button
              variant="primary"
              [disabled]="saveDisabled()"
              (click)="saveAndContinue()"
            >
              Save & Continue
            </zimra-button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ContextSetupScreenComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly api = inject(ApiService);

  readonly baseUrl = signal<string>(this.fdmsContext.getBaseUrl());
  readonly deviceModelName = signal<string>('');
  readonly deviceModelVersion = signal<string>('');

  readonly error = signal<string | null>(null);

  readonly returnUrl = computed(() => {
    const raw = this.route.snapshot.queryParams['returnUrl'];
    return typeof raw === 'string' && raw ? raw : '/setup/verify';
  });

  private readonly initialised = signal<boolean>(false);

  private ensureInitialised(): void {
    if (this.initialised()) return;
    try {
      // If already configured, prefill from local context by calling required headers.
      const headers = this.fdmsContext.getRequiredHeaders();
      this.deviceModelName.set(headers.deviceModelName);
      this.deviceModelVersion.set(headers.deviceModelVersion);
    } catch {
      // leave empty
    }
    this.initialised.set(true);
  }

  constructor() {
    this.ensureInitialised();
  }

  onBaseUrlInput(value: string): void {
    this.baseUrl.set(value);
  }

  onDeviceModelNameInput(value: string): void {
    this.deviceModelName.set(value);
  }

  onDeviceModelVersionInput(value: string): void {
    this.deviceModelVersion.set(value);
  }

  readonly saveDisabled = computed(() => {
    return !this.baseUrl().trim() || !this.deviceModelName().trim() || !this.deviceModelVersion().trim();
  });

  saveAndContinue(): void {
    this.error.set(null);
    try {
      const baseUrl = this.baseUrl().trim();
      const deviceModelName = this.deviceModelName().trim();
      const deviceModelVersion = this.deviceModelVersion().trim();
      if (!baseUrl) throw new Error('Base URL is required.');

      this.fdmsContext.setBaseUrl(baseUrl);
      this.fdmsContext.setDeviceModel(deviceModelName, deviceModelVersion);

      // Ensure ApiService uses the updated base URL immediately.
      this.api.setBaseUrl(this.fdmsContext.getBaseUrl());

      this.router.navigateByUrl(this.returnUrl());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}

