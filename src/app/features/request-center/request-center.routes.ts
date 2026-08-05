import { Route } from '@angular/router';
import { RequestCenterList } from './pages/request-center-list/request-center-list';
import { RequestDetail } from './pages/request-detail/request-detail';
import { RequestEdit } from './pages/request-edit/request-edit';

export const routes: Route[] = [
  {
    path: '',
    component: RequestCenterList,
    data: { title: 'Request Center' },
  },
  // Declared before ':id' so the edit route is never swallowed by the detail route.
  {
    path: ':id/edit',
    component: RequestEdit,
    data: { title: 'Edit Request' },
  },
  {
    path: ':id',
    component: RequestDetail,
    data: { title: 'Request Details' },
  },
];
