import { Route } from '@angular/router';
import { BranchesPage } from './pages/branches-page/branches-page';

export const routes: Route[] = [
  {
    path: '',
    component: BranchesPage,
    data: { title: 'Branches' },
  },
];
