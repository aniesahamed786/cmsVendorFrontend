import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/** 1×1 transparent GIF — keeps the box without painting the broken-image glyph. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * The three states of an `<img>`, in one place (SKELETON.md item 9):
 *
 * | absent  | `src` null / empty / whitespace | placeholder, box reserved |
 * | loading | src set, no `load` yet          | `.app-skeleton` on the img |
 * | failed  | `(error)` fires                 | placeholder, box reserved  |
 *
 * Usage: `<img appImgFallback [src]="offer.logo" class="…">`. The directive owns
 * `src` — that is what lets it swap in the placeholder without the caller
 * branching in the template.
 */
@Directive({
  selector: 'img[appImgFallback]',
  host: {
    '(load)': 'onLoad()',
    '(error)': 'onError()',
  },
})
export class ImgFallbackDirective {
  readonly src = input<string | null | undefined>();

  private readonly el: HTMLImageElement = inject(ElementRef).nativeElement;
  private failed = false;

  constructor() {
    effect(() => {
      const url = this.src()?.trim();
      this.failed = false;
      if (!url) {
        this.render('fallback');
        return;
      }
      this.el.src = url;
      // A cached image is already complete — its `load` fired before we listened.
      this.render(this.el.complete && this.el.naturalWidth > 0 ? 'ready' : 'loading');
    });
  }

  protected onLoad(): void {
    if (!this.failed) this.render('ready'); // ponytail: the BLANK swap loads too — ignore it
  }

  protected onError(): void {
    this.failed = true;
    this.render('fallback');
  }

  private render(state: 'loading' | 'ready' | 'fallback'): void {
    this.el.classList.toggle('app-skeleton', state === 'loading');
    this.el.classList.toggle('app-img-fallback', state === 'fallback');
    if (state === 'fallback') this.el.src = BLANK;
  }
}
