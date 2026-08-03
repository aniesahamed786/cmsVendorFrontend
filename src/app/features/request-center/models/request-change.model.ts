import { RequestChangeResponse, RequestDetailsResponse } from './request-api.model';

/**
 * One row on the request-detail page: the field as it will look if the request is approved,
 * plus whether this request is what changed it.
 */
export interface RequestViewField {
  key: string;
  labelKey: string;
  /** The proposed value — the live entity's value, overridden by this request's change. */
  value: string;
  edited: boolean;
  rtl: boolean;
  multiline: boolean;
}

/** A card on the detail page, mirroring the offer form's sections. */
export interface RequestViewSection {
  key: string;
  titleKey: string;
  icon: string;
  fields: RequestViewField[];
  /** True when any field in the section was edited — drives the section-level badge. */
  edited: boolean;
}

interface FieldDef {
  /** Key on the live entity (`current`), which is the raw entity document. */
  key: string;
  labelKey: string;
  /**
   * Other names the same field may arrive under in `changes`. The diff keys off whatever
   * `requestData` used, which does not always match the stored document's casing/name.
   */
  aliases?: string[];
  rtl?: boolean;
  multiline?: boolean;
}

interface SectionDef {
  key: string;
  titleKey: string;
  icon: string;
  fields: FieldDef[];
}

const L = 'requestCenter.detail.field.';

/**
 * The offer form's layout, in display order. Keys are the offer document's own field names
 * (`current` is the raw doc), with `aliases` covering the payload spellings the diff reports.
 */
const OFFER_SECTIONS: SectionDef[] = [
  {
    key: 'basicInformation',
    titleKey: 'requestCenter.detail.section.basicInformation',
    icon: 'pi pi-info-circle',
    fields: [
      { key: 'title', labelKey: L + 'offerTitle' },
      { key: 'title_ar', labelKey: L + 'offerTitleAr', rtl: true },
      { key: 'description', labelKey: L + 'descriptionEn', multiline: true },
      { key: 'description_ar', labelKey: L + 'descriptionAr', rtl: true, multiline: true },
      { key: 'startDate', labelKey: L + 'startDate' },
      { key: 'expiryDate', labelKey: L + 'expiryDate' },
      { key: 'categories', labelKey: L + 'category', aliases: ['categoryIds', 'categoryId'] },
      { key: 'tags', labelKey: L + 'tags' },
    ],
  },
  {
    key: 'discountDetails',
    titleKey: 'requestCenter.detail.section.discountDetails',
    icon: 'pi pi-tag',
    fields: [
      { key: 'discountType', labelKey: L + 'discountType' },
      { key: 'Discount_amount', labelKey: L + 'discountAmount', aliases: ['discount_amount'] },
      { key: 'Discount_amount_ar', labelKey: L + 'discountAmountAr', aliases: ['discount_amount_ar'], rtl: true },
      { key: 'discountCode', labelKey: L + 'discountCode' },
      { key: 'discount_url', labelKey: L + 'discountUrl' },
      { key: 'targetAudience', labelKey: L + 'audience' },
      { key: 'howToAvail', labelKey: L + 'instructionsEn', multiline: true },
      { key: 'howToAvail_ar', labelKey: L + 'instructionsAr', rtl: true, multiline: true },
    ],
  },
  {
    key: 'offerSettings',
    titleKey: 'requestCenter.detail.section.offerSettings',
    icon: 'pi pi-cog',
    fields: [
      { key: 'offerMode', labelKey: L + 'offerType' },
      { key: 'website', labelKey: L + 'website' },
      { key: 'locationIds', labelKey: L + 'locations' },
    ],
  },
  {
    key: 'branding',
    titleKey: 'requestCenter.detail.section.branding',
    icon: 'pi pi-palette',
    fields: [
      { key: 'image', labelKey: L + 'offerImage' },
      { key: 'image_landscape', labelKey: L + 'offerImageLandscape' },
      { key: 'isHighlightEnabled', labelKey: L + 'highlightEnabled' },
      { key: 'highlight_title', labelKey: L + 'highlightTitle' },
      { key: 'highlight_title_ar', labelKey: L + 'highlightTitleAr', rtl: true },
      { key: 'highlight_description', labelKey: L + 'highlightDescription', multiline: true },
      { key: 'highlight_description_ar', labelKey: L + 'highlightDescriptionAr', rtl: true, multiline: true },
    ],
  },
  {
    key: 'contactInformation',
    titleKey: 'requestCenter.detail.section.contactInformation',
    icon: 'pi pi-id-card',
    fields: [
      { key: 'mobile', labelKey: L + 'phone' },
      { key: 'telephone', labelKey: L + 'landline' },
      { key: 'email', labelKey: L + 'email' },
    ],
  },
];

