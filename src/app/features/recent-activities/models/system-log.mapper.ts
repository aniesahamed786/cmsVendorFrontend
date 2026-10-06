import { SystemLogEntry, SystemLogListResponse } from './system-log.model';

/** Raw codes only — labels are i18n keys resolved in the template so a live
 *  language switch re-renders them (rows are mapped once, at load time). */
export interface ActivityRow {
  timestamp: string;
  entityType: string;
  action: string;
  title: string;
  performedBy: string;
  referenceId: string;
  status: string;
  remarks: string | null;
}

const ENTITY_KEYS: Record<string, string> = {
  OFFER: 'requestCenter.type.offer',
  STORE: 'requestCenter.type.store',
  BRANCH: 'requestCenter.type.store',
  PROFILE: 'requestCenter.type.profile',
  HIGHLIGHT: 'requestCenter.type.highlight',
  ACCOUNT: 'recentActivities.type.account',
  BANNER: 'recentActivities.type.banner',
  NOTIFICATION: 'recentActivities.type.notification',
};

const ACTIVITY_KEYS: Record<string, string> = {
  SUBMITTED: 'recentActivities.activity.submitted',
  RECALLED: 'recentActivities.activity.recalled',
  CANCELLED: 'recentActivities.activity.cancelled',
  // ACCOUNT rows — backend VENDOR_ACCOUNT_LOG_ACTIONS
  CREATED: 'recentActivities.activity.created',
  UPDATED: 'recentActivities.activity.updated',
  SUSPENDED: 'recentActivities.activity.suspended',
  REINSTATED: 'recentActivities.activity.reinstated',
  LOGOUT: 'recentActivities.activity.logout',
  DELETED: 'recentActivities.activity.deleted',
};

export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// ponytail: an unmapped code falls through as its title-cased self — i18n.t()
// returns unknown keys verbatim, so the cell reads "Xyz", never a raw key path.
export function entityKey(entityType: string | null | undefined): string {
  if (!entityType) return '—';
  return ENTITY_KEYS[entityType] ?? titleCase(entityType);
}

export function activityKey(action: string | null | undefined): string {
  if (!action) return '—';
  return ACTIVITY_KEYS[action] ?? titleCase(action);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
  const timePart = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
  return `${datePart} | ${timePart}`;
}

export function toActivityRow(entry: SystemLogEntry): ActivityRow {
  return {
    timestamp: formatTimestamp(entry.createdAt),
    entityType: entry.entityType ?? '',
    action: entry.action ?? '',
    title: entry.title || '',
    performedBy: entry.performedBy || '—',
    referenceId: entry.requestId || '—',
    status: entry.status ?? '',
    remarks: entry.remarks ?? null,
  };
}

export function toActivityPage(response: SystemLogListResponse | SystemLogEntry[] | null): {
  rows: ActivityRow[];
  total: number;
} {
  if (Array.isArray(response)) {
    return { rows: response.map(toActivityRow), total: response.length };
  }
  const data = response?.data ?? [];
  return { rows: data.map(toActivityRow), total: response?.total ?? data.length };
}
