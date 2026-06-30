import { NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  forwardRef,
  inject,
  input,
  OnDestroy,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { createConnectedOverlay } from '../../internal/overlay';
import { createListKeyManager } from '../../internal/key-manager';
import { FORM_FIELD_BASE } from '../../tokens/form-field';
import { CONTROL_PADDING } from '../../tokens/size';

/** Edge-aligned (not centered) drop positions: below the trigger, flipping up. */
const SELECT_POSITIONS: ConnectedPosition[] = [
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 4
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -4
  }
];

/** Lightweight `ListKeyManager` descriptor — one per option, no DOM/component. */
interface OptionKey {
  disabled: boolean;
  getLabel(): string;
}

let nextId = 0;

/**
 * A single-select dropdown. `ControlValueAccessor` whose value is the
 * **`optionValue` primitive** (string/number), or the whole option when
 * `optionValue` is unset. Options are matched by **strict `===` on that
 * resolved value — never a structural compare** (a call site binds a numeric
 * index specifically to dodge deep-equals on a PixiJS `Project`).
 *
 * The trigger is a `role="combobox"` button skinned like the other form fields;
 * the panel is a `role="listbox"` `cdk/overlay`, with keyboard navigation
 * (arrows / Home / End / type-ahead) via the shared `ListKeyManager` and the
 * active-descendant pattern (focus stays on the trigger). Two optional content
 * slots: `#selectedItem` (closed trigger) and `#item` (each row), each with the
 * option as `$implicit`.
 */
@Component({
  selector: 'lg-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { class: 'inline-flex', '[class.w-full]': 'fluid()' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgSelect),
      multi: true
    }
  ],
  template: `
    <button
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      [id]="inputId() ?? null"
      [attr.aria-expanded]="opened()"
      [attr.aria-controls]="opened() ? listId : null"
      [attr.aria-activedescendant]="
        opened() && activeIndex() >= 0 ? optionId(activeIndex()) : null
      "
      [attr.aria-label]="ariaLabel() ?? null"
      [disabled]="isDisabled()"
      [class]="triggerClasses"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
      (keyup.space)="$event.preventDefault()"
      (blur)="onTouched()"
    >
      <span class="flex flex-1 items-center gap-2 text-left">
        @if (selectedItemTemplate(); as tpl) {
          @if (selectedOption(); as opt) {
            <ng-container
              *ngTemplateOutlet="tpl; context: { $implicit: opt }"
            ></ng-container>
          }
        } @else {
          @if (selectedIcon(); as ic) {
            <i [class]="ic" aria-hidden="true"></i>
          }
          <span class="truncate">{{ selectedLabel() }}</span>
        }
      </span>
      <i
        class="ph ph-caret-down ml-2 transition-transform duration-200"
        [class.rotate-180]="opened()"
        aria-hidden="true"
      ></i>
    </button>

    <ng-template #panel>
      <div
        role="listbox"
        [id]="listId"
        class="max-h-60 w-full overflow-auto rounded-md border border-border bg-content p-1 shadow-md"
      >
        @for (option of options(); track $index; let i = $index) {
          <button
            type="button"
            role="option"
            tabindex="-1"
            [id]="optionId(i)"
            [attr.aria-selected]="isSelected(option)"
            [class]="optionClasses(i, isSelected(option))"
            (click)="selectOption(option)"
            (mouseenter)="activeIndex.set(i)"
          >
            @if (itemTemplate(); as tpl) {
              <ng-container
                *ngTemplateOutlet="tpl; context: { $implicit: option }"
              ></ng-container>
            } @else {
              @if (iconOf(option); as ic) {
                <i [class]="ic" aria-hidden="true"></i>
              }
              {{ label(option) }}
            }
          </button>
        }
      </div>
    </ng-template>
  `
})
export class LgSelect implements ControlValueAccessor, OnDestroy {
  readonly options = input<readonly unknown[]>([]);
  readonly optionLabel = input<string>();
  readonly optionValue = input<string>();
  readonly optionIcon = input<string>();
  readonly inputId = input<string>();
  readonly ariaLabel = input<string>();
  readonly fluid = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly selectedItemTemplate =
    contentChild<TemplateRef<unknown>>('selectedItem');
  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private readonly uid = ++nextId;
  protected readonly listId = `lg-select-list-${this.uid}`;

  protected readonly value = signal<unknown>(undefined);
  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(
    () => this.disabled() || this.cvaDisabled()
  );

