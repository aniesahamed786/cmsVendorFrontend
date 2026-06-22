import {
  MessagingFilterOption,
  SelectOption,
  Ticket,
  TicketMessage,
} from '../models/messaging-center.model';

/** The signed-in support agent (no auth layer in this in-memory build). */
export const CURRENT_AGENT = 'Anies Ahamed';

export const TICKET_TYPE_OPTIONS: MessagingFilterOption[] = [
  { label: 'All', value: null },
  { label: 'Technical', value: 'Technical' },
  { label: 'Billing', value: 'Billing' },
  { label: 'General', value: 'General' },
  { label: 'Account', value: 'Account' },
];

export const TICKET_STATUS_OPTIONS: MessagingFilterOption[] = [
  { label: 'All', value: null },
  { label: 'New', value: 'New' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Closed', value: 'Closed' },
];

export const TICKET_SORT_OPTIONS: MessagingFilterOption[] = [
  { label: 'Sort by', value: null },
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
];

export const ASSIGNEE_OPTIONS: SelectOption[] = [
  { label: 'Unassigned', value: 'Unassigned' },
  { label: 'Anies Ahamed', value: 'Anies Ahamed' },
  { label: 'Admin', value: 'Admin' },
];

export const PARTICIPANT_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Vendor', value: 'Vendor' },
  { label: 'Admin', value: 'Admin' },
  { label: 'User', value: 'User' },
];

export const VENDOR_OPTIONS: SelectOption[] = [
  { label: 'Lumee Street', value: 'lumee' },
  { label: 'Khalid Al-Otaibi', value: 'khalid' },
  { label: 'Hasan', value: 'hasan' },
];

export const TICKET_CATEGORY_OPTIONS: SelectOption[] = [
  { label: 'Technical', value: 'Technical' },
  { label: 'Billing', value: 'Billing' },
  { label: 'General', value: 'General' },
  { label: 'Account', value: 'Account' },
];

export const LINKED_ITEM_OPTIONS: SelectOption[] = [
  { label: 'Offer · 1782034855813', value: 'offer-1' },
  { label: 'Vendor · Lumee Street', value: 'vendor-1' },
  { label: 'App Section · Home', value: 'section-1' },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'tk-0010',
    reference: 'TK-2026-0010',
    category: 'Technical',
    title: 'test4',
    status: 'New',
    assignedTo: 'Unassigned',
    createdByName: 'Khalid Al-Otaibi',
    createdByRole: 'User',
    createdBy: { name: 'Khalid Al-Otaibi', role: 'User' },
    target: 'Not Selected',
    updatedBy: { name: 'Admin', role: 'Admin' },
    createdDate: '06/21/2026',
    lastUpdated: '06/21/2026',
    preview: 'pls describe the issue',
    timeAgo: '44m ago',
    unread: true,
    order: 10,
  },
  {
    id: 'tk-0009',
    reference: 'TK-2026-0009',
    category: 'Technical',
    title: 'test ticket 2',
    status: 'New',
    assignedTo: 'Unassigned',
    createdByName: 'Khalid Al-Otaibi',
    createdByRole: 'User',
    createdBy: { name: 'Khalid Al-Otaibi', role: 'User' },
    target: 'Not Selected',
    updatedBy: { name: 'Admin', role: 'Admin' },
    createdDate: '06/21/2026',
    lastUpdated: '06/21/2026',
    preview: 'test ticket 2',
    timeAgo: '1h ago',
    unread: false,
    order: 9,
  },
  {
    id: 'tk-0008',
    reference: 'TK-2026-0008',
    category: 'Technical',
    title: 'test ticket',
    status: 'In Progress',
    assignedTo: 'Anies Ahamed',
    createdByName: 'Khalid Al-Otaibi',
    createdByRole: 'User',
    createdBy: { name: 'Khalid Al-Otaibi', role: 'User' },
    target: 'Not Selected',
    updatedBy: { name: 'Anies Ahamed', role: 'Admin' },
    createdDate: '06/21/2026',
    lastUpdated: '06/21/2026',
    preview: 'test desc',
    timeAgo: '1h ago',
    unread: true,
    order: 8,
  },
  {
    id: 'tk-0005',
    reference: 'TK-2026-0005',
    category: 'Technical',
    title: 'test 2',
    status: 'New',
    assignedTo: 'Unassigned',
    createdByName: 'Khalid Al-Otaibi',
    createdByRole: 'User',
    createdBy: { name: 'Khalid Al-Otaibi', role: 'User' },
    target: 'Not Selected',
    updatedBy: { name: 'Admin', role: 'Admin' },
    createdDate: '06/21/2026',
    lastUpdated: '06/21/2026',
    preview: 'jj',
    timeAgo: '2h ago',
    unread: false,
    order: 5,
  },
  {
    id: 'tk-0007',
    reference: 'TK-2026-0007',
    category: 'Technical',
    title: 'test',
    status: 'Closed',
    assignedTo: 'Anies Ahamed',
    createdByName: 'Hasan',
    createdByRole: 'User',
    createdBy: { name: 'Hasan', role: 'User' },
    target: 'Not Selected',
    updatedBy: { name: 'Anies Ahamed', role: 'Admin' },
    createdDate: '06/20/2026',
    lastUpdated: '06/21/2026',
    preview: 'testing',
    timeAgo: '2h ago',
    unread: false,
    order: 7,
  },
];

