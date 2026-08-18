import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authChildGuard, authGuard, guestGuard } from './shared/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard]
  },

  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    loadChildren: () =>
      import('./main-layout/mainLayout.routes').then((m) => m.routes),
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];