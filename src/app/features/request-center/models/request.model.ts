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

export const INCOMPLETE_STATUSES: RequestStatus[] = ['DRAFT', 'SUBMITTED', 'RETURNED'];
export const COMPLETED_STATUSES: RequestStatus[] = ['APPROVED', 'REJECTED', 'RECALLED', 'CANCELLED'];
export const TERMINAL_STATUSES: RequestStatus[] = COMPLETED_STATUSES;

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
  /** Not an identity — a request can collect several entries of the same kind over its life. */
  key: string;
  title: string;
  state: 'done' | 'active' | 'upcoming';
  date?: string;
  badge?: string;
  description: string;
  tone?: 'default' | 'danger' | 'muted' | 'warning';
  /** The admin's reason for returning/rejecting — the vendor's only guidance on what to fix. */
  reason?: string;
  /** Who took the action, e.g. "Admin" — only set for steps built from the audit trail. */
  actor?: string;
}
