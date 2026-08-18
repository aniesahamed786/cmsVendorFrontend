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
        path: 'branches',
        loadChildren: () => import('../features/Branches/branches.routes').then((m) => m.routes),
        data: { title: 'Branches' },
      },
      {
        path: 'redemption',
        loadChildren: () => import('../features/Redemption/redemption.routes').then((m) => m.routes),
        data: { title: 'Redemption' },
      },
      {
        path: 'messaging-center',
        loadChildren: () =>
          import('../features/messaging-center/messaging-center.routes').then((m) => m.routes),
        data: { title: 'Messaging Center' },
      },
      {
        path: 'request-center',
        loadChildren: () =>
          import('../features/request-center/request-center.routes').then((m) => m.routes),
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
        path: 'account-management',
        loadChildren: () =>
          import('../features/AccountManagement/account-management.routes').then((m) => m.routes),
        data: { title: 'Account Management' },
      },
      {
        path: 'profile',
        loadChildren: () => import('../features/Profile/profile.routes').then((m) => m.routes),
        data: { title: 'Vendor Profile' },
      },
      {
        path: 'settings',
        // component: Inprogress,
        loadChildren: () => import('../features/Profile-settings/profile-settings.routes').then((m) => m.routes),
        // data: { title: 'Settings' },
      },
    ],
  },
];
