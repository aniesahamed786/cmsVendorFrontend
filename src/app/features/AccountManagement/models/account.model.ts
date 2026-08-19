export type AccountType = 'MAIN' | 'SUB_ACCOUNT';
export type VendorLanguage = 'ENGLISH' | 'ARABIC';
export type VendorTheme = 'LIGHT' | 'DARK';

export const SUBACCOUNT_DEFAULT_PERMISSIONS = [
  'cms_profile:read',
  'cms_offers:read',
  'cms_locations:read',
  'cms_redemptions:manage',
] as const;


export interface SubaccountPermissionOption {
  key: string;
  value: string;
}

export const SUBACCOUNT_PERMISSION_OPTIONS: SubaccountPermissionOption[] = [
  { key: 'redemptionHistory', value: 'cms_redemptions:read' },
  { key: 'analytics', value: 'cms_analytics:read' },
  { key: 'manageBranches', value: 'cms_locations:manage' },
];


export interface CreateSubAccountPayload {
  name: string;
  email: string;
  phone: string;
  accountType: 'SUB_ACCOUNT';
  permissions: string[];
  locationIds: string[];
  categoryIds: string[];
}

export type CreateAccountPayload = CreateSubAccountPayload;

export interface UpdateAccountPayload {
  name?: string;
  phone?: string;
  permissions?: string[];
  locationIds?: string[];
  categoryIds?: string[];
}

export interface VendorLocation {
  locationId: string;
  locationName: string;
  locationNameAr: string;
  city: string;
  cityAr: string;
  totalOffers: number;
  representativeName: string;
  representativeNameAr: string;
}

export interface VendorCategory {
  _id: { $oid: string } | string;
  name: string;
  name_ar: string;
  icon?: string;
  order?: number;
  isDefault?: boolean;
  offers?: number;
  activeOffers?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface UpdateAccountStatusPayload {
  accountStatus: AccountStatus;
}

export interface VendorAccount {
  id: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
  accountStatus: AccountStatus;
  accountType: AccountType;
}

export interface VendorAccountDetail {
  id: string;
  vendorId: string;
  name: string;
  email: string;
  phone: string;
  accountType: AccountType;
  roleId: string;
  roleName: string;
  permissions: string[];
  locationIds: string[];
  categoryIds: string[];
  accountStatus: AccountStatus;
  language: VendorLanguage;
  theme: VendorTheme;
  lastLoginAt?: unknown;
  passwordChangedAt?: unknown;
  createdBy?: unknown;
  updatedBy?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccountListQuery {
  page: number;
  pageSize: number;
  accountType?: AccountType;
}
