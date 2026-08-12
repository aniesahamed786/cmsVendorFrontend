import { describe, expect, it } from 'vitest';
import en from '../../../../public/assets/i18n/en.json';
import ar from '../../../../public/assets/i18n/ar.json';

function flatten(obj: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as object, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

describe('translations', () => {
  const e = flatten(en);
  const a = flatten(ar);

  it('flattens nested keys to dotted paths', () => {
    expect(e['navbar.logout']).toBe('Logout');
  });

  // The failure this catches: a key added to en.json and forgotten in ar.json
  // renders the raw key string on the Arabic page, silently.
  it('has identical key sets in both languages', () => {
    expect(Object.keys(a).sort()).toEqual(Object.keys(e).sort());
  });

  // Format masks and codes, not copy — identical in both languages on purpose.
  const sameByDesign = new Set([
    'offerForm.placeholder.date',
    'offerForm.placeholder.currency',
    'offerForm.placeholder.email',
    'login.emailPlaceholder',
    'locationDialog.placeholder.mapLink',
  ]);

  it('has no untranslated Arabic values', () => {
    const same = Object.keys(e).filter(
      (k) => !sameByDesign.has(k) && e[k] === a[k] && /[a-z]{3}/i.test(e[k]),
    );
    expect(same).toEqual([]);
  });

  it('keeps {{param}} placeholders consistent across languages', () => {
    const params = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort();
    for (const k of Object.keys(e)) {
      expect(params(a[k]), k).toEqual(params(e[k]));
    }
  });
});
