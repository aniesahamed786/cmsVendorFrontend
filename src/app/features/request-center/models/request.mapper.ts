import {
  ApiRequestEntityType,
  ApiRequestType,
  RequestSummaryResponse,
} from './request-api.model';
import { RequestActionType, RequestRow, RequestStatus, RequestType, TERMINAL_STATUSES } from './request.model';

const ENTITY_TO_TYPE: Record<ApiRequestEntityType, RequestType> = {
  OFFER: 'Offer',
  STORE: 'Store',
  PROFILE: 'Profile',
  HIGHLIGHT: 'Highlight',
};

const REQUEST_TO_ACTION: Record<ApiRequestType, RequestActionType> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
};

/** "Sep. 15, 2026 | 8:32 am" — matches the timestamp format used across the Request Center. */
function formatTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
  // en-US gives "Sep 15, 2026" — add the dot after the abbreviated month to match the design.
  return `${datePart.replace(/^(\w{3}) /, '$1. ')} | ${timePart}`;
}

/** Map one paginated list row from GET /cmsVendor/requests into the table's view-model. */
export function toRequestRow(summary: RequestSummaryResponse): RequestRow {
  const status = summary.status as RequestStatus;
  const date = new Date(summary.updatedOn);
  return {
    rowKey: summary.requestId,
    id: summary.requestId,
    type: ENTITY_TO_TYPE[summary.entityType] ?? 'Offer',
    actionType: REQUEST_TO_ACTION[summary.requestType] ?? 'Created',
    targetEntity: summary.title,
    timestamp: formatTimestamp(date),
    date,
    status,
    completed: TERMINAL_STATUSES.includes(status),
  };
}
