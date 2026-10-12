import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output
} from '@angular/core';
import {
  GAMEPAD_DEFAULT_LABELS,
  GamepadControlId,
  NameMap
} from '@logigator/core';
import { GamepadKeyCap } from '../../../../shortcuts/gamepad-bindings.service';
import { TranslationService } from '../../../../translation/translation.service';
import { dpadDirections, heldChanges } from './dpad-sectors';
import {
  dpadBox,
  PAD_BODY,
  PAD_DPAD_CROSS_PATH,
  PAD_VIEWBOX,
  PadBox,
  PadCaptionSlot,
  PadControlLayout,
  padLayout,
  PadPoint,
  shapeBox
} from './gamepad-pad-layout';

/**
 * What the controller is drawn for: `play` presses controls, `names` edits
 * each control's name in place of its caption, and `assign` draws the play
 * layout with nothing pressable.
 */
export type GamepadPadMode = 'play' | 'assign' | 'names';

/** One pointer starting or ending its hold on one control. */
export interface GamepadPadPointer {
  readonly control: GamepadControlId;
  readonly pointerId: number;
}

/** Every control's keycap, `null` for an unbound one. */
export type GamepadPadKeyCaps = Readonly<
  Record<GamepadControlId, GamepadKeyCap | null>
>;

const PRESSED_NONE: ReadonlySet<GamepadControlId> = new Set();

/** A percentage of the drawing's width or height, as a CSS length. */
function pctX(value: number): string {
  return `${(value / PAD_VIEWBOX.width) * 100}%`;
}
function pctY(value: number): string {
  return `${(value / PAD_VIEWBOX.height) * 100}%`;
}

/** Absolute placement of a box over the drawing. */
function boxStyle(box: PadBox): Record<string, string> {
  return {
    left: pctX(box.x),
    top: pctY(box.y),
    width: pctX(box.width),
    height: pctY(box.height)
  };
}

/** Absolute placement centred on a point. */
function pointStyle(point: PadPoint): Record<string, string> {
  return { left: pctX(point.x), top: pctY(point.y) };
}

const CAPTION_SHIFT: Record<PadCaptionSlot['align'], string> = {
  start: 'translate(0, -50%)',
  center: 'translate(-50%, -50%)',
  end: 'translate(-100%, -50%)'
};

/**
 * Absolute placement of a caption slot, anchored by its alignment so that
 * whatever is wider than the slot grows away from the control.
 */
function anchorStyle(slot: PadCaptionSlot): Record<string, string> {
  return {
    left: pctX(slot.x),
    top: pctY(slot.y),
    transform: CAPTION_SHIFT[slot.align]
  };
}

/** A caption's text, clipped to its slot. */
function captionStyle(slot: PadCaptionSlot): Record<string, string> {
  return {
    ...anchorStyle(slot),
    width: pctX(slot.width),
    'text-align': slot.align
  };
}

/** The button's corners following the shape it covers. */
function radiusStyle(layout: PadControlLayout, box: PadBox): string {
  const { shape } = layout;
  if (shape.kind === 'disc') return '50%';
  const grow = (box.width - shape.width) / 2;
  const r = shape.radius + grow;
  return `${(r / box.width) * 100}% / ${(r / box.height) * 100}%`;
}

/** One control as the template draws it. */
interface PadEntry {
  readonly layout: PadControlLayout;
  readonly control: GamepadControlId;
  readonly defaultName: string;
  readonly name: string;
  readonly ariaLabel: string;
  readonly nameLabel: string;
  readonly keyCap: GamepadKeyCap | null;
  readonly buttonStyle: Record<string, string>;
  readonly glyphStyle: Record<string, string>;
  readonly captionStyle: Record<string, string>;
  readonly inputStyle: Record<string, string>;
  readonly chipStyle: Record<string, string>;
  readonly isDpad: boolean;
}

const DPAD_CONTROLS: ReadonlySet<GamepadControlId> = new Set([
  'up',
  'down',
  'left',
  'right'
]);

