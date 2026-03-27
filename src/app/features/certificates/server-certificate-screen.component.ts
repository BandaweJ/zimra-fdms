import { Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { CertificateService } from '../../core/services/certificate.service';

@Component({
  selector: 'zimra-server-certificate-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Server Certificate</h1>
        <zimra-card class="mt-4">
          <div class="grid gap-3 md:grid-cols-[1fr_auto]">
            <input class="rounded border p-2" placeholder="Thumbprint (optional)" [value]="thumbprint()" (input)="thumbprint.set($any($event.target).value)" />
            <zimra-button variant="primary" (click)="load()">Load</zimra-button>
          </div>

          @if (error()) {
            <div class="mt-3 text-xs text-red-600">{{ error() }}</div>
          }

          @if (chain().length) {
            <div class="mt-4 rounded border border-slate-200 p-3">
              <div class="text-sm font-semibold">certificateValidTill</div>
              <div class="mt-1 font-mono text-sm">{{ validTill() }}</div>
            </div>
            <div class="mt-4 space-y-3">
              @for (pem of chain(); track $index) {
                <details class="rounded border border-slate-200 p-3">
                  <summary class="cursor-pointer text-xs font-semibold">Certificate {{ $index + 1 }}</summary>
                  <pre class="mt-2 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs">{{ pem }}</pre>
                </details>
              }
            </div>
            <div class="mt-4 flex justify-end">
              <zimra-button variant="secondary" (click)="useForVerification()">Use for signature verification</zimra-button>
            </div>
            @if (saved()) {
              <div class="mt-2 text-xs text-emerald-700">Verification certificate saved.</div>
            }
          }
        </zimra-card>
      </div>
    </div>
  `,
})
export class ServerCertificateScreenComponent {
  private readonly certificateService = inject(CertificateService);

  readonly thumbprint = signal<string>('');
  readonly chain = signal<string[]>([]);
  readonly validTill = signal<string>('');
  readonly error = signal<string>('');
  readonly saved = signal<boolean>(false);

  load(): void {
    this.error.set('');
    this.saved.set(false);
    this.certificateService
      .getServerCertificate({ ...(this.thumbprint().trim() ? { thumbprint: this.thumbprint().trim() } : {}) })
      .subscribe({
        next: (res) => {
          this.chain.set(res.certificate ?? []);
          this.validTill.set(res.certificateValidTill);
        },
        error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
      });
  }

  useForVerification(): void {
    const leaf = this.chain()[0];
    if (!leaf) return;
    this.certificateService.saveVerificationCertificatePem(leaf);
    this.saved.set(true);
  }
}

