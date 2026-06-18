import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadChildren: () => import('./main-layout/mainLayout.routes').then((m) => m.routes),
  },
  { path: '**', redirectTo: '' },
];
