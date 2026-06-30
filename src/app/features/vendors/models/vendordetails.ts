import { VendorSocialLink } from './createNewVendor';

export type VendorStatus = 'active' | 'inactive' | 'idle';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Ensure socialLinks is always { platform?, accountName?, url }[] when receiving vendor data from API. */
export function normalizeVendorSocialLinks(value: unknown, legacyLinks?: unknown): VendorSocialLink[] {
  const source = value ?? legacyLinks;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'string') {
          const url = item.trim();
          return url ? { url } : null;
        }

        const url = isRecord(item) ? item['url'] : undefined;
        const platformValue = isRecord(item) ? item['platform'] : undefined;
        const accountNameValue = isRecord(item) ? item['accountName'] : undefined;

        if (typeof url === 'string' && url.trim()) {
          const platform = typeof platformValue === 'string' && platformValue.trim()
            ? platformValue.trim()
            : undefined;
          const accountName = typeof accountNameValue === 'string' && accountNameValue.trim()
            ? accountNameValue.trim()
            : undefined;

          return {
            url: url.trim(),
            ...(platform ? { platform } : {}),
            ...(accountName ? { accountName } : {}),
          };
        }

        return null;
      })
      .filter((item): item is VendorSocialLink => item !== null);
  }

  if (typeof source === 'string') {
    if (source.trim() === '') return [];
    try {
      const parsed = JSON.parse(source) as unknown;
      return normalizeVendorSocialLinks(parsed);
    } catch {
      return source
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((url) => ({ url }));
    }
  }

  return [];
}

/** Apply to a vendor object so socialLinks is normalized. */
export function normalizeVendorResponse<T extends { socialLinks?: unknown; links?: unknown }>(v: T): T {
  if (!v) return v;

  const status = getVendorStatus(v as { status?: unknown; isActive?: unknown });
  return {
    ...v,
    status,
    isActive: status === 'active',
    socialLinks: normalizeVendorSocialLinks(v.socialLinks, v.links),
  } as T;
}

export function getVendorStatus(vendor: { status?: unknown; isActive?: unknown } | null | undefined): VendorStatus {
  const rawStatus = typeof vendor?.status === 'string' ? vendor.status.trim().toLowerCase() : '';
  if (rawStatus === 'active' || rawStatus === 'inactive' || rawStatus === 'idle') {
    return rawStatus;
  }

  const rawIsActive = vendor?.isActive;
  if (rawIsActive === true || rawIsActive === 'true' || rawIsActive === 'ACTIVE' || rawIsActive === 'active') {
    return 'active';
  }

  if (rawIsActive === false || rawIsActive === 'false' || rawIsActive === 'INACTIVE' || rawIsActive === 'inactive') {
    return 'inactive';
  }

  return 'idle';
}

export function isVendorInactive(vendor: { status?: unknown; isActive?: unknown } | null | undefined): boolean {
  return getVendorStatus(vendor) === 'inactive';
}

export function isVendorActive(vendor: { status?: unknown; isActive?: unknown } | null | undefined): boolean {
  return getVendorStatus(vendor) === 'active';
}

export interface VendorDetails {
  _id: MongoId;
  crn_no: string;
  mobile: string | string[];
  smePhone: string;
  telephone: string | string[];
  name_ar: string;
  name: string;
  status: VendorStatus;
  isActive: boolean | string;
  smeEmail: string;
  searchKeywords: string[] | string;
  description_ar: string;
  smeName: string;
  socialLinks: VendorSocialLink[];
  links?: string[];
  website: string | string[];
  email: string | string[];
  description: string;
  locations: Location[] | string;
  logo?: string;
  deactivateReason?: string;
  offers: any[];
  createdBy: CreatedBy;
  createdAt: DateValue;
  updatedAt: DateValue;
  __v: number;
}

export interface MongoId {
  $oid: string;
}

export interface DateValue {
  $date: string;
}

export interface CreatedBy {
  networkId: string;
  name: string;
}

export interface Location {
  [key: string]: any;
}
