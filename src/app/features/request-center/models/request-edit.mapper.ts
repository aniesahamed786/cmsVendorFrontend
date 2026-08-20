import { BranchFormModel, BranchFormSubmit, GeoPoint } from '../../Branches/pages/branch-form/branch-form';
import { VendorProfileEditData } from '../../Profile/models/vendor-profile-edit.model';
import { toVendorMediaUrl } from '../../../shared/utils/media-url';
import { normalizeVendorSocialLinks } from '../../vendors/models/vendordetails';

/**
 * Adapters between a pending request's proposed entity (see buildProposedEntity) and the
 * shapes the real edit forms already accept. Editing a request reuses those forms verbatim —
 * only the source of the initial data and the destination of the save differ.
 */

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['$date', '$oid', 'url', 'name']) {
      if (record[key] !== undefined) return asText(record[key]);
    }
    return '';
  }
  return String(value);
};

/** Schema fields like email/mobile are arrays even though the form edits a single value. */
const firstOf = (value: unknown): string =>
  Array.isArray(value) ? asText(value[0]) : asText(value);

// ---- STORE / branch -------------------------------------------------------

/** Proposed branch document → the branch form's model. */
export function toBranchFormModel(proposed: Record<string, unknown>): BranchFormModel {
  return {
    // id: asText(proposed['_id'] ?? proposed['locationId']) || undefined,
    // locationNameEn: asText(proposed['branch_name']),
    // locationNameAr: asText(proposed['branch_name_ar']),
    // country: asText(proposed['country']),
    // region: asText(proposed['region']),
    // city: asText(proposed['city']),
    // address: asText(proposed['address']),
    // googleMapLink: asText(proposed['link']),
    // representativeName: asText(proposed['branchRepresentativeName']),
    // phoneNumber: asText(proposed['branchPhoneNumber']),

    branch_name: asText(proposed['branch_name']),
      branch_name_ar: asText(proposed['branch_name_ar']),
      country: asText(proposed['country']),
      country_ar: asText(proposed['country_ar']),
      region: asText(proposed['region']),
      region_ar: asText(proposed['region_ar']),
      city: asText(proposed['city']),
      city_ar: asText(proposed['city_ar']),
      address: asText(proposed['address']),
      link: asText(proposed['link']),
      branchRepresentativeName: asText(proposed['branchRepresentativeName']),
      branchPhoneNumber: asText(proposed['branchPhoneNumber']),
      settingsLocationId: asText(proposed['settingsLocationId']),
      geoPoint: asGeoPoint(proposed['geoPoint']) ?? DEFAULT_GEOPOINT,
  };
}

const DEFAULT_GEOPOINT: GeoPoint = { type: 'Point', coordinates: [0, 0] };

