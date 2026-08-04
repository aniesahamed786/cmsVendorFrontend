import { BranchApiPayload, GeoPoint } from "../pages/branch-form/branch-form";

/**
 * Normalizes a request's `requestData` into the shape BranchForm's
 * `editableFormData` input expects.
 *
 * CONFIRMED against a real `GET /api/v1/cmsVendor/requests/:requestId`
 * response: `requestData` already matches `BranchApiPayload` field-for-field
 * (branch_name, branch_name_ar, country, country_ar, region, region_ar,
 * city, city_ar, address, link, branchRepresentativeName, branchPhoneNumber,
 * settingsLocationId, geoPoint). This is now just a light defensive
 * pass-through rather than the earlier alternate-key guessing, kept in case
 * a DRAFT was saved with some fields missing (e.g. before geoPoint resolved).
 */
export function toEditableBranchData(requestData: Record<string, unknown> | null | undefined): BranchApiPayload {
  const d = (requestData ?? {}) as Record<string, any>;

  return {
    branch_name: d['branch_name'] ?? '',
    branch_name_ar: d['branch_name_ar'] ?? '',
    country: d['country'] ?? '',
    country_ar: d['country_ar'] ?? '',
    region: d['region'] ?? '',
    region_ar: d['region_ar'] ?? '',
    city: d['city'] ?? '',
    city_ar: d['city_ar'] ?? '',
    address: d['address'] ?? '',
    link: d['link'] ?? '',
    branchRepresentativeName: d['branchRepresentativeName'] ?? '',
    branchPhoneNumber: d['branchPhoneNumber'] ?? '',
    ...(d['settingsLocationId'] ? { settingsLocationId: d['settingsLocationId'] } : {}),
    geoPoint: normalizeGeoPoint(d),
  };
}

function normalizeGeoPoint(d: Record<string, any>): GeoPoint {
  if (Array.isArray(d['geoPoint']?.coordinates) && d['geoPoint'].coordinates.length === 2) {
    return d['geoPoint'];
  }
  // A draft saved before the map link resolved may not have geoPoint yet.
  return { type: 'Point', coordinates: [0, 0] };
}