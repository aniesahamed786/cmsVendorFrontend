import { CreateOfferPayload } from './createOffer';
import { getChangedFields } from '../../../shared/utils/object-diff';

/**
 * Fields the vendor cannot change on an existing offer, so they never belong in an UPDATE
 * request's diff even if the mapper re-emits them with a different representation.
 */
const NON_EDITABLE_FIELDS = ['vendorId'];

/**
 * Returns only the fields that differ between the offer as it was loaded (`baseline`) and the
 * offer as it now stands (`current`). See `getChangedFields` for the comparison rules.
 */
export function getChangedOfferFields(
  baseline: Partial<CreateOfferPayload> | null | undefined,
  current: Partial<CreateOfferPayload>,
): Record<string, unknown> {
  return getChangedFields(baseline, current, { ignore: NON_EDITABLE_FIELDS });
}
