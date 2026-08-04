import { BranchFormModel } from '../../Branches/pages/branch-form/branch-form';
import { VendorProfileEditData } from '../../Profile/models/vendor-profile-edit.model';

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
    id: asText(proposed['_id'] ?? proposed['locationId']) || undefined,
    locationNameEn: asText(proposed['branch_name']),
    locationNameAr: asText(proposed['branch_name_ar']),
    country: asText(proposed['country']),
    region: asText(proposed['region']),
    city: asText(proposed['city']),
    address: asText(proposed['address']),
    googleMapLink: asText(proposed['link']),
    representativeName: asText(proposed['branchRepresentativeName']),
    phoneNumber: asText(proposed['branchPhoneNumber']),
  };
}

/** Branch form model → the vendor-location document's own field names, which requestData uses. */
export function fromBranchFormModel(model: Partial<BranchFormModel>): Record<string, unknown> {
  return {
    branch_name: model.locationNameEn ?? '',
    branch_name_ar: model.locationNameAr ?? '',
    country: model.country ?? '',
    region: model.region ?? '',
    city: model.city ?? '',
    address: model.address ?? '',
    link: model.googleMapLink ?? '',
    branchRepresentativeName: model.representativeName ?? '',
    branchPhoneNumber: model.phoneNumber ?? '',
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
  const socialLinks = (Array.isArray(proposed['socialLinks']) ? proposed['socialLinks'] : [])
    .map((link) => (typeof link === 'string' ? link : asText((link as Record<string, unknown>)?.['url'])))
    .filter((url): url is string => !!url);

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
    logo: asText(proposed['logo']) || null,
    coverMobile: asText(proposed['coverImage']) || null,
    coverDesktop: asText(proposed['coverImageLandscape']) || null,
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
