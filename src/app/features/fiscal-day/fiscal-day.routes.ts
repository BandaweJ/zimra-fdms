import { Routes } from '@angular/router';
import { OpenDayScreenComponent } from './open-day-screen.component';
import { FiscalDayStatusScreenComponent } from './fiscal-day-status-screen.component';
import { CloseDayScreenComponent } from './close-day-screen.component';
import { setupContextGuard } from '../../core/guards/setup-context.guard';

export const FISCAL_DAY_ROUTES: Routes = [
  {
    path: '',
    component: OpenDayScreenComponent,
    canActivate: [setupContextGuard],
  },
  {
    path: 'open',
    component: OpenDayScreenComponent,
    canActivate: [setupContextGuard],
  },
  {
    path: 'status',
    component: FiscalDayStatusScreenComponent,
    canActivate: [setupContextGuard],
  },
  {
    path: 'close',
    component: CloseDayScreenComponent,
    canActivate: [setupContextGuard],
  },
];

