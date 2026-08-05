// The view-model for the Request Center. `type`/`actionType`/`status` carry the backend
// enum values (see request-api.model.ts); display text + pill colors are derived from them.
export type RequestType = 'Offer' | 'Store' | 'Profile' | 'Highlight';
export type RequestActionType = 'Created' | 'Updated';
export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECALLED'
  | 'CANCELLED';

/** Terminal statuses — a request here has reached a final outcome (the "Completed" tab). */
export const TERMINAL_STATUSES: RequestStatus[] = ['APPROVED', 'REJECTED', 'RECALLED', 'CANCELLED'];

export interface RequestBasicInfo {
  titleEn: string;
  descriptionEn: string;
  descriptionAr: string;
  startDate: string;
  expiryDate: string;
  category: string;
  tags: string[];
  discountType: string;
  discountValue: string;
}

export interface RequestRow {
  /** The persisted requestId — unique per request and what every workflow endpoint keys on. */
  rowKey: string;
  id: string;
  type: RequestType;
  actionType: RequestActionType;
  targetEntity: string;
  timestamp: string;
  date: Date;
  status: RequestStatus;
  completed: boolean;
  basicInfo?: RequestBasicInfo;
}

export interface RequestStats {
  pendingOffer: number;
  pendingStore: number;
  pendingProfile: number;
  rejected: number;
}

export interface RequestTimelineStep {
  key: 'submitted' | 'underReview' | 'final';
  title: string;
  state: 'done' | 'active' | 'upcoming';
  date?: string;
  badge?: string;
  description: string;
  tone?: 'default' | 'danger' | 'muted' | 'warning';
  /** The admin's reason for returning/rejecting — the vendor's only guidance on what to fix. */
  reason?: string;
}
