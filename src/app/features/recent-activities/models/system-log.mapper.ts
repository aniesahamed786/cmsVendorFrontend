import { SystemLogEntry, SystemLogListResponse } from './system-log.model';

export interface ActivityRow {
  timestamp: string;
  actionType: string;
  performedBy: string;
  targetEntity: string;
  referenceId: string;
  status: string;
  statusLabel: string;
  remarks: string | null;
}

const ENTITY_LABELS: Record<string, string> = {
  OFFER: 'Offer',
  STORE: 'Store',
  PROFILE: 'Profile',
  HIGHLIGHT: 'Highlight',
};

export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
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
  const entity = ENTITY_LABELS[entry.entityType] ?? titleCase(entry.entityType);
  const action = titleCase(entry.action);
  return {
    timestamp: formatTimestamp(entry.createdAt),
    actionType: [entity, action].filter(Boolean).join(' ') || '—',
    performedBy: entry.performedBy || '—',
    targetEntity: entry.title || entity || '—',
    referenceId: entry.requestId || '—',
    status: entry.status ?? '',
    statusLabel: titleCase(entry.status) || '—',
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
