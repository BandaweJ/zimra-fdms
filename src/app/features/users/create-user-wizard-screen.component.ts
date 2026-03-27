import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { SendSecurityCodeTo } from '../../core/models/api.models';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'zimra-create-user-wizard-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Create User Wizard</h1>
        <div class="mt-2 text-xs text-slate-500">Step {{ step() }} / 8</div>

        @if (error()) {
          <div class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error() }}</div>
        }

        <zimra-card class="mt-4">
          @if (step()===1) {
            <div class="grid gap-3 md:grid-cols-2">
              <input class="rounded border p-2" placeholder="username" [value]="userName()" (input)="userName.set($any($event.target).value)" />
              <input class="rounded border p-2" placeholder="name" [value]="personName()" (input)="personName.set($any($event.target).value)" />
              <input class="rounded border p-2" placeholder="surname" [value]="personSurname()" (input)="personSurname.set($any($event.target).value)" />
              <input class="rounded border p-2" placeholder="role" [value]="userRole()" (input)="userRole.set($any($event.target).value)" />
            </div>
          }
          @if (step()===2) {
            <div class="space-y-2">
              <div class="text-sm">Security code was sent to taxpayer email.</div>
              <zimra-button variant="secondary" (click)="resend()">Resend code</zimra-button>
            </div>
          }
          @if (step()===3) {
            <div class="space-y-2">
              <input class="w-full rounded border p-2" maxlength="10" placeholder="security code (10 chars)" [value]="securityCode()" (input)="securityCode.set($any($event.target).value)" />
              <input class="w-full rounded border p-2" type="password" placeholder="password" [value]="password()" (input)="password.set($any($event.target).value)" />
              <div class="text-xs text-slate-500">Password rules: uppercase, lowercase, digit, special char, min 8 chars.</div>
              <div class="text-xs">Complexity: {{ complexityLabel() }}</div>
            </div>
          }
          @if (step()===4) {
            <div class="space-y-2">
              <input class="w-full rounded border p-2" placeholder="new email" [value]="email()" (input)="email.set($any($event.target).value)" />
            </div>
          }
          @if (step()===5) {
            <input class="w-full rounded border p-2" maxlength="10" placeholder="email code" [value]="emailCode()" (input)="emailCode.set($any($event.target).value)" />
          }
          @if (step()===6) {
            <input class="w-full rounded border p-2" placeholder="new phone" [value]="phone()" (input)="phone.set($any($event.target).value)" />
          }
          @if (step()===7) {
            <input class="w-full rounded border p-2" maxlength="10" placeholder="phone code" [value]="phoneCode()" (input)="phoneCode.set($any($event.target).value)" />
          }
          @if (step()===8) {
            <div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div>User: {{ userName() }}</div>
              <div>Name: {{ personName() }} {{ personSurname() }}</div>
              <div>Role: {{ userRole() }}</div>
              <div>Email: {{ email() }}</div>
              <div>Phone: {{ phone() }}</div>
            </div>
          }
        </zimra-card>

        <div class="mt-4 flex justify-between">
          <zimra-button variant="secondary" [disabled]="step()===1" (click)="step.set(step()-1)">Back</zimra-button>
          <zimra-button variant="primary" (click)="next()">{{ step()===8 ? 'Finish' : 'Next' }}</zimra-button>
        </div>
      </div>
    </div>
  `,
})
export class CreateUserWizardScreenComponent {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly step = signal<number>(1);
  readonly error = signal<string>('');
  readonly userName = signal<string>('');
  readonly personName = signal<string>('');
  readonly personSurname = signal<string>('');
  readonly userRole = signal<string>('Cashier');
  readonly securityCode = signal<string>('');
  readonly password = signal<string>('');
  readonly email = signal<string>('');
  readonly emailCode = signal<string>('');
  readonly phone = signal<string>('');
  readonly phoneCode = signal<string>('');
  readonly token = signal<string>('');

  complexityLabel(): string {
    const p = this.password();
    const score = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].reduce((s, r) => s + (r.test(p) ? 1 : 0), 0) + (p.length >= 8 ? 1 : 0);
    return score >= 5 ? 'Strong' : score >= 3 ? 'Medium' : 'Weak';
  }

  private async deviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  resend(): void {
    void this.resendAsync();
  }

  private async resendAsync(): Promise<void> {
    const id = await this.deviceID();
    if (!id) return;
    this.userService.sendSecurityCode({ deviceID: id, userName: this.userName() }).subscribe({ error: (e) => this.error.set(String(e)) });
  }

  next(): void {
    void this.nextAsync();
  }

  private async nextAsync(): Promise<void> {
    const id = await this.deviceID();
    if (!id) return;
    this.error.set('');
    const s = this.step();
    if (s === 1) {
      this.userService
        .createUserBegin({
          deviceID: id,
          userName: this.userName(),
          personName: this.personName(),
          personSurname: this.personSurname(),
          userRole: this.userRole(),
        })
        .subscribe({
          next: () => this.step.set(2),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    if (s === 2) {
      this.step.set(3);
      return;
    }
    if (s === 3) {
      this.userService
        .createUserConfirm({
          deviceID: id,
          userName: this.userName(),
          securityCode: this.securityCode(),
          password: this.password(),
        })
        .subscribe({
          next: (res) => {
            this.token.set(res.jwtToken);
            this.step.set(4);
          },
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    if (s === 4) {
      this.userService
        .sendSecurityCodeContactChange({ deviceID: id, userEmail: this.email(), token: this.token() })
        .subscribe({
          next: () => this.step.set(5),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    if (s === 5) {
      this.userService
        .confirmUserContactChange({
          deviceID: id,
          channel: SendSecurityCodeTo.Email,
          securityCode: this.emailCode(),
          token: this.token(),
        })
        .subscribe({
          next: () => this.step.set(6),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    if (s === 6) {
      this.userService
        .sendSecurityCodeContactChange({ deviceID: id, phoneNo: this.phone(), token: this.token() })
        .subscribe({
          next: () => this.step.set(7),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    if (s === 7) {
      this.userService
        .confirmUserContactChange({
          deviceID: id,
          channel: SendSecurityCodeTo.PhoneNumber,
          securityCode: this.phoneCode(),
          token: this.token(),
        })
        .subscribe({
          next: () => this.step.set(8),
          error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
        });
      return;
    }
    this.router.navigate(['/users']);
  }
}

