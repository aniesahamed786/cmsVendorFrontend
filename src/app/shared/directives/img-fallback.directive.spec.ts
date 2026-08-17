import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ImgFallbackDirective } from './img-fallback.directive';

@Component({
  imports: [ImgFallbackDirective],
  template: `<img appImgFallback [src]="url()" />`,
})
class Host {
  readonly url = signal<string | null>(null);
}

function mount() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, img: fixture.nativeElement.querySelector('img') as HTMLImageElement };
}

describe('ImgFallbackDirective', () => {
  it('shows the placeholder when there is no src', () => {
    const { img } = mount();
    expect(img.classList.contains('app-img-fallback')).toBe(true);
    expect(img.classList.contains('app-skeleton')).toBe(false);
  });

  it('skeletons while a src is in flight, then clears on load', () => {
    const { fixture, img } = mount();
    fixture.componentInstance.url.set('/assets/svg/shared/image-placeholder.svg');
    fixture.detectChanges();
    expect(img.classList.contains('app-skeleton')).toBe(true);

    img.dispatchEvent(new Event('load'));
    expect(img.classList.contains('app-skeleton')).toBe(false);
    expect(img.classList.contains('app-img-fallback')).toBe(false);
  });

  it('falls back when the image errors, and ignores the placeholder load', () => {
    const { fixture, img } = mount();
    fixture.componentInstance.url.set('/nope.png');
    fixture.detectChanges();

    img.dispatchEvent(new Event('error'));
    expect(img.classList.contains('app-img-fallback')).toBe(true);

    img.dispatchEvent(new Event('load')); // the blank swap loading
    expect(img.classList.contains('app-img-fallback')).toBe(true);
  });
});
