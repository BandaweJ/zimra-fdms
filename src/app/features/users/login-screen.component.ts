import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'zimra-user-login-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">User Login</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">Hint: for new unconfirmed users, default password is username.</p>
        <zimra-card class="mt-4">
          <div class="space-y-3">
            <input class="w-full rounded border p-2" placeholder="Username" [value]="userName()" (input)="userName.set($any($event.target).value)" />
            <input class="w-full rounded border p-2" type="password" placeholder="Password" [value]="password()" (input)="password.set($any($event.target).value)" />
            @if (error()) {
              <div class="text-xs text-red-600">{{ error() }}</div>
            }
            <div class="flex justify-end gap-2">
              <zimra-button variant="secondary" (click)="router.navigate(['/users'])">Cancel</zimra-button>
              <zimra-button variant="primary" (click)="login()">Login</zimra-button>
            </div>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class LoginScreenComponent {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly userName = signal<string>('');
  readonly password = signal<string>('');
  readonly error = signal<string>('');

  private async deviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  login(): void {
    void this.loginAsync();
  }

  private async loginAsync(): Promise<void> {
    this.error.set('');
    const id = await this.deviceID();
    if (!id) return;
    this.userService.login({ deviceID: id, userName: this.userName(), password: this.password() }).subscribe({
      next: (res) => {
        this.userService.token.set(res.token);
        this.userService.currentUser.set(res.user);
        this.router.navigate(['/users']);
      },
      error: (e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('DEV13')) this.error.set('DEV13: User not confirmed. Continue via Create/Confirm flow.');
        else if (msg.includes('DEV11')) this.error.set('DEV11: Wrong credentials.');
        else if (msg.includes('DEV08')) this.error.set('DEV08: User not found or inactive.');
        else this.error.set(msg);
      },
    });
  }
}

