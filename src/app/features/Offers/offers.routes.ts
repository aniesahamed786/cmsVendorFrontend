import { Route } from '@angular/router';
import { Offers } from './offers';

export const routes: Route[] = [
  {
    path: '',
    component: Offers,
    data: { title: 'Offers' },
  },
];
