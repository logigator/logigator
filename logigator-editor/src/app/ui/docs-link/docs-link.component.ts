import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output
} from '@angular/core';
import { DocumentationService } from '../../documentation/documentation.service';
import { DocsTarget } from '../../documentation/docs-target';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * An inline "Learn more" link opening the documentation viewer at `target`.
 * A button, since it opens a dialog in place rather than navigating.
 */
@Component({
  selector: 'app-docs-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective],
  template: `
    <button
      *appTranslate="let t"
      type="button"
      class="rounded-sm text-sm text-primary outline-none hover:underline focus-visible:outline-2 focus-visible:outline-primary"
      [attr.aria-describedby]="describedBy()"
      (click)="open()"
    >
      {{ t('documentation.learnMore') }}
    </button>
  `
})
export class DocsLinkComponent {
  private readonly documentation = inject(DocumentationService);

  public readonly target = input.required<DocsTarget>();
  /** Id of the text the link is about, when "Learn more" alone is unclear. */
  public readonly describedBy = input<string | null>(null);

  /**
   * Fires before the viewer opens, for a surface that has to get out of its
   * way first, such as a popover that would otherwise stay on top of it.
   */
  public readonly opening = output<void>();

  protected open(): void {
    // Read first: a listener closing the surface may destroy this link.
    const { page, anchor } = this.target();
    this.opening.emit();
    this.documentation.open(page, anchor);
  }
}
