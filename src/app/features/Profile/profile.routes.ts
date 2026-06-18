import { Route } from '@angular/router';
import { EditVendorProfilePage } from './pages/edit-vendor-profile-page/edit-vendor-profile-page';
import { VendorProfilePage } from './pages/vendor-profile-page/vendor-profile-page';

export const routes: Route[] = [
  {
    path: '',
    component: VendorProfilePage,
    data: { title: 'Vendor Profile' },
  },
  {
    path: 'edit',
    component: EditVendorProfilePage,
    data: { title: 'Edit Vendor Profile' },
  },
];