/** PROFILE requests render the vendor document instead. */
const PROFILE_SECTIONS: SectionDef[] = [
  {
    key: 'basicInformation',
    titleKey: 'requestCenter.detail.section.basicInformation',
    icon: 'pi pi-info-circle',
    fields: [
      { key: 'name', labelKey: L + 'vendorName' },
      { key: 'name_ar', labelKey: L + 'vendorNameAr', rtl: true },
      { key: 'crn_no', labelKey: L + 'crNumber' },
      { key: 'description', labelKey: L + 'descriptionEn', multiline: true },
      { key: 'description_ar', labelKey: L + 'descriptionAr', rtl: true, multiline: true },
    ],
  },
  {
    key: 'contactInformation',
    titleKey: 'requestCenter.detail.section.contactInformation',
    icon: 'pi pi-id-card',
    fields: [
      { key: 'mobile', labelKey: L + 'phone' },
      { key: 'email', labelKey: L + 'email' },
      { key: 'website', labelKey: L + 'website' },
      { key: 'smeName', labelKey: L + 'repName' },
      { key: 'smePhone', labelKey: L + 'repPhone' },
      { key: 'smeEmail', labelKey: L + 'repEmail' },
    ],
  },
  {
    key: 'branding',
    titleKey: 'requestCenter.detail.section.branding',
    icon: 'pi pi-palette',
    fields: [
      { key: 'logo', labelKey: L + 'logo' },
      { key: 'coverImage', labelKey: L + 'coverImage' },
      { key: 'coverImageLandscape', labelKey: L + 'coverImageLandscape' },
      { key: 'socialLinks', labelKey: L + 'socialLinks' },
    ],
  },
];

const OFFER_MODE_LABELS: Record<string, string> = {
  'in store': 'In-Store',
  online: 'Digital',
  both: 'In-Store & Digital',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

/** Renders a raw entity/diff value as display text. Returns '' for anything genuinely empty. */
export function formatChangeValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    return value.map((item) => formatChangeValue(item, field)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    // Embedded entities (categories, social links) and Mongo/Firestore wrappers all have a
    // single meaningful field — show that rather than raw JSON.
    for (const key of ['name', 'url', '$date', '$oid']) {
      if (record[key] !== undefined) return formatChangeValue(record[key], field);
    }
    return JSON.stringify(value);
  }

  const text = String(value);

  if (field === 'offerMode') {
    return OFFER_MODE_LABELS[text.toLowerCase()] ?? text;
  }

  if (ISO_DATE.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  return text;
}

function sectionsFor(entityType: string | undefined): SectionDef[] {
  return entityType === 'PROFILE' ? PROFILE_SECTIONS : OFFER_SECTIONS;
}

/**
 * Builds the read-only view of a request: every field of the entity, showing the value it
 * would have if the request is approved, with the ones this request edits flagged.
 *
 * The proposed value is `current` overridden by the change's `newValue` — the same merge the
 * backend describes for RequestPreviewDto.proposed. Fields the request did not touch simply
 * show their live value, which is what makes the full form render rather than a bare diff.
 */
export function buildRequestView(details: RequestDetailsResponse | null): RequestViewSection[] {
  if (!details) return [];

  const current = (details.current ?? {}) as Record<string, unknown>;
  const changes = details.changes ?? [];
  // What the request itself proposes. For a CREATE request this is the *only* source of data:
  // `current` is null (the entity does not exist yet) and `changes` is empty (the backend only
  // diffs UPDATE requests), so reading those alone renders a blank form.
  const requestData = (details.requestData ?? {}) as Record<string, unknown>;

  // Index the diff by every name a field might arrive under.
  const changeByField = new Map<string, RequestChangeResponse>();
  for (const change of changes) {
    if (change?.field) changeByField.set(change.field.toLowerCase(), change);
  }

  const consumed = new Set<string>();
  const consumedData = new Set<string>();

  const sections = sectionsFor(details.entityType).map((section) => {
    const fields: RequestViewField[] = section.fields.map((def) => {
      const names = [def.key, ...(def.aliases ?? [])];
      const change = names.map((n) => changeByField.get(n.toLowerCase())).find(Boolean);
      if (change) consumed.add(change.field.toLowerCase());

      // Proposed value, in priority order: this request's diff → what the request submitted →
      // the live entity. requestData is checked under every alias because it is keyed by the
      // payload's field names, which don't always match the stored document's.
      const proposedName = names.find((name) => requestData[name] !== undefined);
      if (proposedName) consumedData.add(proposedName);

      const rawValue = change
        ? change.newValue
        : proposedName !== undefined
          ? requestData[proposedName]
          : current[def.key];

      return {
        key: def.key,
        labelKey: def.labelKey,
        value: formatChangeValue(rawValue, def.key),
        edited: !!change,
        rtl: def.rtl ?? false,
        multiline: def.multiline ?? false,
      };
    });

    return {
      key: section.key,
      titleKey: section.titleKey,
      icon: section.icon,
      fields,
      edited: fields.some((field) => field.edited),
    };
  });

  // Anything the request carries that no section claims still has to surface — a field the UI
  // doesn't know about must never be silently dropped from the review.
  const extraFields: RequestViewField[] = changes
    .filter((change) => !consumed.has(change.field?.toLowerCase() ?? ''))
    .map((change) => ({
      key: change.field,
      labelKey: change.field,
      value: formatChangeValue(change.newValue, change.field),
      edited: true,
      rtl: false,
      multiline: false,
    }));

  for (const [key, value] of Object.entries(requestData)) {
    if (consumedData.has(key) || changeByField.has(key.toLowerCase())) continue;
    extraFields.push({
      key,
      labelKey: key,
      value: formatChangeValue(value, key),
      edited: false,
      rtl: false,
      multiline: false,
    });
  }

  if (extraFields.length) {
    sections.push({
      key: 'other',
      titleKey: 'requestCenter.detail.section.otherChanges',
      icon: 'pi pi-pencil',
      fields: extraFields,
      edited: extraFields.some((field) => field.edited),
    });
  }

  return sections;
}