/**
 * The controller as the DOM draws it, the only such drawing: the simulation
 * window plays it, and the names dialog edits names on it. It holds no
 * simulation state; what is pressed comes in through `pressed`, and what the
 * pointer does goes out through `controlDown` / `controlUp`.
 *
 * One SVG draws the fixed silhouette and the control shapes. Every control,
 * glyph, caption and keycap chip is an HTML element laid over it, placed in
 * percent from the same layout table the SVG draws from, so the two scale
 * together and cannot drift. The host sizes itself to the drawing's aspect
 * ratio from its width, and is an inline-size container, so glyphs and text scale
 * with it.
 *
 * In `play` each control is a `<button>` held by pointers through pointer
 * capture, one hold per pointer id, so several fingers hold several
 * controls. The D-pad is one hit region of eight sectors around its centre:
 * a diagonal holds two directions, and a moving pointer re-evaluates, rolling
 * from one direction to the next without lifting. In `names` the controls are
 * inert and each caption is an input, in port order in the DOM, so Tab walks
 * the controls in port order whatever the layout.
 */
@Component({
  selector: 'app-gamepad-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gamepad-pad.component.html',
  // Keycap chips name keyboard keys, which a touch-only device has none of.
  styles: `
    @media (hover: none) {
      .chip-touch {
        display: none;
      }
    }
  `,
  host: {
    class: 'relative block @container select-none',
    '[style.aspect-ratio]': 'aspectRatio',
    // A name input fits about four characters, and the focused one all of them.
    '[style.--slot-width]': 'inputWidth(4)',
    '[style.--full-width]': 'inputWidth(maxLength())',
    '(contextmenu)': '$event.preventDefault()'
  }
})
export class GamepadPadComponent {
  private readonly translation = inject(TranslationService);

  /** The pad's controls in port order. */
  public readonly controls = input.required<readonly GamepadControlId[]>();
  /** Custom names; edited in `names` mode. */
  public readonly names = model<NameMap>({});
  public readonly mode = input<GamepadPadMode>('play');
  /** The controls drawn as held down. */
  public readonly pressed = input<ReadonlySet<GamepadControlId>>(PRESSED_NONE);
  /** Each control's bound key, shown on a chip in `play`. */
  public readonly keyCaps = input<GamepadPadKeyCaps | null>(null);
  /** Whether keys reach this pad now; chips dim and the ring drops if not. */
  public readonly keyboardActive = input(true);
  /**
   * A keyboard is known to be at hand, so chips show even on a touch-only
   * device, where they are otherwise hidden.
   */
  public readonly keyboardPresent = input(false);
  /** Hit regions grown past the shapes, for fingers. */
  public readonly enlarged = input(false);
  /** The longest name an input takes in `names`. */
  public readonly maxLength = input(8);

  public readonly controlDown = output<GamepadPadPointer>();
  public readonly controlUp = output<GamepadPadPointer>();
  /** Enter in a name input. */
  public readonly save = output<void>();

  protected readonly viewBox = `0 0 ${PAD_VIEWBOX.width} ${PAD_VIEWBOX.height}`;
  protected readonly aspectRatio = `${PAD_VIEWBOX.width} / ${PAD_VIEWBOX.height}`;
  protected readonly body = PAD_BODY;
  protected readonly crossPath = PAD_DPAD_CROSS_PATH;

  protected readonly playing = computed(() => this.mode() === 'play');
  /** The accent outline that says keys reach the pad. */
  protected readonly ringed = computed(
    () => this.playing() && this.keyboardActive()
  );
  protected readonly editingNames = computed(() => this.mode() === 'names');
  protected readonly showChips = computed(() => this.mode() !== 'names');

  private readonly layout = computed(() => padLayout(this.controls()));

  protected readonly hasDpad = computed(() =>
    this.controls().some((control) => DPAD_CONTROLS.has(control))
  );

  protected readonly dpadStyle = computed(() =>
    boxStyle(
      dpadBox(this.layout().dpad, this.enlarged() ? this.layout().dpad.slop : 0)
    )
  );

  protected readonly entries = computed<readonly PadEntry[]>(() => {
    const names = this.names();
    const caps = this.keyCaps();
    const enlarged = this.enlarged();
    return this.layout().controls.map((layout) => {
      const control = layout.control;
      const defaultName = GAMEPAD_DEFAULT_LABELS[control];
      // The board's port label is terse (`SL`); what a screen reader says is
      // the control's spoken name.
      const spokenName = this.translation.translate(
        `components.def.GAMEPAD.controls.${control}` as const
      );
      const name = Object.hasOwn(names, control) ? names[control].trim() : '';
      const keyCap = caps?.[control] ?? null;
      const box = shapeBox(layout.shape, enlarged ? layout.slop : 0);
      return {
        layout,
        control,
        defaultName,
        name,
        ariaLabel: this.ariaLabel(spokenName, name, keyCap),
        nameLabel: this.translation.translate(
          'components.def.GAMEPAD.pad.nameFor',
          { control: spokenName }
        ),
        keyCap,
        buttonStyle: {
          ...boxStyle(box),
          'border-radius': radiusStyle(layout, box)
        },
        glyphStyle: {
          ...pointStyle(layout.glyphAt),
          transform: 'translate(-50%, -50%)',
          'font-size': `${(layout.glyphSize / PAD_VIEWBOX.width) * 100}cqw`
        },
        captionStyle: captionStyle(layout.caption),
        inputStyle: anchorStyle(layout.caption),
        chipStyle: pointStyle(layout.chip),
        isDpad: DPAD_CONTROLS.has(control)
      };
    });
  });

