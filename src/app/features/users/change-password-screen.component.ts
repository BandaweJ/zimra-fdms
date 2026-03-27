import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'zimra-change-password-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Change Password</h1>
        <zimra-card class="mt-4">
          <div class="space-y-3">
            <input class="w-full rounded border p-2" type="password" placeholder="Old password" [value]="oldPassword()" (input)="oldPassword.set($any($event.target).value)" />
            <input class="w-full rounded border p-2" type="password" placeholder="New password" [value]="newPassword()" (input)="newPassword.set($any($event.target).value)" />
            <input class="w-full rounded border p-2" type="password" placeholder="Confirm new password" [value]="confirmPassword()" (input)="confirmPassword.set($any($event.target).value)" />
            <div class="text-xs text-slate-500">Rules: min 8 chars, uppercase, lowercase, digit, special char.</div>
            @if (error()) {
              <div class="text-xs text-red-600">{{ error() }}</div>
            }
            <div class="flex justify-end gap-2">
              <zimra-button variant="secondary" (click)="router.navigate(['/users'])">Cancel</zimra-button>
              <zimra-button variant="primary" (click)="submit()">Change</zimra-button>
            </div>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class ChangePasswordScreenComponent {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly oldPassword = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly error = signal<string>('');

  private async deviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  submit(): void {
    void this.submitAsync();
  }

  private async submitAsync(): Promise<void> {
    this.error.set('');
    const token = this.userService.token();
    if (!token) {
      this.error.set('DEV12: bad token / not logged in.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.');
      return;
    }
    const id = await this.deviceID();
    if (!id) return;
    this.userService
      .changeUserPassword({
        deviceID: id,
        oldPassword: this.oldPassword(),
        newPassword: this.newPassword(),
        token,
      })
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('DEV10')) this.error.set('DEV10: password complexity error.');
          else if (msg.includes('DEV12')) this.error.set('DEV12: bad token.');
          else this.error.set(msg);
        },
      });
  }
}

