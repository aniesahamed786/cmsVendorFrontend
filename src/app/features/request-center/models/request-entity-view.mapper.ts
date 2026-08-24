import { RequestDetailsResponse } from './request-api.model';

/**
 * Field-name aliases between a stored document and the payload that a request submits.
 * `current` uses the document's names; `requestData` uses the create-payload's, and the two
 * don't always agree on casing (`Discount_amount` vs `discount_amount`).
 */
const ALIASES: Record<string, string[]> = {
  Discount_amount: ['discount_amount'],
  Discount_amount_ar: ['discount_amount_ar'],
  // `category` is what GET /requests/{id} returns: resolveCategoryIdsToCategory replaces the
  // submitted `categoryIds` with a `{ id, name, icon }[]`, so the payload spelling varies.
  categories: ['category', 'categoryIds', 'categoryId'],
};

/** Every spelling categories travel under, in any of the three sources. */
const CATEGORY_KEYS = ['categories', 'category', 'categoryIds', 'categoryId'];

/**
 * The entity as it would look if the request were approved: the live entity overlaid with
 * everything the request proposes. For a CREATE request `current` is null, so this is simply
 * `requestData` — which is what makes a brand-new offer render at all.
 */
export function buildProposedEntity(
  details: RequestDetailsResponse | null,
): Record<string, unknown> {
  if (!details) return {};

  const current = { ...((details.current ?? {}) as Record<string, unknown>) };
  const requestData = (details.requestData ?? {}) as Record<string, unknown>;

  const proposed: Record<string, unknown> = { ...current, ...requestData };

  // Fold payload-named keys onto their document-named counterparts so downstream readers only
  // need to know one name.
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (requestData[alias] !== undefined) {
        proposed[canonical] = requestData[alias];
      }
    }
  }

  // A confirmed diff always wins — it is the authoritative new value. Categories are the one
  // exception: the diff carries raw IDs, so letting it through would undo the resolved
  // `{ id, name, icon }` objects and put IDs back on screen.
  for (const change of details.changes ?? []) {
    if (!change?.field || CATEGORY_KEYS.includes(change.field)) continue;
    proposed[change.field] = change.newValue;
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(change.field)) proposed[canonical] = change.newValue;
    }
  }

  return { ...proposed, ...resolveCategories(current, requestData, details.changes ?? []) };
}

const categoryId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const record = (value ?? {}) as Record<string, unknown>;
  return asString(record['id'] ?? record['_id'] ?? record['categoryId']);
};

/**
 * The single source of truth for a request's categories, in both shapes callers need:
 * `categories` as `{ id, name, icon }` objects for display, and `categoryIds` as plain ids
 * for the offer form.
 *
 * The named objects only exist where the API resolved them — in `requestData.category` for
 * what the request proposes, or on the live offer document for what it has today. Everything
 * else (the raw `categoryIds` a vendor submitted, the diff rows) is IDs only, and is used
 * solely as a fallback so an unresolvable category still renders as something.
 */
function resolveCategories(
  current: Record<string, unknown>,
  requestData: Record<string, unknown>,
  changes: RequestDetailsResponse['changes'],
): Record<string, unknown> {
  const proposesCategories =
    requestData['category'] !== undefined ||
    requestData['categoryIds'] !== undefined ||
    requestData['categories'] !== undefined ||
    changes.some((change) => CATEGORY_KEYS.includes(change?.field));

  // An UPDATE request that doesn't touch categories keeps showing the offer's current ones.
  const source = proposesCategories
    ? requestData['category'] ?? requestData['categories'] ?? requestData['categoryIds']
    : current['categories'];

  const categories = Array.isArray(source) ? source : [];

  return {
    categories,
    categoryIds: categories.map(categoryId).filter(Boolean),
  };
}