  /** The controls each live pointer holds, by pointer id. */
  private readonly held = new Map<number, readonly GamepadControlId[]>();

  protected glyphIcon(entry: PadEntry): string {
    const glyph = entry.layout.glyph;
    return glyph.kind === 'icon' ? glyph.icon : '';
  }

  /** An input's width for `chars` monospace characters, padding included. */
  protected inputWidth(chars: number): string {
    return `calc(${chars}ch + 0.5rem + 2px)`;
  }

  protected isPressed(control: GamepadControlId): boolean {
    return this.pressed().has(control);
  }

  protected onControlDown(
    event: PointerEvent,
    control: GamepadControlId
  ): void {
    if (!this.accepts(event)) return;
    this.capture(event);
    this.hold(event.pointerId, [control]);
  }

  protected onDpadDown(event: PointerEvent): void {
    if (!this.accepts(event)) return;
    this.capture(event);
    this.hold(event.pointerId, this.dpadAt(event));
  }

  protected onDpadMove(event: PointerEvent): void {
    if (!this.held.has(event.pointerId)) return;
    this.hold(event.pointerId, this.dpadAt(event));
  }

  /** pointerup, pointercancel or lostpointercapture: the pointer lets go. */
  protected onPointerEnd(event: PointerEvent): void {
    this.hold(event.pointerId, []);
  }

  protected onNameInput(control: GamepadControlId, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.names.set({ ...this.names(), [control]: value });
  }

  protected onNameKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    this.save.emit();
  }

  private accepts(event: PointerEvent): boolean {
    return (
      this.playing() &&
      !this.held.has(event.pointerId) &&
      (event.pointerType !== 'mouse' || event.button === 0)
    );
  }

  private capture(event: PointerEvent): void {
    const element = event.currentTarget as Element | null;
    element?.setPointerCapture?.(event.pointerId);
  }

  /**
   * Moves `pointerId`'s hold to `controls`, emitting only what changed. An
   * empty set ends the pointer's hold.
   */
  private hold(pointerId: number, controls: readonly GamepadControlId[]): void {
    const before = this.held.get(pointerId) ?? [];
    const { pressed, released } = heldChanges(before, controls);
    if (controls.length > 0) {
      this.held.set(pointerId, controls);
    } else {
      this.held.delete(pointerId);
    }
    for (const control of released) this.controlUp.emit({ control, pointerId });
    for (const control of pressed)
      this.controlDown.emit({ control, pointerId });
  }

  /** The D-pad directions under the pointer, from the region's own box. */
  private dpadAt(event: PointerEvent): readonly GamepadControlId[] {
    const region = event.currentTarget as Element | null;
    if (!region) return [];
    const box = region.getBoundingClientRect();
    const radius =
      (box.width / 2) *
      (this.layout().dpad.radius /
        (this.layout().dpad.radius +
          (this.enlarged() ? this.layout().dpad.slop : 0)));
    return dpadDirections(
      event.clientX - (box.left + box.width / 2),
      event.clientY - (box.top + box.height / 2),
      radius
    );
  }

  private ariaLabel(
    control: string,
    name: string,
    keyCap: GamepadKeyCap | null
  ): string {
    if (this.mode() === 'names') return control;
    const t = this.translation;
    if (keyCap === null) {
      return name
        ? t.translate('components.def.GAMEPAD.pad.namedUnboundControl', {
            name,
            control
          })
        : t.translate('components.def.GAMEPAD.pad.unboundControl', {
            control
          });
    }
    const key = keyCap.label;
    return name
      ? t.translate('components.def.GAMEPAD.pad.namedControl', {
          name,
          control,
          key
        })
      : t.translate('components.def.GAMEPAD.pad.control', { control, key });
  }
}
