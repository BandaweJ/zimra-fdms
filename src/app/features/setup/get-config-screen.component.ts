import { Component, computed, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { FiscalDayService } from '../../core/services/fiscal-day.service';
import { StorageService } from '../../core/services/storage.service';
import { GetConfigResponse } from '../../core/models/api.models';

function formatIsoDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

@Component({
  selector: 'zimra-get-config',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Device Configuration
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Config loaded from the FDMS gateway for your device. Review and start using it.
        </p>

        @if (loading()) {
          <div class="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-zimra-charcoal dark:text-slate-200">
            Loading config...
          </div>
        }

        @if (error()) {
          <div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {{ error() }}
          </div>
        }

        @if (config()) {
          <div class="mt-6 grid gap-6 lg:grid-cols-2">
            <div class="lg:col-span-2">
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Taxpayer</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Name:</span> {{ config()!.taxPayerName }}</div>
                  <div><span class="font-semibold">TIN:</span> {{ config()!.taxPayerTIN }}</div>
                  @if (config()!.vatNumber) {
                    <div><span class="font-semibold">VAT:</span> {{ config()!.vatNumber }}</div>
                  }
                </div>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Branch</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Name:</span> {{ config()!.deviceBranchName }}</div>
                  <div class="text-slate-600 dark:text-slate-300">
                    {{ formatAddress(config()!.deviceBranchAddress) }}
                  </div>
                  @if (config()!.deviceBranchContacts?.phoneNo || config()!.deviceBranchContacts?.email) {
                    <div class="text-slate-600 dark:text-slate-300">
                      {{ formatContacts(config()!.deviceBranchContacts) }}
                    </div>
                  }
                </div>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Device</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Device ID:</span> {{ deviceID() ?? '-' }}</div>
                  <div><span class="font-semibold">Serial:</span> {{ config()!.deviceSerialNo }}</div>
                  <div>
                    <span class="font-semibold">Operating mode:</span> {{ operatingModeLabel(config()!.deviceOperatingMode) }}
                  </div>
                </div>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Certificate Validity</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Valid from:</span> {{ certificateValidFromFormatted() }}</div>
                  <div><span class="font-semibold">Valid till:</span> {{ certificateValidTillFormatted() }}</div>
                  <div class="text-sm">
                    <span class="font-semibold">Countdown:</span>
                    <span class="{{ isExpiringSoon() ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300' }}">
                      {{ daysLeft() }} days
                    </span>
                  </div>
                </div>
              </zimra-card>
            </div>

            <div>
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Day Duration</div>
                <div class="mt-3 grid gap-2 text-sm">
                  <div><span class="font-semibold">Max hours:</span> {{ config()!.taxPayerDayMaxHrs }}</div>
                  <div><span class="font-semibold">Notification hours:</span> {{ config()!.taxpayerDayEndNotificationHrs }}</div>
                </div>
              </zimra-card>
            </div>

            <div class="lg:col-span-2">
              <zimra-card>
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">Applicable Taxes</div>
                    <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      These taxes apply to receipts and totals for the device.
                    </div>
                  </div>
                </div>

                <div class="mt-4 overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="text-xs font-semibold text-slate-500">
                      <tr>
                        <th class="px-3 py-2">Tax ID</th>
                        <th class="px-3 py-2">Name</th>
                        <th class="px-3 py-2">Rate</th>
                        <th class="px-3 py-2">Valid From</th>
                        <th class="px-3 py-2">Valid Till</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (t of config()!.applicableTaxes; track t.taxID) {
                        <tr class="border-t border-slate-200 dark:border-slate-800">
                          <td class="px-3 py-2 font-mono">{{ t.taxID }}</td>
                          <td class="px-3 py-2">{{ t.taxName }}</td>
                          <td class="px-3 py-2">{{ t.taxPercent ?? '-' }}</td>
                          <td class="px-3 py-2 font-mono">{{ t.taxValidFrom }}</td>
                          <td class="px-3 py-2 font-mono">{{ t.taxValidTill ?? '-' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </zimra-card>
            </div>

            <div class="lg:col-span-2">
              <zimra-card>
                <div class="text-sm font-semibold text-slate-600 dark:text-slate-300">QR URL</div>
                <div class="mt-3 break-all font-mono text-xs text-slate-800 dark:text-slate-200">
                  <a class="underline" [href]="config()!.qrUrl" target="_blank" rel="noreferrer">{{ config()!.qrUrl }}</a>
                </div>

                <div class="mt-5 flex justify-end">
                  <zimra-button variant="primary" (click)="startUsingDevice()">Looks good — start using device</zimra-button>
                </div>
              </zimra-card>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class GetConfigScreenComponent implements OnInit, OnDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private readonly router = inject(Router);
  private readonly fdmsContext = inject(FdmsContextService);
  private readonly fiscalDayService = inject(FiscalDayService);
  private readonly storage = inject(StorageService);

  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly config = signal<GetConfigResponse | null>(null);
  readonly now = signal<number>(Date.now());
  readonly savedCertificateValidFrom = signal<string | null>(null);

  readonly deviceID = computed(() => this.fdmsContext.getDeviceID());

  readonly daysLeft = computed(() => {
    const c = this.config();
    if (!c) return 0;
    const till = new Date(c.certificateValidTill).getTime();
    const now = this.now();
    return Math.ceil((till - now) / (1000 * 60 * 60 * 24));
  });

  readonly isExpiringSoon = computed(() => {
    return this.daysLeft() < 30;
  });

  readonly certificateValidTillFormatted = computed(() => {
    const c = this.config();
    if (!c) return '';
    return formatIsoDate(new Date(c.certificateValidTill));
  });

  readonly certificateValidFromFormatted = computed(() => {
    const iso = this.savedCertificateValidFrom();
    if (!iso) return '-';
    return formatIsoDate(new Date(iso));
  });

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.now.set(Date.now()), 60_000);
    void this.loadConfig();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private async resolveDeviceID(): Promise<number | null> {
    if (this.fdmsContext.getDeviceID() != null) return this.fdmsContext.getDeviceID();
    const record = await this.storage.getAnyDeviceCertificate();
    if (!record) return null;
    // Ensure context has what GetConfig needs for follow-up screens.
    this.fdmsContext.setDeviceRegistrationContext({
      deviceID: record.deviceID,
      activationKey: this.fdmsContext.getActivationKey() || '',
      deviceSerialNo: record.deviceSerialNo,
      verifyResult: this.fdmsContext.getVerifyResult(),
    });
    this.savedCertificateValidFrom.set(record.validFrom);
    return record.deviceID;
  }

  private async loadConfig(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.config.set(null);

    const deviceID = await this.resolveDeviceID();
    if (deviceID == null) {
      this.loading.set(false);
      this.error.set('Device ID is missing. Please register the device first.');
      return;
    }

    try {
      this.fiscalDayService.getConfig({ deviceID }).subscribe({
        next: (res) => this.config.set(res),
        error: (e) => this.error.set(e instanceof Error ? e.message : 'Failed to load device configuration.'),
        complete: () => this.loading.set(false),
      });
    } catch (e) {
      this.loading.set(false);
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  startUsingDevice(): void {
    this.router.navigate(['/dashboard']);
  }

  operatingModeLabel(mode: number): string {
    switch (mode) {
      case 0:
        return 'Online';
      case 1:
        return 'Offline';
      default:
        return String(mode);
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

  formatIso(d: Date): string {
    return formatIsoDate(d);
  }
}

