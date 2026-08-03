import { VendorProfileEditData } from './vendor-profile-edit.model';

/** Shape of GET /cmsVendor/vendorProfile?vendorId= (VendorCmsProfileResponseDto). */
export interface VendorProfileApi {
  vendorId: string;
  vendorName: string;
  vendorNameAr: string;
  description: string;
  descriptionAr: string;
  vendorLogo: string;
  coverImage: string;
  coverImageLandscape: string;
  representativeName: string;
  representativeEmail: string;
  representativeContact: string;
  businessContact: { phone: string[]; email: string[] };
  socialLinks?: { platform?: string; accountName?: string; url: string }[];
}

const first = (values: string[] | undefined | null): string => values?.[0] ?? '';

/**
 * API profile → the edit form's model.
 *
 * Note: the profile endpoint does not return `crn_no` or `website`, so those two fields start
 * empty. They are only sent if the vendor actually types something (the diff ignores
 * empty-to-empty), so loading a profile never blanks them out server-side.
 */
export function toVendorProfileEditData(
  api: VendorProfileApi,
  locations: VendorProfileEditData['locations'] = [],
): VendorProfileEditData {
  return {
    nameEn: api?.vendorName ?? '',
    nameAr: api?.vendorNameAr ?? '',
    crNumber: '',
    descriptionEn: api?.description ?? '',
    descriptionAr: api?.descriptionAr ?? '',
    businessPhone: first(api?.businessContact?.phone),
    businessEmail: first(api?.businessContact?.email),
    businessWebsite: '',
    repFullName: api?.representativeName ?? '',
    repPhone: api?.representativeContact ?? '',
    repEmail: api?.representativeEmail ?? '',
    socialLinks: (api?.socialLinks ?? []).map((link) => link?.url).filter((url): url is string => !!url),
    locations,
    logo: api?.vendorLogo || null,
    coverMobile: api?.coverImage || null,
    coverDesktop: api?.coverImageLandscape || null,
  };
}

/**
 * Edit-form model → the vendor document's own field names.
 *
 * PROFILE requests are diffed against the raw vendor doc (see fetchEntitySnapshot in
 * request.service.ts — it returns `vendorModel.findById(vendorId)`), so `requestData` has to
 * speak the schema's language, not the CMS DTO's. Multi-value schema fields (email, mobile,
 * telephone, website) are arrays even though the form edits a single value.
 *
 * `locations` is deliberately absent: branches are their own STORE entity with their own
 * endpoints, not part of the vendor document.
 */
export function toVendorSchemaPayload(data: VendorProfileEditData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: data.nameEn ?? '',
    name_ar: data.nameAr ?? '',
    description: data.descriptionEn ?? '',
    description_ar: data.descriptionAr ?? '',
    smeName: data.repFullName ?? '',
    smeEmail: data.repEmail ?? '',
    smePhone: data.repPhone ?? '',
    email: data.businessEmail ? [data.businessEmail] : [],
    mobile: data.businessPhone ? [data.businessPhone] : [],
    socialLinks: (data.socialLinks ?? []).filter(Boolean).map((url) => ({ url })),
  };

  // Only include the fields the profile API cannot round-trip when the vendor filled them in,
  // so an untouched blank never overwrites a real stored value.
  if (data.crNumber) payload['crn_no'] = data.crNumber;
  if (data.businessWebsite) payload['website'] = [data.businessWebsite];

  // Images arrive as either a stored URL (unchanged) or a File (freshly cropped). Only the URL
  // form can travel in JSON; File values are dropped by the diff (`dropFiles`), since there is
  // no vendor-facing upload endpoint to turn them into URLs yet.
  payload['logo'] = data.logo ?? '';
  payload['coverImage'] = data.coverMobile ?? '';
  payload['coverImageLandscape'] = data.coverDesktop ?? '';

  return payload;
}

/** True when any branding field still holds an un-uploaded File. */
export function hasPendingImageUpload(data: VendorProfileEditData): boolean {
  return [data.logo, data.coverMobile, data.coverDesktop].some((value) => value instanceof File);
}
