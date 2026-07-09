import { Route } from '@angular/router';
import { Redemption } from './pages/redemption/redemption';

export const routes: Route[] = [
  {
    path: '',
    component: Redemption,
    data: { title: 'Redemption' },
  },
];
