import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { SendSecurityCodeTo } from '../../core/models/api.models';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'zimra-reset-password-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Reset Password</h1>
        <div class="mt-2 text-xs text-slate-500">Step {{ step() }} / 2</div>
        <zimra-card class="mt-4">
          @if (step()===1) {
            <div class="space-y-3">
              <input class="w-full rounded border p-2" placeholder="Username" [value]="userName()" (input)="userName.set($any($event.target).value)" />
              <select class="w-full rounded border p-2" [value]="channel()" (change)="channel.set(+$any($event.target).value)">
                <option [value]="SendSecurityCodeTo.Email">Email</option>
                <option [value]="SendSecurityCodeTo.PhoneNumber">Phone</option>
              </select>
            </div>
          } @else {
            <div class="space-y-3">
              <input class="w-full rounded border p-2" maxlength="10" placeholder="Security code" [value]="securityCode()" (input)="securityCode.set($any($event.target).value)" />
              <input class="w-full rounded border p-2" type="password" placeholder="New password" [value]="newPassword()" (input)="newPassword.set($any($event.target).value)" />
            </div>
          }
          @if (error()) {
            <div class="mt-3 text-xs text-red-600">{{ error() }}</div>
          }
          <div class="mt-4 flex justify-between">
            <zimra-button variant="secondary" [disabled]="step()===1" (click)="step.set(1)">Back</zimra-button>
            <zimra-button variant="primary" (click)="next()">{{ step()===1 ? 'Begin' : 'Confirm' }}</zimra-button>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class ResetPasswordScreenComponent {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly SendSecurityCodeTo = SendSecurityCodeTo;
  readonly step = signal<number>(1);
  readonly userName = signal<string>('');
  readonly channel = signal<SendSecurityCodeTo>(SendSecurityCodeTo.Email);
  readonly securityCode = signal<string>('');
  readonly newPassword = signal<string>('');
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
    const id = await this.deviceID();
    if (!id) return;
    if (this.step() === 1) {
      this.userService
        .resetUserPasswordBegin({ deviceID: id, userName: this.userName(), channel: this.channel() })
        .subscribe({
          next: () => this.step.set(2),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    this.userService
      .resetUserPasswordConfirm({
        deviceID: id,
        userName: this.userName(),
        securityCode: this.securityCode(),
        newPassword: this.newPassword(),
      })
      .subscribe({
        next: () => this.router.navigate(['/users/login']),
        error: (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('DEV09')) this.error.set('DEV09: bad security code.');
          else if (msg.includes('DEV10')) this.error.set('DEV10: password complexity.');
          else this.error.set(msg);
        },
      });
  }
}

