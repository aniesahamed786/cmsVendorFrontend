import { Route } from '@angular/router';
import { managePermissionGuard } from '../../shared/guards/auth.guard';
import { MessagingCenterPage } from './pages/messaging-center/messaging-center';
import { CreateTicketPage } from './pages/create-ticket/create-ticket';

export const routes: Route[] = [
  {
    path: '',
    component: MessagingCenterPage,
    data: { title: 'Messaging Center' },
  },
  {
    path: 'create',
    component: CreateTicketPage,
    canActivate: [managePermissionGuard('messaging_center')],
    data: { title: 'Create Ticket' },
  },
];
