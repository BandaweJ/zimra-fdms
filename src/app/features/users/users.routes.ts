import { Routes } from '@angular/router';
import { ChangePasswordScreenComponent } from './change-password-screen.component';
import { ContactChangeScreenComponent } from './contact-change-screen.component';
import { CreateUserWizardScreenComponent } from './create-user-wizard-screen.component';
import { LoginScreenComponent } from './login-screen.component';
import { ResetPasswordScreenComponent } from './reset-password-screen.component';
import { UpdateUserScreenComponent } from './update-user-screen.component';
import { UsersListScreenComponent } from './users-list-screen.component';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    component: UsersListScreenComponent,
  },
  { path: 'create', component: CreateUserWizardScreenComponent },
  { path: 'login', component: LoginScreenComponent },
  { path: 'update', component: UpdateUserScreenComponent },
  { path: 'change-password', component: ChangePasswordScreenComponent },
  { path: 'reset-password', component: ResetPasswordScreenComponent },
  { path: 'contact-change', component: ContactChangeScreenComponent },
];

