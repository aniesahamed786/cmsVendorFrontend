export type TicketCategory = 'Technical' | 'Billing' | 'General' | 'Account';

export type TicketStatus = 'New' | 'In Progress' | 'Open' | 'Closed';

export type ParticipantType = 'Vendor' | 'Admin' | 'User';

export type SenderRole = 'User' | 'Admin' | 'Vendor' | 'System';

export type TicketTabKey = 'all' | 'unread' | 'read';

export type SortOrder = 'newest' | 'oldest';

/**
 * Catalog keys for the enum values above. The enums double as stored values, so
 * they stay English — only the rendered label goes through the catalog.
 */
export const TICKET_CATEGORY_KEYS: Record<TicketCategory, string> = {
  Technical: 'messaging.type.technical',
  Billing: 'messaging.type.billing',
  General: 'messaging.type.general',
  Account: 'messaging.type.account',
};

export const TICKET_STATUS_KEYS: Record<TicketStatus, string> = {
  New: 'messaging.status.new',
  'In Progress': 'messaging.status.inProgress',
  Open: 'messaging.status.open',
  Closed: 'messaging.status.closed',
};

export const SENDER_ROLE_KEYS: Record<SenderRole, string> = {
  User: 'messaging.role.user',
  Admin: 'messaging.role.admin',
  Vendor: 'messaging.role.vendor',
  System: 'messaging.role.system',
};

/** A linked entity rendered as a chip inside a message bubble (e.g. an offer). */
export interface TicketLinkedItem {
  id: string;
  label: string;
  badge: string;
  reference: string;
}

export interface MessageAttachment {
  name: string;
  url?: string;
}

export interface TicketMessage {
  id: string;
  authorName: string;
  senderRole: SenderRole;
  /** When true the bubble is right-aligned (the support agent / current user). */
  outgoing: boolean;
  timestamp: string;
  body: string;
  isInternalNote: boolean;
  linkedItem?: TicketLinkedItem;
  attachments?: MessageAttachment[];
  /** True while the optimistic bubble is still waiting on the POST/upload. */
  pending?: boolean;
}

/** A ticket — used in both the left-hand list and the details pane. */
export interface Ticket {
  id: string;
  reference: string;
  category: TicketCategory;
  title: string;
  status: TicketStatus;
  /** Display label of the assignee, or 'Unassigned'. */
  assignedTo: string;
  createdByName: string;
  createdByRole: ParticipantType;
  createdBy: { name: string; role: ParticipantType };
  target: string;
  updatedBy: { name: string; role: ParticipantType };
  createdDate: string;
  lastUpdated: string;
  preview: string;
  timeAgo: string;
  /** Whether the ticket has unread messages */
  unread: boolean;
  /** Monotonic sequence used for newest/oldest sorting. */
  order: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface MessagingFilterOption {
  label: string;
  value: string | null;
}

export interface CreateTicketForm {
  participantType: ParticipantType | null;
  sendTo: string | null;
  title: string;
  ticketType: TicketCategory | null;
  linkedItem: string | null;
  description: string;
  attachments?: File[];
}