/** Set of field names this request edits, in both document and payload spellings. */
export function buildEditedFieldSet(details: RequestDetailsResponse | null): Set<string> {
  const edited = new Set<string>();
  for (const change of details?.changes ?? []) {
    if (!change?.field) continue;
    edited.add(change.field);
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(change.field)) edited.add(canonical);
      if (canonical === change.field) aliases.forEach((a) => edited.add(a));
    }
  }
  return edited;
}

const asString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['$date', '$oid', 'name', 'url']) {
      if (record[key] !== undefined) return asString(record[key]);
    }
    return '';
  }
  return String(value);
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value ? [value] : []);

/** Joins a contact field that may be stored as an array or a single value. */
const joinContact = (value: unknown): string =>
  asArray(value).map(asString).filter(Boolean).join(', ');

/**
 * Proposed offer → the view model `<app-offer-details>` renders (the same shape the offer
 * details page builds), so a request reuses the real offer detail design rather than a
 * bespoke field list.
 */
export function toOfferDetailsView(proposed: Record<string, unknown>): Record<string, unknown> {
  // Every category, not just the first — an offer can carry several, and <app-offer-details>
  // reads the `categories` array before falling back to the single `category`.
  const categories = asArray(proposed['categories'])
    .map((entry) => {
      // An unresolved id is all that's left when the category no longer exists; showing the
      // id beats showing an empty chip.
      if (typeof entry === 'string') return { name: entry, name_ar: '', icon: '' };
      const record = (entry ?? {}) as Record<string, unknown>;
      const name = asString(record['name'] ?? record['categoryName']);
      return {
        name,
        name_ar: asString(record['name_ar'] ?? record['categoryNameAr']) || name,
        icon: asString(record['icon'] ?? record['categoryLogo']),
      };
    })
    .filter((category) => !!category.name || !!category.icon);

  // offerMode is a string[] on the document but a single string in the create payload.
  const rawMode = proposed['offerMode'];
  const offerMode = Array.isArray(rawMode)
    ? rawMode.length > 1
      ? 'both'
      : asString(rawMode[0])
    : asString(rawMode);

  return {
    title: asString(proposed['title']),
    title_ar: asString(proposed['title_ar']),
    description: asString(proposed['description']),
    description_ar: asString(proposed['description_ar']),
    startDate: asString(proposed['startDate']),
    expiryDate: asString(proposed['expiryDate']),
    categories,
    category: categories[0] ?? null,
    tags: asArray(proposed['tags']).map(asString).filter(Boolean),
    targetAudience: asArray(proposed['targetAudience']).map(asString).filter(Boolean),
    discount_type: asString(proposed['discountType'] ?? proposed['discount_type']),
    discount_amount: asString(proposed['Discount_amount']),
    discount_amount_ar: asString(proposed['Discount_amount_ar']),
    discountCode: asString(proposed['discountCode']),
    offerMode: offerMode || 'in store',
    howToAvail: asString(proposed['howToAvail']),
    howToAvail_ar: asString(proposed['howToAvail_ar']),
    website: asString(proposed['website']),
    mobile: joinContact(proposed['mobile']),
    telephone: joinContact(proposed['telephone']),
    email: joinContact(proposed['email']),
    highlight_title: asString(proposed['highlight_title']),
    highlight_title_ar: asString(proposed['highlight_title_ar']),
    highlight_description: asString(proposed['highlight_description']),
    highlight_description_ar: asString(proposed['highlight_description_ar']),
    isHighlightEnabled: !!proposed['isHighlightEnabled'],
    // <app-offer-details> reads these two directly; without them the highlight card renders
    // its text but no artwork.
    highlight_image: asString(proposed['highlight_image']),
    highlight_image_landscape: asString(proposed['highlight_image_landscape']),
    hotel_details: proposed['hotel_details'] ?? null,
    status: asString(proposed['status']),
    offerImages: {
      image: asString(proposed['image']),
      imageLandscape: asString(proposed['image_landscape']),
    },
    offerLogo: asString(proposed['image']),
  };
}

export interface ProfileSocialLinkView {
  platform: string;
  accountName: string;
  url: string;
}

