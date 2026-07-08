import { Route } from '@angular/router';
import { StoresPage } from './pages/stores-page/stores-page';

export const routes: Route[] = [
  {
    path: '',
    component: StoresPage,
    data: { title: 'Branches' },
  },
];
