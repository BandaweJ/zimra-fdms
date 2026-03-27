import { Routes } from '@angular/router';
import { NewReceiptScreenComponent } from './new-receipt-screen.component';
import { ReceiptListScreenComponent } from './receipt-list-screen.component';
import { ReceiptPrintViewComponent } from './receipt-print-view.component';

export const RECEIPTS_ROUTES: Routes = [
  {
    path: '',
    component: ReceiptListScreenComponent,
  },
  { path: 'new', component: NewReceiptScreenComponent },
  { path: 'print/:id', component: ReceiptPrintViewComponent },
];

