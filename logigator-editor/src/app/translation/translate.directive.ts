import {
  Directive,
  inject,
  OnInit,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { TranslateFn } from './translate-function.model';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';
import { TranslationService } from './translation.service';

/** Template context {@link TranslateDirective} renders its content with. */
export interface TranslateContext {
  $implicit: TranslateFn;
}

/**
 * Hands its content a strictly typed `t`, making templates as key-safe as the
 * TypeScript that goes through {@link TranslationService}:
 * `<div *appTranslate="let t">{{ t('common.save') }}</div>`.
 *
 * It stands in for `*transloco`, whose `t` is untyped and cannot be typed from
 * the outside: transloco declares its context's `$implicit` as a *property* of
 * an unexported `(key: string) => any` type alias, so neither declaration
 * merging (aliases don't merge) nor a narrower `ngTemplateContextGuard` in a
 * subclass type-checks — a function-typed property is contravariant in its
 * parameters. Hence a context type of our own, unrelated to transloco's.
 *
 * Language switches need no re-render plumbing: `t` delegates to
 * {@link TranslationService.translate}, whose post-load signal read makes this
 * embedded view a reactive consumer, so its expressions re-run once the new
 * bundle has resolved. Where `*transloco` destroyed and recreated the view, the
 * bindings now update in place.
 */
@Directive({
  selector: '[appTranslate]'
})
export class TranslateDirective implements OnInit {
  private readonly translation = inject(TranslationService);
  private readonly templateRef =
    inject<TemplateRef<TranslateContext>>(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);

  private readonly translate: TranslateFn = <T extends TranslationKey>(
    key: T,
    params?: Record<string, unknown>
  ): TranslationResult<T> => this.translation.translate(key, params);

  /** Tells the template type checker what `let t` is; never called at runtime. */
  public static ngTemplateContextGuard(
    directive: TranslateDirective,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown
  ): context is TranslateContext {
    return true;
  }

  public ngOnInit(): void {
    this.viewContainer.createEmbeddedView(this.templateRef, {
      $implicit: this.translate
    });
  }
}
