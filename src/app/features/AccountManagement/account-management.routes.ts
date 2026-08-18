import { Route } from '@angular/router';
import { AccountManagementPage } from './pages/account-management-page/account-management-page';
import { CreateAccount } from './pages/create-account/create-account';

export const routes: Route[] = [
  {
    path: '',
    component: AccountManagementPage,
    data: { title: 'Account Management' },
  },
  {
    path: 'create/:accountType',
    component: CreateAccount,
    data: { title: 'Create Account' },
  },
  {
    path: 'edit/:accountType/:id',
    component: CreateAccount,
    data: { title: 'Edit Account' },
  },
];
