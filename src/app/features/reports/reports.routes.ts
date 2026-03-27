import { Routes } from '@angular/router';
import { ZxReportScreenComponent } from './zx-report-screen.component';
import { ReceiptHistoryScreenComponent } from './receipt-history-screen.component';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'zx',
  },
  {
    path: 'zx',
    component: ZxReportScreenComponent,
    data: { title: 'Z / X Report' },
  },
  {
    path: 'history',
    component: ReceiptHistoryScreenComponent,
    data: { title: 'Receipt History' },
  },
];

