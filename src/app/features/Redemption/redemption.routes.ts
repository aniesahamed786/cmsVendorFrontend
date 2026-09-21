import { Route } from '@angular/router';
import { RedemptionBulkUpload } from './pages/redemption-bulk-upload/redemption-bulk-upload';
import { Redemption } from './pages/redemption/redemption';

export const routes: Route[] = [
  {
    path: '',
    component: Redemption,
    data: { title: 'Redemption' },
  },
  {
    path: 'bulk-upload',
    component: RedemptionBulkUpload,
    data: { title: 'Bulk Upload' },
  },
];
