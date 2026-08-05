/**
 * Deep value equality for form payloads. Handles the shapes the CMS forms produce:
 * primitives, `File`s (image uploads), `Date`s, arrays and plain nested objects.
 *
 * `null`, `undefined` and `''` all count as "empty" and compare equal, so an optional field
 * the API omits but the form models as an empty string is not reported as an edit.
 */
export function deepValueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) return aEmpty && bEmpty;

  // A newly picked image is always a change — File instances are never value-equal.
  if (a instanceof File || b instanceof File) return false;

  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(a as string).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(b as string).getTime();
    return at === bt;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepValueEquals(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepValueEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  return String(a) === String(b);
}

export interface ChangedFieldsOptions {
  /** Keys that must never appear in the diff (server-owned or non-editable). */
  ignore?: Iterable<string>;
  /**
   * Drop fields whose value is a `File`. Only for callers that serialize the diff as JSON —
   * a File would become `{}` and wipe the stored value. The request endpoints take
   * multipart/form-data and keep their Files, so they leave this off.
   */
  dropFiles?: boolean;
}

/**
 * Returns only the entries of `current` that differ from `baseline`.
 *
 * The request API stores just the changed fields in `requestData` (see RequestPreviewDto in
 * the backend), so an UPDATE request must carry a diff — sending the whole payload would make
 * every field look edited to the reviewing admin.
 */
export function getChangedFields<T extends Record<string, unknown>>(
  baseline: Partial<T> | null | undefined,
  current: Partial<T>,
  options: ChangedFieldsOptions = {},
): Record<string, unknown> {
  const ignore = new Set(options.ignore ?? []);
  const source = baseline ?? ({} as Partial<T>);

  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    if (ignore.has(key)) continue;

    const currentValue = (current as Record<string, unknown>)[key];
    if (options.dropFiles && currentValue instanceof File) continue;

    if (!deepValueEquals((source as Record<string, unknown>)[key], currentValue)) {
      changed[key] = currentValue;
    }
  }
  return changed;
}
