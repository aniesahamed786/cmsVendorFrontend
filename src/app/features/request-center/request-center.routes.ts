import { Route } from '@angular/router';
import { RequestCenterList } from './pages/request-center-list/request-center-list';
import { RequestDetail } from './pages/request-detail/request-detail';

export const routes: Route[] = [
  {
    path: '',
    component: RequestCenterList,
    data: { title: 'Request Center' },
  },
  {
    path: ':id',
    component: RequestDetail,
    data: { title: 'Request Details' },
  },
];
