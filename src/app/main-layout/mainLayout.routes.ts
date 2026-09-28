import { Route } from '@angular/router';
import { MainLayout } from './mainLayout';
import { DashboardPage } from '../features/Dashboard/pages/dashboard-page/dashboard-page';
import { Inprogress } from '../shared/Components/inprogress/inprogress';
import { AccessDenied } from '../shared/Components/access-denied/access-denied';
import { permissionGuard } from '../shared/guards/auth.guard';

export const routes: Route[] = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'access-denied',
        component: AccessDenied,
        data: { title: 'Access Denied' },
      },
      {
        path: 'dashboard',
        component: DashboardPage,
        data: { title: 'Dashboard' },
      },
      {
        path: 'offers',
        canActivate: [permissionGuard('offers')],
        loadChildren: () => import('../features/Offers/offers.routes').then((m) => m.routes),
        data: { title: 'Offers' },
      },
      {
        path: 'branches',
        canActivate: [permissionGuard('locations')],
        loadChildren: () => import('../features/Branches/branches.routes').then((m) => m.routes),
        data: { title: 'Branches' },
      },
      {
        path: 'redemption',
        canActivate: [permissionGuard('redemptions')],
        loadChildren: () => import('../features/Redemption/redemption.routes').then((m) => m.routes),
        data: { title: 'Redemption' },
      },
      {
        path: 'messaging-center',
        canActivate: [permissionGuard('messaging_center')],
        loadChildren: () =>
          import('../features/messaging-center/messaging-center.routes').then((m) => m.routes),
        data: { title: 'Messaging Center' },
      },
      {
        path: 'request-center',
        canActivate: [permissionGuard('request_center')],
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
        canActivate: [permissionGuard('analytics')],
        loadChildren: () => import('../features/Analytics/analytics.routes').then((m) => m.routes),
        data: { title: 'Analytics' },
      },
      {
        path: 'account-management',
        canActivate: [permissionGuard('vendor_staff')],
        loadChildren: () =>
          import('../features/AccountManagement/account-management.routes').then((m) => m.routes),
        data: { title: 'Account Management' },
      },
      {
        path: 'profile',
        canActivate: [permissionGuard('profile')],
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
