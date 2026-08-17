import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCountUp } from './count-up';

afterEach(() => vi.unstubAllGlobals());

describe('createCountUp', () => {
  it('reaches the target and formats it', () => {
    // One synchronous frame far past the duration: t clamps to 1, loop ends.
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(9000), 0));

    const { animatedCount, animateTo } = createCountUp();
    animateTo('total', 1234);
    expect(animatedCount('total')).toBe('1,234');
  });

  it('jumps straight to the target under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('requestAnimationFrame', () => {
      throw new Error('must not animate under reduced motion');
    });

    const { animatedCount, animateTo } = createCountUp();
    animateTo('total', 42);
    expect(animatedCount('total')).toBe('42');
  });
});
