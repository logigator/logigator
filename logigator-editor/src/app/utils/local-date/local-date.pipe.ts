import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatLocalDate } from './local-date';
import { TranslationService } from '../../translation/translation.service';

/**
 * Formats an ISO string, epoch ms or `Date` as a localized calendar date. Pure,
 * so a language change re-evaluates it only through the view re-rendering.
 */
@Pipe({
  standalone: true,
  name: 'localDate'
})
export class LocalDatePipe implements PipeTransform {
  private readonly translation = inject(TranslationService);

  public transform(value: string | number | Date): string {
    return formatLocalDate(value, this.translation.getActiveLang());
  }
}
