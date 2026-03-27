import { Routes } from '@angular/router';
import { FileBuilderScreenComponent } from './file-builder-screen.component';
import { FileStatusScreenComponent } from './file-status-screen.component';
import { OfflineQueueScreenComponent } from './offline-queue-screen.component';

export const OFFLINE_ROUTES: Routes = [
  {
    path: '',
    component: OfflineQueueScreenComponent,
  },
  { path: 'build', component: FileBuilderScreenComponent },
  { path: 'status', component: FileStatusScreenComponent },
];

