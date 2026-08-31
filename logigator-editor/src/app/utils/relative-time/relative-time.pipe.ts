import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatRelativeTime } from './relative-time';
import { TranslationService } from '../../translation/translation.service';

/**
 * Formats an epoch-ms timestamp or `Date` as localized relative time; empty
 * string for nullish input. Pure, so it evaluates once per input change and
 * does not tick: pair it with a transient view, or re-key the input for a live
 * value.
 */
@Pipe({
  standalone: true,
  name: 'relativeTime'
})
export class RelativeTimePipe implements PipeTransform {
  private readonly translation = inject(TranslationService);

  public transform(value: number | Date | null | undefined): string {
    if (value === null || value === undefined) return '';
    const epochMs = value instanceof Date ? value.getTime() : value;
    return formatRelativeTime(epochMs, this.translation.getActiveLang());
  }
}
