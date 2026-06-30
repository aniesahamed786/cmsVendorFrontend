import { Route } from '@angular/router';
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
    data: { title: 'Create Offer' },
  },
  {
    path: 'edit/:id',
    component: EditOffer,
    data: { title: 'Edit Offer' },
  },
  {
    path: ':id',
    component: OfferDetailsPage,
    data: { title: 'Offer Details' },
  },
];
