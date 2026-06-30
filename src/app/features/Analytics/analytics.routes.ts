import { Route } from '@angular/router';
import { AnalyticsPage } from './pages/analytics-page/analytics-page';

export const routes: Route[] = [
  {
    path: '',
    component: AnalyticsPage,
    data: { title: 'Analytics' },
  },
];