export const MOCK_MESSAGES: Record<string, TicketMessage[]> = {
  'tk-0010': [
    {
      id: 'm1',
      authorName: 'Khalid Al-Otaibi',
      senderRole: 'User',
      outgoing: false,
      timestamp: 'Jun 21, 2026 at 12:40 PM',
      body: 'test desc',
      isInternalNote: false,
      linkedItem: {
        id: 'offer-1',
        label: 'Offer',
        badge: 'أوفر',
        reference: '1782034855813-O...',
      },
    },
    {
      id: 'm2',
      authorName: 'Anies Ahamed',
      senderRole: 'Admin',
      outgoing: true,
      timestamp: 'Jun 21, 2026 at 1:28 PM',
      body: 'pls describe the issue',
      isInternalNote: false,
    },
  ],
  'tk-0009': [
    {
      id: 'm1',
      authorName: 'Khalid Al-Otaibi',
      senderRole: 'User',
      outgoing: false,
      timestamp: 'Jun 21, 2026 at 11:55 AM',
      body: 'test ticket 2',
      isInternalNote: false,
    },
  ],
  'tk-0008': [
    {
      id: 'm1',
      authorName: 'Khalid Al-Otaibi',
      senderRole: 'User',
      outgoing: false,
      timestamp: 'Jun 21, 2026 at 11:30 AM',
      body: 'test desc',
      isInternalNote: false,
    },
    {
      id: 'm2',
      authorName: 'Anies Ahamed',
      senderRole: 'Admin',
      outgoing: true,
      timestamp: 'Jun 21, 2026 at 11:45 AM',
      body: 'Looking into this now.',
      isInternalNote: false,
    },
  ],
  'tk-0005': [
    {
      id: 'm1',
      authorName: 'Khalid Al-Otaibi',
      senderRole: 'User',
      outgoing: false,
      timestamp: 'Jun 21, 2026 at 10:10 AM',
      body: 'jj',
      isInternalNote: false,
    },
  ],
  'tk-0007': [
    {
      id: 'm1',
      authorName: 'Hasan',
      senderRole: 'User',
      outgoing: false,
      timestamp: 'Jun 20, 2026 at 4:00 PM',
      body: 'testing',
      isInternalNote: false,
    },
    {
      id: 'm2',
      authorName: 'Anies Ahamed',
      senderRole: 'Admin',
      outgoing: true,
      timestamp: 'Jun 20, 2026 at 4:20 PM',
      body: 'Resolved and closing this ticket.',
      isInternalNote: false,
    },
  ],
};
