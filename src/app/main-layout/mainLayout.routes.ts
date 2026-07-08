import { Route } from '@angular/router';
import { MainLayout } from './mainLayout';
import { DashboardPage } from '../features/Dashboard/pages/dashboard-page/dashboard-page';
import { Inprogress } from '../shared/Components/inprogress/inprogress';

export const routes: Route[] = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: DashboardPage,
        data: { title: 'Dashboard' },
      },
      {
        path: 'offers',
        loadChildren: () => import('../features/Offers/offers.routes').then((m) => m.routes),
        data: { title: 'Offers' },
      },
      {
        path: 'stores',
        loadChildren: () => import('../features/Stores/stores.routes').then((m) => m.routes),
        data: { title: 'Branches' },
      },
      {
        path: 'messaging-center',
        loadChildren: () =>
          import('../features/messaging-center/messaging-center.routes').then((m) => m.routes),
        data: { title: 'Messaging Center' },
      },
      {
        path: 'request-center',
        component: Inprogress,
        data: { title: 'Request Center' },
      },
      {
        path: 'recent-activities',
        loadChildren: () =>
          import('../features/recent-activities/recent-activities.routes').then((m) => m.routes),
        data: { title: 'Recent Activities' },
      },
      {
        path: 'analytics',
        loadChildren: () => import('../features/Analytics/analytics.routes').then((m) => m.routes),
        data: { title: 'Analytics' },
      },
      {
        path: 'profile',
        loadChildren: () => import('../features/Profile/profile.routes').then((m) => m.routes),
        data: { title: 'Vendor Profile' },
      },
      {
        path: 'settings',
        component: Inprogress,
        data: { title: 'Settings' },
      },
    ],
  },
];
