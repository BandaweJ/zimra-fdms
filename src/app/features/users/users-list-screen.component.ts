import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/ui/button.component';
import { CardComponent } from '../../shared/components/ui/card.component';
import { UserService } from '../../core/services/user.service';
import { FdmsContextService } from '../../core/services/fdms-context.service';
import { StorageService } from '../../core/services/storage.service';
import { UserWithStatus, UserStatus } from '../../core/models/api.models';

@Component({
  selector: 'zimra-users-list-screen',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="min-h-screen bg-zimra-surface text-zimra-charcoal dark:bg-zimra-charcoal dark:text-zimra-surface">
      <div class="mx-auto w-full max-w-6xl px-4 py-10">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">Users</h1>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">User management (spec 4.14).</p>
          </div>
          <div class="flex gap-2">
            <zimra-button variant="secondary" (click)="router.navigate(['/users/login'])">Login</zimra-button>
            <zimra-button variant="primary" (click)="router.navigate(['/users/create'])">Add User</zimra-button>
          </div>
        </div>

        @if (error()) {
          <div class="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{{ error() }}</div>
        }

        <zimra-card>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">Username</th>
                  <th class="px-3 py-2">Name</th>
                  <th class="px-3 py-2">Surname</th>
                  <th class="px-3 py-2">Role</th>
                  <th class="px-3 py-2">Email</th>
                  <th class="px-3 py-2">Phone</th>
                  <th class="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.userName) {
                  <tr class="border-t border-slate-200 dark:border-slate-800 cursor-pointer" (click)="openUpdate(u.userName)">
                    <td class="px-3 py-2 font-mono">{{ u.userName }}</td>
                    <td class="px-3 py-2">{{ u.personName }}</td>
                    <td class="px-3 py-2">{{ u.personSurname }}</td>
                    <td class="px-3 py-2">{{ u.userRole }}</td>
                    <td class="px-3 py-2">{{ u.email }}</td>
                    <td class="px-3 py-2">{{ u.phoneNo }}</td>
                    <td class="px-3 py-2">
                      <span class="rounded-full px-2 py-1 text-xs font-semibold" [class]="statusClass(u.userStatus)">
                        {{ statusLabel(u.userStatus) }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </zimra-card>
      </div>
    </div>
  `,
})
export class UsersListScreenComponent implements OnInit {
  readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly ctx = inject(FdmsContextService);
  private readonly storage = inject(StorageService);

  readonly users = signal<UserWithStatus[]>([]);
  readonly error = signal<string>('');

  async ngOnInit(): Promise<void> {
    const id = await this.resolveDeviceID();
    if (!id) return;
    this.userService.getUsersList({ deviceID: id }).subscribe({
      next: (res) => this.users.set(res.rows ?? []),
      error: (e) => this.error.set(e instanceof Error ? e.message : String(e)),
    });
  }

  private async resolveDeviceID(): Promise<number | null> {
    if (this.ctx.getDeviceID() != null) return this.ctx.getDeviceID();
    return (await this.storage.getAnyDeviceCertificate())?.deviceID ?? null;
  }

  statusClass(status: UserStatus): string {
    if (status === UserStatus.Active) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (status === UserStatus.Blocked) return 'bg-slate-100 text-slate-700 border border-slate-200';
    return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  }

  statusLabel(status: UserStatus): string {
    if (status === UserStatus.Active) return 'Active';
    if (status === UserStatus.Blocked) return 'Blocked';
    return 'NotConfirmed';
  }

  openUpdate(userName: string): void {
    this.router.navigate(['/users/update'], { queryParams: { userName } });
  }
}

