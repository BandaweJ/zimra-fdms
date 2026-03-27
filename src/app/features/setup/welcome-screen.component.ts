import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'zimra-setup-welcome',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-zimra-charcoal text-zimra-surface">
      <div class="absolute inset-0 zimra-animated-gradient bg-gradient-to-tr from-zimra-gold/20 via-transparent to-zimra-gold/20"></div>

      <div class="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16">
        <div class="flex flex-col items-center text-center">
          <div
            class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-zimra-border bg-zimra-surface/10 shadow-elevated"
          >
            <div class="text-center">
              <div class="text-xl font-black tracking-tight text-zimra-gold">ZIMRA</div>
            </div>
          </div>

          <h1 class="text-4xl font-bold tracking-tight text-white">
            Fiscal Device Gateway
          </h1>
          <p class="mt-3 max-w-2xl text-sm text-zimra-surface/80">
            Register and manage your fiscal device using the FDMS Fiscal Device Gateway API.
          </p>
        </div>

        <div class="mt-10 w-full max-w-xl">
          <div class="flex flex-col gap-3">
            <zimra-button variant="primary" (click)="goRegisterNew()">Register New Device</zimra-button>
            <zimra-button variant="secondary" (click)="goAlreadyRegistered()">Device Already Registered</zimra-button>
          </div>

          <div class="mt-6">
            <zimra-card>
              <div class="text-sm font-semibold text-slate-600">FDMS setup</div>
              <div class="mt-2 text-sm text-slate-600">
                Your device model and FDMS base URL should be configured before making API calls.
              </div>
            </zimra-card>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WelcomeScreenComponent {
  constructor(
    private readonly router: Router,
    private readonly storage: StorageService
  ) {}

  goRegisterNew(): void {
    this.router.navigate(['/setup/verify']);
  }

  async goAlreadyRegistered(): Promise<void> {
    try {
      const record = await this.storage.getAnyDeviceCertificate();
      if (!record) {
        this.router.navigate(['/setup/verify']);
        return;
      }

      const till = new Date(record.validTill).getTime();
      const now = Date.now();
      const daysLeft = Math.ceil((till - now) / (1000 * 60 * 60 * 24));

      if (daysLeft >= 30) {
        this.router.navigate(['/setup/get-config']);
      } else {
        this.router.navigate(['/setup/issue-certificate']);
      }
    } catch {
      // If local parsing/storage fails, fall back to the renewal screen.
      this.router.navigate(['/setup/issue-certificate']);
    }
  }
}