function asGeoPoint(value: unknown): GeoPoint | undefined {
  if (!value) return undefined;

  // Already GeoJSON
  if (
    typeof value === 'object' &&
    (value as any).type === 'Point' &&
    Array.isArray((value as any).coordinates)
  ) {
    const [lng, lat] = (value as any).coordinates;
    if (typeof lng === 'number' && typeof lat === 'number') {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  // { lat, lng } object
  if (typeof value === 'object' && 'lat' in (value as any) && 'lng' in (value as any)) {
    const lat = Number((value as any).lat);
    const lng = Number((value as any).lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  // "lat,lng" string
  if (typeof value === 'string') {
    const parts = value.split(',').map((s) => Number(s.trim()));
    if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
      const [lat, lng] = parts;
      return { type: 'Point', coordinates: [lng, lat] };
    }
  }

  return undefined;
}

/** Branch form model → the vendor-location document's own field names, which requestData uses. */
export function fromBranchFormModel(model: BranchFormModel | Partial<BranchFormModel>): Record<string, unknown> {
  return {
    branch_name: asText(model.branch_name),
    branch_name_ar: asText(model.branch_name_ar),
    country: asText(model.country),
    country_ar: asText(model.country_ar),
    region: asText(model.region),
    region_ar: asText(model.region_ar),
    city: asText(model.city),
    city_ar: asText(model.city_ar),
    address: asText(model.address),
    link: asText(model.link),
    branchRepresentativeName: asText(model.branchRepresentativeName),
    branchPhoneNumber: asText(model.branchPhoneNumber),
    settingsLocationId: asText(model.settingsLocationId),
    geoPoint: model.geoPoint ?? DEFAULT_GEOPOINT,
  };
}

export function fromBranchFormSubmit(submit: BranchFormSubmit): Record<string, unknown> {
  const changed = submit.payload;
  return {
    branch_name: asText(changed['branch_name']),
    branch_name_ar: asText(changed['branch_name_ar']), // was reading 'country' — bug from earlier version
    country: asText(changed['country']),
    country_ar: asText(changed['country_ar']),
    region: asText(changed['region']),
    region_ar: asText(changed['region_ar']),
    city: asText(changed['city']),
    city_ar: asText(changed['city_ar']),
    address: asText(changed['address']),
    link: asText(changed['link']),
    branchRepresentativeName: asText(changed['branchRepresentativeName']),
    branchPhoneNumber: asText(changed['branchPhoneNumber']),
    settingsLocationId: asText(changed['settingsLocationId']),
    geoPoint: asGeoPoint(changed['geoPoint']) ?? DEFAULT_GEOPOINT,
  };
}

// ---- PROFILE --------------------------------------------------------------

/**
 * Proposed vendor document → the profile edit form's model.
 *
 * The inverse of `toVendorSchemaPayload`, so what the form saves round-trips back into the
 * same keys `requestData` already stores.
 */
export function toProfileEditData(proposed: Record<string, unknown>): VendorProfileEditData {
  const socialLinks = normalizeVendorSocialLinks(proposed['socialLinks']);

  return {
    nameEn: asText(proposed['name']),
    nameAr: asText(proposed['name_ar']),
    crNumber: asText(proposed['crn_no']),
    descriptionEn: asText(proposed['description']),
    descriptionAr: asText(proposed['description_ar']),
    businessPhone: firstOf(proposed['mobile']),
    businessEmail: firstOf(proposed['email']),
    businessWebsite: firstOf(proposed['website']),
    repFullName: asText(proposed['smeName']),
    repPhone: asText(proposed['smePhone']),
    repEmail: asText(proposed['smeEmail']),
    socialLinks,
    // Branches are their own STORE entity, never part of a PROFILE request.
    locations: [],
    // The profile form renders these straight into <img src>, so they are resolved here.
    // Safe for the save path: this same object is the diff baseline, so an untouched image
    // compares equal to itself and never reaches requestData — only a newly cropped `File`
    // does.
    logo: toVendorMediaUrl(proposed['logo']) || null,
    coverMobile: toVendorMediaUrl(proposed['coverImage']) || null,
    coverDesktop: toVendorMediaUrl(proposed['coverImageLandscape']) || null,
  };
}

// ---- requestData assembly -------------------------------------------------

/**
 * The `requestData` to PUT back after editing a request.
 *
 * A CREATE request stores the whole payload, so it is replaced outright. An UPDATE request
 * stores only the diff against the live entity — and the form was seeded with the *proposed*
 * entity (live + this request's edits), so its diff carries only what changed on top of that.
 * Merging over the stored data therefore keeps the earlier edits and layers the new ones.
 */
export function mergeRequestData(
  requestType: 'CREATE' | 'UPDATE',
  storedRequestData: Record<string, unknown>,
  formData: Record<string, unknown>,
): Record<string, unknown> {
  if (requestType === 'CREATE') return formData;
  return { ...toSubmittableRequestData(storedRequestData), ...formData };
}

/**
 * Undo the read-only enrichment GET /requests/{id} applies before writing `requestData` back.
 *
 * The endpoint replaces the submitted `categoryIds: string[]` with a resolved
 * `category: { id, name, icon }[]` for display. Sending that back would persist the display
 * shape as the request's payload and lose the ids the approval step reads, so it is folded
 * back into `categoryIds` here.
 */
function toSubmittableRequestData(stored: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(stored['category'])) return stored;

  const { category, ...rest } = stored;
  const categoryIds = (category as unknown[])
    .map((entry) =>
      typeof entry === 'string' ? entry : asText((entry as Record<string, unknown>)?.['id']),
    )
    .filter(Boolean);

  return { ...rest, categoryIds };
}
