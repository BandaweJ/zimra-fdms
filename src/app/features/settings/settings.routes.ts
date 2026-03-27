import { Routes } from '@angular/router';
import { SettingsScreenComponent } from './settings-screen.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsScreenComponent,
    data: { title: 'Device Settings' },
  },
];

