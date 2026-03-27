import { Routes } from '@angular/router';
import { deviceRegisteredGuard } from './core/guards/device-registered.guard';
import { fiscalDayOpenGuard } from './core/guards/fiscal-day-open.guard';
import { offlineModeGuard } from './core/guards/offline-mode.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/setup', pathMatch: 'full' },

  {
    path: 'setup',
    loadChildren: () => import('./features/setup/setup.routes').then((m) => m.SETUP_ROUTES),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
    canActivate: [deviceRegisteredGuard, offlineModeGuard],
  },
  {
    path: 'fiscal-day',
    loadChildren: () =>
      import('./features/fiscal-day/fiscal-day.routes').then((m) => m.FISCAL_DAY_ROUTES),
    canActivate: [deviceRegisteredGuard, offlineModeGuard],
  },
  {
    path: 'receipts',
    loadChildren: () =>
      import('./features/receipts/receipts.routes').then((m) => m.RECEIPTS_ROUTES),
    canActivate: [deviceRegisteredGuard, offlineModeGuard, fiscalDayOpenGuard],
  },
  {
    path: 'offline',
    loadChildren: () =>
      import('./features/offline/offline.routes').then((m) => m.OFFLINE_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },
  {
    path: 'stock',
    loadChildren: () =>
      import('./features/stock/stock.routes').then((m) => m.STOCK_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },
  {
    path: 'certificates',
    loadChildren: () =>
      import('./features/certificates/certificates.routes').then((m) => m.CERTIFICATES_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
    canActivate: [deviceRegisteredGuard],
  },

  { path: '**', redirectTo: '/setup' },
];
