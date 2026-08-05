import { Route } from '@angular/router';
import { BranchesPage } from './pages/branches-page/branches-page';
import { CreateBranch } from './pages/create-branch/create-branch';
import { EditBranch } from './pages/edit-branch/edit-branch';
import { ViewBranch } from './pages/view-branch/view-branch';

export const routes: Route[] = [
  {
    path: '',
    component: BranchesPage,
    data: { title: 'Branches' },
  },
  {
    path: 'create',
    component: CreateBranch,
    data: { title: 'Create Branch' },
  },
  {
      path: 'edit/:id',
      component: EditBranch,
      data: { title: 'Edit Branch' },
    },
     {
    path: 'view/:id',
    component: ViewBranch,
    data: { title: 'View Branch' },
  },
];
