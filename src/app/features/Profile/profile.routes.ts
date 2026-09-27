import { Route } from '@angular/router';
import { managePermissionGuard } from '../../shared/guards/auth.guard';
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
    canActivate: [managePermissionGuard('profile')],
    data: { title: 'Edit Vendor Profile' },
  },
];
