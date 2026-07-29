import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: '',
    loadChildren: () =>
      import('./main-layout/mainLayout.routes').then((m) => m.routes),
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];