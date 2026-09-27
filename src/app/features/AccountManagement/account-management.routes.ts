import { Route } from '@angular/router';
import { managePermissionGuard } from '../../shared/guards/auth.guard';
import { AccountManagementPage } from './pages/account-management-page/account-management-page';
import { CreateAccount } from './pages/create-account/create-account';

export const routes: Route[] = [
  {
    path: '',
    component: AccountManagementPage,
    data: { title: 'Account Management' },
  },
  {
    path: 'create',
    component: CreateAccount,
    canActivate: [managePermissionGuard('vendor_staff')],
    data: { title: 'Create Subaccount' },
  },
  {
    path: 'edit/:id',
    component: CreateAccount,
    canActivate: [managePermissionGuard('vendor_staff')],
    data: { title: 'Edit Subaccount' },
  },
];
