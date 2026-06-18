import { Route } from '@angular/router';
import { Inprogress } from '../../shared/Components/inprogress/inprogress';

export const routes: Route[] = [
  {
    path: '',
    component: Inprogress,
    data: { title: 'Analytics' },
  },
];
