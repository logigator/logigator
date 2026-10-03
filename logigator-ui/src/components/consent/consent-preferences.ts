import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgButton } from '../button/button';
import { LgDialogContent } from '../dynamic-dialog/dialog-content';
import { LgToggleSwitch } from '../toggle-switch/toggle-switch';
import { LgConsentCopy, optionalCategoryIds } from './consent-copy';

/** What {@link LgConsentPreferences} opens with. */
export interface LgConsentPreferencesData {
  copy: LgConsentCopy;
  /** The categories granted so far; empty for a visitor who never decided. */
  granted: readonly string[];
}

let nextId = 0;

/**
 * The consent question category by category, opened through `DialogService`
 * with {@link LgConsentPreferencesData} and `copy.preferencesTitle` as its
 * header. It closes with the categories granted — required ones never among
 * them — or `undefined` when dismissed, which changes nothing.
 *
 * The three buttons are the banner's two answers plus the one only this dialog
 * can give, so the question has the same shape wherever it is answered.
 */
@Component({
  selector: 'lg-consent-preferences',
  imports: [FormsModule, LgButton, LgToggleSwitch],
  template: `
    <div class="flex flex-col gap-5">
      <p class="text-muted">
        {{ copy.preferencesText }}
        <a
          class="text-primary underline underline-offset-2 hover:text-primary-emphasis"
          target="_blank"
          rel="noopener"
          [href]="copy.privacyHref"
          >{{ copy.privacyLabel }}</a
        >
      </p>

      <ul
        class="flex flex-col divide-y divide-border rounded-lg border border-border"
      >
        @for (category of copy.categories; track category.id) {
          @let switchId = idPrefix + '-' + category.id;
          <li class="flex items-start gap-4 p-4">
            <div class="min-w-0 flex-1">
              <label [for]="switchId" class="font-medium text-text">{{
                category.title
              }}</label>
              <p
                [id]="switchId + '-description'"
                class="mt-1 text-sm text-muted"
              >
                {{ category.description }}
              </p>
            </div>
            <lg-toggle-switch
              class="mt-0.5"
              [inputId]="switchId"
              [describedBy]="switchId + '-description'"
              [ngModel]="category.required || isGranted(category.id)"
              [disabled]="!!category.required"
              (ngModelChange)="toggle(category.id, $event)"
            />
          </li>
        }
      </ul>

      <div class="flex flex-wrap justify-end gap-2">
        <button
          lgButton
          outlined
          severity="secondary"
          class="max-sm:flex-1"
          (onClick)="dialogRef.close([])"
        >
          {{ copy.rejectAll }}
        </button>
        <button
          lgButton
          outlined
          severity="secondary"
          class="max-sm:flex-1"
          (onClick)="dialogRef.close(granted())"
        >
          {{ copy.save }}
        </button>
        <button
          lgButton
          class="max-sm:basis-full"
          (onClick)="dialogRef.close(optional)"
        >
          {{ copy.acceptAll }}
        </button>
      </div>
    </div>
  `
})
export class LgConsentPreferences extends LgDialogContent<
  LgConsentPreferencesData,
  readonly string[]
> {
  protected readonly copy = this.dialogData!.copy;
  protected readonly optional = optionalCategoryIds(this.copy);
  protected readonly idPrefix = `lg-consent-${++nextId}`;

  private readonly selected = signal(
    new Set(this.dialogData!.granted.filter((id) => this.optional.includes(id)))
  );

  /** In the order the copy lists them, whatever order they were toggled in. */
  protected readonly granted = computed(() =>
    this.optional.filter((id) => this.selected().has(id))
  );

  protected isGranted(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string, on: boolean): void {
    this.selected.update((selected) => {
      const next = new Set(selected);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
