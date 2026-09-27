import { Route } from '@angular/router';
import { managePermissionGuard } from '../../shared/guards/auth.guard';
import { Offers } from './pages/offer-list/offers';
import { CreateOffer } from './pages/create-offer/create-offer';
import { EditOffer } from './pages/edit-offer/edit-offer';
import { OfferDetailsPage } from './pages/offer-details/offer-details';

export const routes: Route[] = [
  {
    path: '',
    component: Offers,
    data: { title: 'Offers' },
  },
  {
    path: 'create',
    component: CreateOffer,
    canActivate: [managePermissionGuard('offers')],
    data: { title: 'Create Offer' },
  },
  {
    path: 'edit/:id',
    component: EditOffer,
    canActivate: [managePermissionGuard('offers')],
    data: { title: 'Edit Offer' },
  },
  {
    path: ':id',
    component: OfferDetailsPage,
    data: { title: 'Offer Details' },
  },
];
