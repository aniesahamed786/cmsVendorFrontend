import { Route } from '@angular/router';
import { AnalyticsOverviewPage } from './pages/analytics-overview/analytics-overview';
import { AnalyticsPage } from './pages/analytics-page/analytics-page';

// NOTE: `AnalyticsPage` (./pages/analytics-page) is the previous table-based
// analytics view. It's left in place, untouched, but is no longer routed —
// `AnalyticsOverviewPage` now renders at '/analytics'.
export const routes: Route[] = [
  // {
  //   path: '',
  //   component: AnalyticsOverviewPage,
  //   data: { title: 'Analytics' },
  // },
   {
    path: '',
    component: AnalyticsPage,
    data: { title: 'Analytics' },
  },
];
