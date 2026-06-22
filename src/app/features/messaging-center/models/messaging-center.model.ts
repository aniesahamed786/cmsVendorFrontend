export type TicketCategory = 'Technical' | 'Billing' | 'General' | 'Account';

export type TicketStatus = 'New' | 'In Progress' | 'Open' | 'Closed';

export type ParticipantType = 'Vendor' | 'Admin' | 'User';

export type SenderRole = 'User' | 'Admin' | 'Vendor' | 'System';

export type TicketTabKey = 'all' | 'unread' | 'read';

export type SortOrder = 'newest' | 'oldest';

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
}
