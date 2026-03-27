import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { UserService } from '../../core/services/user.service';
import { UserStatus } from '../../core/models/api.models';

@Component({
  selector: 'zimra-update-user-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 class="text-2xl font-semibold tracking-tight">Update User</h1>
        <zimra-card class="mt-4">
          <div class="grid gap-3 md:grid-cols-2">
            <input class="rounded border p-2" placeholder="username" [value]="userName()" (input)="userName.set($any($event.target).value)" />
            <input class="rounded border p-2" placeholder="name" [value]="personName()" (input)="personName.set($any($event.target).value)" />
            <input class="rounded border p-2" placeholder="surname" [value]="personSurname()" (input)="personSurname.set($any($event.target).value)" />
            <input class="rounded border p-2" placeholder="role" [value]="userRole()" (input)="userRole.set($any($event.target).value)" />
            <select class="rounded border p-2" [value]="userStatus()" (change)="userStatus.set(+$any($event.target).value)">
              <option [value]="UserStatus.Active">Active</option>
              <option [value]="UserStatus.Blocked">Blocked</option>
            </select>
          </div>
          @if (error()) {
            <div class="mt-3 text-xs text-red-600">{{ error() }}</div>
          }
          <div class="mt-4 flex justify-end gap-2">
            <zimra-button variant="secondary" (click)="router.navigate(['/users'])">Cancel</zimra-button>
            <zimra-button variant="primary" (click)="save()">Save</zimra-button>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class UpdateUserScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly UserStatus = UserStatus;
  readonly userName = signal<string>('');
  readonly personName = signal<string>('');
  readonly personSurname = signal<string>('');
  readonly userRole = signal<string>('Cashier');
  readonly userStatus = signal<UserStatus>(UserStatus.Active);
  readonly error = signal<string>('');

  ngOnInit(): void {
    const queryUser = this.route.snapshot.queryParamMap.get('userName');
    if (queryUser) this.userName.set(queryUser);
  }

  private async deviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  save(): void {
    void this.saveAsync();
  }

  private async saveAsync(): Promise<void> {
    this.error.set('');
    const token = this.userService.token();
    if (!token) {
      this.error.set('Login required. Missing token.');
      return;
    }
    const id = await this.deviceID();
    if (!id) return;
    this.userService
      .updateUser({
        deviceID: id,
        userName: this.userName(),
        personName: this.personName(),
        personSurname: this.personSurname(),
        userRole: this.userRole(),
        userStatus: this.userStatus(),
        token,
      })
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
      });
  }
}

