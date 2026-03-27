import { Routes } from '@angular/router';
import { WelcomeScreenComponent } from './welcome-screen.component';
import { ContextSetupScreenComponent } from './context-setup-screen.component';
import { VerifyTaxpayerScreenComponent } from './verify-taxpayer-screen.component';
import { RegisterDeviceScreenComponent } from './register-device-screen.component';
import { IssueCertificateScreenComponent } from './issue-certificate-screen.component';
import { GetConfigScreenComponent } from './get-config-screen.component';
import { setupContextGuard } from '../../core/guards/setup-context.guard';

export const SETUP_ROUTES: Routes = [
  {
    path: '',
    component: WelcomeScreenComponent,
  },
  { path: 'context', component: ContextSetupScreenComponent },
  { path: 'verify', component: VerifyTaxpayerScreenComponent, canActivate: [setupContextGuard] },
  { path: 'register', component: RegisterDeviceScreenComponent, canActivate: [setupContextGuard] },
  { path: 'issue-certificate', component: IssueCertificateScreenComponent, canActivate: [setupContextGuard] },
  { path: 'get-config', component: GetConfigScreenComponent, canActivate: [setupContextGuard] },
];

