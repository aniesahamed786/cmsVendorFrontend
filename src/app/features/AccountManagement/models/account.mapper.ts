import {
  AccountType,
  CreateAccountPayload,
  UpdateAccountPayload,
  VendorAccountDetail,
} from './account.model';

export interface AccountFormValue {
  name: string;
  email: string;
  phone: string;
  permissions?: string[];
  locationIds?: string[];
  categoryIds?: string[];
}

export function buildAccountPayload(value: AccountFormValue): CreateAccountPayload {
  return {
    name: (value.name ?? '').trim(),
    email: (value.email ?? '').trim().toLowerCase(),
    phone: (value.phone ?? '').trim(),
    accountType: 'SUB_ACCOUNT',
    permissions: [...(value.permissions ?? [])],
    locationIds: [...(value.locationIds ?? [])],
    categoryIds: [...(value.categoryIds ?? [])],
  };
}

function sameMembers(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((v, i) => v === right[i]);
}

export function buildAccountUpdatePayload(
  original: VendorAccountDetail,
  value: AccountFormValue,
  accountType: AccountType = original.accountType,
): UpdateAccountPayload {
  const payload: UpdateAccountPayload = {};

  const name = (value.name ?? '').trim();
  if (name && name !== original.name) payload.name = name;

  const phone = (value.phone ?? '').trim();
  if (phone && phone !== original.phone) payload.phone = phone;

  if (accountType === 'SUB_ACCOUNT') {
    if (!sameMembers(value.permissions, original.permissions)) {
      payload.permissions = [...(value.permissions ?? [])];
    }
    if (!sameMembers(value.locationIds, original.locationIds)) {
      payload.locationIds = [...(value.locationIds ?? [])];
    }
    if (!sameMembers(value.categoryIds, original.categoryIds)) {
      payload.categoryIds = [...(value.categoryIds ?? [])];
    }
  }

  return payload;
}

export function isEmptyUpdate(payload: UpdateAccountPayload): boolean {
  return Object.keys(payload).length === 0;
}