  protected readonly opened = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly triggerClasses = [
    FORM_FIELD_BASE,
    CONTROL_PADDING,
    'inline-flex w-full cursor-pointer select-none items-center text-left'
  ].join(' ');

  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;
  private keyManager: ReturnType<
    typeof createListKeyManager<OptionKey>
  > | null = null;

  private onChange: (value: unknown) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected readonly selectedOption = computed(
    () =>
      this.options().find((o) => this.optionValueOf(o) === this.value()) ?? null
  );
  protected readonly selectedLabel = computed(() => {
    const option = this.selectedOption();
    return option === null ? '' : this.label(option);
  });
  protected readonly selectedIcon = computed(() => {
    const option = this.selectedOption();
    return option === null ? undefined : this.iconOf(option);
  });

  protected optionId(index: number): string {
    return `lg-select-${this.uid}-opt-${index}`;
  }

  /**
   * Per-option classes. The selected row gets a primary-tinted highlight
   * (Aura's `highlight`: primary-100/primary-800 in light, a translucent
   * primary wash in dark); the keyboard/hover-active row that is *not* selected
   * gets the neutral content-hover surface.
   */
  protected optionClasses(index: number, selected: boolean): string {
    return [
      'flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left',
      selected
        ? 'bg-primary-100 text-primary-800 dark:bg-primary/24 dark:text-text'
        : index === this.activeIndex()
          ? 'bg-content-hover'
          : ''
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected optionValueOf(option: unknown): unknown {
    const key = this.optionValue();
    return key ? (option as Record<string, unknown>)[key] : option;
  }

  protected label(option: unknown): string {
    const key = this.optionLabel();
    const raw = key
      ? (option as Record<string, unknown>)[key]
      : this.optionValueOf(option);
    return raw == null ? '' : String(raw);
  }

  /** The option's icon class (`optionIcon` field), or undefined for none. */
  protected iconOf(option: unknown): string | undefined {
    const key = this.optionIcon();
    const raw = key ? (option as Record<string, unknown>)[key] : undefined;
    return typeof raw === 'string' && raw !== '' ? raw : undefined;
  }

  protected isSelected(option: unknown): boolean {
    return this.optionValueOf(option) === this.value();
  }

  protected toggle(): void {
    if (this.opened()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected selectOption(option: unknown): void {
    this.value.set(this.optionValueOf(option));
    this.onChange(this.value());
    this.onTouched();
    this.close();
    this.focusTrigger();
  }

  // Enter/Space are handled here (open / navigate / select). A native button
  // also synthesises a click from Space on *keyup*, which keydown's
  // preventDefault can't cancel — the template's `(keyup.space)` does, so the
  // synthesised click never re-toggles the panel.
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }
    if (!this.opened()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        this.focusTrigger();
        return;
      case 'Tab':
        this.close();
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const option = this.options()[this.activeIndex()];
        if (option !== undefined) {
          this.selectOption(option);
        }
        return;
      }
      default:
        this.keyManager?.onKeydown(event);
    }
  }

  private open(): void {
    if (this.opened() || this.isDisabled() || this.options().length === 0) {
      return;
    }
    this.buildKeyManager();
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin: this.host,
      positions: SELECT_POSITIONS,
      hasBackdrop: true
    });
    this.overlayRef.updateSize({
      minWidth: this.host.nativeElement.offsetWidth
    });
    this.overlayRef.attach(
      new TemplatePortal(this.panel(), this.viewContainerRef)
    );
    this.opened.set(true);

    this.subscriptions = new Subscription();
    this.subscriptions.add(
      this.overlayRef.backdropClick().subscribe(() => this.close())
    );
  }

  private close(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.keyManager?.destroy();
    this.keyManager = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.opened.set(false);
    this.activeIndex.set(-1);
  }

  private buildKeyManager(): void {
    const options = this.options();
    const keys: OptionKey[] = options.map((option) => ({
      disabled: false,
      getLabel: () => this.label(option)
    }));
    this.keyManager = createListKeyManager(keys, {
      wrap: true,
      homeAndEnd: true,
      typeAhead: true
    });
    this.keyManager.change.subscribe((index) => this.activeIndex.set(index));
    const selected = options.findIndex(
      (option) => this.optionValueOf(option) === this.value()
    );
    this.keyManager.setActiveItem(selected >= 0 ? selected : 0);
  }

  private focusTrigger(): void {
    this.host.nativeElement.querySelector('button')?.focus();
  }

  ngOnDestroy(): void {
    this.close();
  }

  writeValue(value: unknown): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
    if (isDisabled) {
      this.close();
    }
  }
}
