import { describe, expect, it } from 'vitest';
import en from '../../../../../../public/assets/i18n/en.json';
import ar from '../../../../../../public/assets/i18n/ar.json';
import {
  MOCK_HIGHLIGHT_OFFERS,
  MOCK_OFFER_STATUS_STATS,
} from '../../data/mock-analytics-overview';

// The template builds these tooltip keys at runtime —
// `'analytics.tooltip.status.' + card.id` — so a card id added to the mock data
// without a matching key renders the raw key string inside the bubble, silently.
// Everything else on this page uses literal keys, which the build already checks.
describe('analytics overview tooltips', () => {
  const dicts = { en, ar } as const;

  for (const [lang, dict] of Object.entries(dicts)) {
    const tips = (dict as typeof en).analytics.tooltip;

    it(`has a ${lang} tooltip for every status card`, () => {
      for (const card of MOCK_OFFER_STATUS_STATS) {
        expect(tips.status[card.id as keyof typeof tips.status], card.id).toBeTruthy();
      }
    });

    it(`has a ${lang} tooltip for every highlight offer`, () => {
      for (const offer of MOCK_HIGHLIGHT_OFFERS) {
        expect(tips.highlight[offer.id as keyof typeof tips.highlight], offer.id).toBeTruthy();
      }
    });
  }
});
