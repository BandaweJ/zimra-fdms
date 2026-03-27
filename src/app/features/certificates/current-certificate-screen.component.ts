import { Component, inject, OnInit, signal } from '@angular/core';
import * as x509 from '@peculiar/x509';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'zimra-current-certificate-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Current Certificate</h1>
        @if (expiredRedirectInfo()) {
          <div class="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Device certificate has expired. Renew certificate to continue using online endpoints.
          </div>
        }
        <zimra-card class="mt-4">
          @if (!loaded()) {
            <div class="text-sm text-slate-600">Loading certificate...</div>
          } @else if (!pem()) {
            <div class="text-sm text-slate-600">No local certificate found.</div>
          } @else {
            <div class="grid gap-2 text-sm">
              <div>CN: <span class="font-mono">{{ cn() }}</span></div>
              <div>Subject: <span class="font-mono">{{ subject() }}</span></div>
              <div>Issuer: <span class="font-mono">{{ issuer() }}</span></div>
              <div>Serial: <span class="font-mono">{{ serial() }}</span></div>
              <div>Not Before: <span class="font-mono">{{ notBefore() }}</span></div>
              <div>Not After: <span class="font-mono">{{ notAfter() }}</span></div>
            </div>
            <div class="mt-3">
              <span class="rounded-full px-2 py-1 text-xs font-semibold" [class]="expiryClass()">
                {{ daysLeft() }} days left
              </span>
            </div>
          }
          <div class="mt-4 flex justify-end">
            <zimra-button variant="primary" (click)="router.navigate(['/setup/issue-certificate'])">Renew Certificate</zimra-button>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class CurrentCertificateScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly storage = inject(StorageService);

  readonly loaded = signal<boolean>(false);
  readonly pem = signal<string>('');
  readonly cn = signal<string>('');
  readonly subject = signal<string>('');
  readonly issuer = signal<string>('');
  readonly serial = signal<string>('');
  readonly notBefore = signal<string>('');
  readonly notAfter = signal<string>('');
  readonly daysLeft = signal<number>(0);
  readonly expiredRedirectInfo = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    this.expiredRedirectInfo.set(this.route.snapshot.queryParamMap.get('certExpired') === '1');
    const cert = await this.storage.getAnyDeviceCertificate();
    const pem = cert?.certificatePem ?? '';
    this.pem.set(pem);
    if (pem) {
      const c = new (x509 as any).X509Certificate(pem) as x509.X509Certificate;
      const subject = (c as any).subject || '';
      this.subject.set(subject);
      this.cn.set(this.extractCn(subject));
      this.issuer.set((c as any).issuer || '');
      this.serial.set((c as any).serialNumber || '');
      this.notBefore.set(new Date((c as any).notBefore).toISOString());
      this.notAfter.set(new Date((c as any).notAfter).toISOString());
      const till = new Date((c as any).notAfter).getTime();
      this.daysLeft.set(Math.ceil((till - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    this.loaded.set(true);
  }

  private extractCn(subject: string): string {
    const m = subject.match(/CN\s*=\s*([^,]+)/i);
    return m?.[1]?.trim() ?? '-';
  }

  expiryClass(): string {
    const d = this.daysLeft();
    if (d > 60) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (d >= 30) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  }
}

