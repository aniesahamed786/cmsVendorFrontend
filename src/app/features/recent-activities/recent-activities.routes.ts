import { Route } from '@angular/router';
import { RecentActivities } from './recent-activities';

export const routes: Route[] = [
  {
    path: '',
    component: RecentActivities,
    data: { title: 'Recent Activities' },
  },
];
