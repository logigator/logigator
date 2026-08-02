import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatLocalDate } from './local-date';
import { TranslationService } from '../../translation/translation.service';

/**
 * Formats a timestamp (ISO string, epoch ms or `Date`) as a localized calendar
 * date in the active language, e.g. "Jul 22, 2026". Pure, like
 * {@link RelativeTimePipe}: the views using it re-render on a language change,
 * which is what re-evaluates it.
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