export interface ProfileRequestView {
  name: string;
  nameAr: string;
  logo: string;
  description: string;
  descriptionAr: string;
  representativeName: string;
  representativeContact: string;
  representativeEmail: string;
  businessPhone: string;
  businessEmail: string;
  socialLinks: ProfileSocialLinkView[];
  coverImage: string;
  coverImageLandscape: string;
}

/**
 * Proposed vendor profile → exactly the fields the vendor profile detail page renders
 * (hero, description, representative, business contact, social links, cover images).
 *
 * Deliberately excludes `crn_no` and `website`: the profile page does not show them, so
 * surfacing them here would make the request view diverge from the page it mirrors.
 */
export function toProfileRequestView(proposed: Record<string, unknown>): ProfileRequestView {
  const socialLinks = asArray(proposed['socialLinks'])
    .map((link) => {
      if (typeof link === 'string') return { platform: '', accountName: '', url: link };
      const record = (link ?? {}) as Record<string, unknown>;
      return {
        platform: asString(record['platform']),
        accountName: asString(record['accountName']),
        url: asString(record['url']),
      };
    })
    .filter((link) => !!link.url || !!link.platform);

  return {
    name: asString(proposed['name']),
    nameAr: asString(proposed['name_ar']),
    logo: asString(proposed['logo']),
    description: asString(proposed['description']),
    descriptionAr: asString(proposed['description_ar']),
    // The vendor doc stores the representative under sme* keys.
    representativeName: asString(proposed['smeName']),
    representativeContact: asString(proposed['smePhone']),
    representativeEmail: asString(proposed['smeEmail']),
    businessPhone: joinContact(proposed['mobile']),
    businessEmail: joinContact(proposed['email']),
    socialLinks,
    coverImage: asString(proposed['coverImage']),
    coverImageLandscape: asString(proposed['coverImageLandscape']),
  };
}

export interface BranchViewField {
  /** Document field name, so the view can ask whether this request edits it. */
  key: string;
  labelKey: string;
  value: string;
  rtl?: boolean;
}

/**
 * Proposed store → labelled branch fields. Branches have no detail component of their own
 * (the branches page is a table), so this renders as a card in the same house style.
 */
export function toBranchView(proposed: Record<string, unknown>): BranchViewField[] {
  const L = 'requestCenter.detail.field.';

  const branchName = asString(proposed['branch_name'] ?? proposed['locationNameEn'] ?? proposed['locationName'] ?? proposed['name']);
  const branchNameAr = asString(proposed['branch_name_ar'] ?? proposed['locationNameAr'] ?? proposed['nameAr']);
  const country = asString(proposed['country']);
  const region = asString(proposed['region']);
  const city = asString(proposed['city']);
  const address = asString(proposed['address']);
  const link = asString(proposed['link'] ?? proposed['googleMapLink'] ?? proposed['mapLink']);
  const representativeName = asString(proposed['branchRepresentativeName'] ?? proposed['representativeName'] ?? proposed['repName']);
  const phoneNumber = asString(proposed['branchPhoneNumber'] ?? proposed['phoneNumber'] ?? proposed['phone'] ?? proposed['repPhone']);

  return [
    { key: 'branch_name', labelKey: L + 'branchName', value: branchName },
    { key: 'branch_name_ar', labelKey: L + 'branchNameAr', value: branchNameAr, rtl: true },
    { key: 'country', labelKey: L + 'country', value: country },
    { key: 'region', labelKey: L + 'region', value: region },
    { key: 'city', labelKey: L + 'city', value: city },
    { key: 'address', labelKey: L + 'address', value: address },
    { key: 'link', labelKey: L + 'mapLink', value: link },
    { key: 'branchRepresentativeName', labelKey: L + 'branchRepName', value: representativeName },
    { key: 'branchPhoneNumber', labelKey: L + 'branchPhone', value: phoneNumber },
  ];
}
