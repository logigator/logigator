import {
  Directive,
  inject,
  OnInit,
  TemplateRef,
  ViewContainerRef
} from '@angular/core';
import { TranslateArgs } from './translate-args.model';
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
 * TypeScript going through {@link TranslationService}:
 * `<div *appTranslate="let t">{{ t('common.save') }}</div>`.
 *
 * Transloco's own `t` cannot be typed from the outside: its context declares
 * `$implicit` as a *property* of an unexported `(key: string) => any` alias, so
 * neither declaration merging nor a narrower `ngTemplateContextGuard` in a
 * subclass type-checks — a function-typed property is contravariant in its
 * parameters. Hence a context type of our own.
 *
 * Language switches need no re-render plumbing: `t` delegates to
 * {@link TranslationService.translate}, whose post-load signal read makes this
 * embedded view a reactive consumer, so bindings update in place.
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
    ...params: TranslateArgs<T>
  ): TranslationResult<T> => this.translation.translate(key, ...params);

  /** Tells the template type checker what `let t` is. */
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
