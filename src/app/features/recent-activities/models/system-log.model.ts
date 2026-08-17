import { ApiRequestEntityType, ApiRequestStatus, ApiRequestType } from '../../request-center/models/request-api.model';

export interface SystemLogEntry {
  id: string;
  requestId: string;
  entityType: ApiRequestEntityType;
  entityId: string;
  requestType: ApiRequestType;
  title: string;
  status: ApiRequestStatus;
  action: SystemLogAction;
  performedBy: string;
  performedRole: string;
  remarks: string | null;
  createdAt: string;
}

export type SystemLogAction = 'SUBMITTED' | 'RECALLED' | 'CANCELLED';

export interface SystemLogListResponse {
  data: SystemLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type SystemLogSortOrder = 'asc' | 'desc';

export interface SystemLogQuery {
  page: number;
  pageSize: number;
  sortOrder?: SystemLogSortOrder;
  entityType?: ApiRequestEntityType;
  action?: SystemLogAction;
  search?: string;
  from?: string;
  to?: string;
}
