import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { formatRelativeTime } from './relative-time';

/**
 * Formats an epoch-ms timestamp (or `Date`) as localized relative time in the
 * active language, e.g. "2 minutes ago"; empty string for nullish input. Pure:
 * it evaluates once per input change and does not tick, so pair it with a
 * transient view (a dialog) or re-key the input when a live value is needed.
 */
@Pipe({
  standalone: true,
  name: 'relativeTime'
})
export class RelativeTimePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  public transform(value: number | Date | null | undefined): string {
    if (value === null || value === undefined) return '';
    const epochMs = value instanceof Date ? value.getTime() : value;
    return formatRelativeTime(epochMs, this.transloco.getActiveLang());
  }
}
