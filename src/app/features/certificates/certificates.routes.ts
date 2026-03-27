import { Routes } from '@angular/router';
import { CurrentCertificateScreenComponent } from './current-certificate-screen.component';
import { ServerCertificateScreenComponent } from './server-certificate-screen.component';

export const CERTIFICATES_ROUTES: Routes = [
  {
    path: '',
    component: CurrentCertificateScreenComponent,
  },
  { path: 'server', component: ServerCertificateScreenComponent },
];

