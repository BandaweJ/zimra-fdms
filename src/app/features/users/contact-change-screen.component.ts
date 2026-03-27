import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { SendSecurityCodeTo } from '../../core/models/api.models';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'zimra-contact-change-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Contact Change</h1>
        <div class="mt-2 text-xs text-slate-500">Step {{ step() }} / 2</div>
        <zimra-card class="mt-4">
          @if (step()===1) {
            <div class="space-y-3">
              <select class="w-full rounded border p-2" [value]="channel()" (change)="channel.set(+$any($event.target).value)">
                <option [value]="SendSecurityCodeTo.Email">Email</option>
                <option [value]="SendSecurityCodeTo.PhoneNumber">Phone</option>
              </select>
              @if (channel()===SendSecurityCodeTo.Email) {
                <input class="w-full rounded border p-2" placeholder="new email" [value]="email()" (input)="email.set($any($event.target).value)" />
              } @else {
                <input class="w-full rounded border p-2" placeholder="new phone" [value]="phone()" (input)="phone.set($any($event.target).value)" />
              }
            </div>
          } @else {
            <input class="w-full rounded border p-2" maxlength="10" placeholder="security code" [value]="securityCode()" (input)="securityCode.set($any($event.target).value)" />
          }
          @if (error()) {
            <div class="mt-3 text-xs text-red-600">{{ error() }}</div>
          }
          <div class="mt-4 flex justify-between">
            <zimra-button variant="secondary" [disabled]="step()===1" (click)="step.set(1)">Back</zimra-button>
            <zimra-button variant="primary" (click)="next()">{{ step()===1 ? 'Send Code' : 'Confirm' }}</zimra-button>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class ContactChangeScreenComponent {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly SendSecurityCodeTo = SendSecurityCodeTo;
  readonly step = signal<number>(1);
  readonly channel = signal<SendSecurityCodeTo>(SendSecurityCodeTo.Email);
  readonly email = signal<string>('');
  readonly phone = signal<string>('');
  readonly securityCode = signal<string>('');
  readonly error = signal<string>('');

  private async deviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  next(): void {
    void this.nextAsync();
  }

  private async nextAsync(): Promise<void> {
    this.error.set('');
    const token = this.userService.token();
    if (!token) {
      this.error.set('DEV12: bad token / login required.');
      return;
    }
    const id = await this.deviceID();
    if (!id) return;
    if (this.step() === 1) {
      this.userService
        .sendSecurityCodeContactChange({
          deviceID: id,
          ...(this.channel() === SendSecurityCodeTo.Email ? { userEmail: this.email() } : { phoneNo: this.phone() }),
          token,
        })
        .subscribe({
          next: () => this.step.set(2),
          error: (e) => {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('DEV14')) this.error.set('DEV14: invalid email/phone.');
            else if (msg.includes('DEV12')) this.error.set('DEV12: bad token.');
            else this.error.set(msg);
          },
        });
      return;
    }

    this.userService
      .confirmUserContactChange({
        deviceID: id,
        channel: this.channel(),
        securityCode: this.securityCode(),
        token,
      })
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('DEV15')) this.error.set('DEV15: already confirmed.');
          else if (msg.includes('DEV12')) this.error.set('DEV12: bad token.');
          else this.error.set(msg);
        },
      });
  }
}

