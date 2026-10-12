import { Container, Graphics } from 'pixi.js';
import {
  GAMEPAD_GLYPH_COLUMN_WIDTH,
  GamepadControlId,
  gamepadControls,
  GamepadGroup,
  gamepadGroups,
  GamepadGroupValues,
  gamepadMeta
} from '@logigator/core';
import { Component } from '../../component';
import { LevelUserInput } from '../../user-input';
import {
  GamepadControlFillGraphics,
  GamepadControlOutlineGraphics,
  GamepadGlyphShape,
  GamepadRuleGraphics
} from '../../../rendering/graphics/gamepad.graphics';
import { strokeScaleFor } from '../../../rendering/graphics/stroke-scale';
import { gamepadComponentConfig, GamepadOptions } from './gamepad.config';
import { GamepadNamesEditorComponent } from './gamepad-names-editor.component';

/** One control of a group's glyph, placed relative to the glyph's centre. */
interface ControlGlyph {
  readonly x: number;
  readonly y: number;
  readonly shape: GamepadGlyphShape;
}

const FACE_BUTTON: GamepadGlyphShape = { kind: 'disc', radius: 0.36 };
const SHOULDER_BAR_HEIGHT = 0.45;
const MENU_PILL: GamepadGlyphShape = {
  kind: 'rect',
  width: 0.8,
  height: 0.34,
  radius: 0.17
};

/**
 * Where each control of `group` sits, in control order. A group draws in a
 * square of side `min(rows, 3)` centred in its rows: the D-pad as a cross of
 * four arms, the face buttons as a diamond (X top, Y left, A right, B
 * bottom), a diagonal pair (B lower left, A upper right) or one centred disc,
 * and the shoulder and menu buttons one per row, level with their ports.
 */
function glyphLayout(group: GamepadGroup): ControlGlyph[] {
  const rows = group.end - group.start;
  const side = Math.min(rows, 3);
  switch (group.id) {
    case 'dpad': {
      const arm = (0.8 * side) / 3;
      const shape: GamepadGlyphShape = {
        kind: 'rect',
        width: arm,
        height: arm,
        radius: arm * 0.15
      };
      const at: Partial<Record<GamepadControlId, [number, number]>> = {
        up: [0, -arm],
        down: [0, arm],
        left: [-arm, 0],
        right: [arm, 0]
      };
      return group.controls.map((control) => {
        const [x, y] = at[control] ?? [0, 0];
        return { x, y, shape };
      });
    }
    case 'face': {
      const d = side / 3;
      const q = side / 4;
      const at: Partial<Record<GamepadControlId, [number, number]>> =
        group.controls.length === 4
          ? { a: [d, 0], b: [0, d], x: [0, -d], y: [-d, 0] }
          : group.controls.length === 2
            ? { a: [q, -q], b: [-q, q] }
            : {};
      return group.controls.map((control) => {
        const [x, y] = at[control] ?? [0, 0];
        return { x, y, shape: FACE_BUTTON };
      });
    }
    case 'shoulders':
    case 'menu': {
      const shape: GamepadGlyphShape =
        group.id === 'menu'
          ? MENU_PILL
          : {
              kind: 'rect',
              width: 0.8 * side,
              height: SHOULDER_BAR_HEIGHT,
              radius: SHOULDER_BAR_HEIGHT * 0.4
            };
      return group.controls.map((_, row) => ({
        x: 0,
        y: row - (rows - 1) / 2,
        shape
      }));
    }
  }
}

/**
 * A controller with one output per control, high while the control is held:
 * a {@link LevelUserInput} operated by `hold`, one slot per control in port
 * order. Its body is a strip: each group's glyph beside its own port rows,
 * thin rules between the groups, the port labels (custom names where set) in
 * the label column. A press shows on the board as the control's fill, an
 * alpha write on a pre-built layer.
 *
 * It has several slots, so a press on its body on a canvas operates none of
 * them (see `isCanvasOperatedInput`).
 */
export class GamepadComponent
  extends Component<GamepadOptions>
  implements LevelUserInput
{
  public readonly config = gamepadComponentConfig;
  public readonly drive = 'level';
  public readonly gesture = 'hold';

  // Bit `i` is slot `i`. The base constructor's initial draw runs before field
  // initializers, and an unassigned mask reads as all released.
  private _active = 0;

  // Each slot's fill, rebuilt by every draw(). Declared rather than
  // initialized: a class-field define would run after the base constructor's
  // first draw and drop the layers it built.
  declare private _fills: Graphics[];

  constructor(options: GamepadOptions) {
    super(gamepadMeta, options);

    // Which controls the pad has is the pad's knowledge; doing it here rather
    // than in the config keeps the link alive across every clone path.
    this.options.names
      .attachKeys(() => this.slotIds)
      .attachEditor(GamepadNamesEditorComponent);
  }

  public get inputSlots(): number {
    return this.numOutputs;
  }

  /** The control ids in port order. */
  public get slotIds(): readonly GamepadControlId[] {
    return gamepadControls(this._groupValues);
  }

  public isActive(slot: number): boolean {
    return (this._active & (1 << slot)) !== 0;
  }

  public setActive(slot: number, active: boolean): void {
    if (
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= this.inputSlots ||
      this.isActive(slot) === active
    ) {
      return;
    }
    this._active ^= 1 << slot;
    this._fills[slot].alpha = active ? 1 : 0;
  }

  public override clearSimState(): void {
    this._active = 0;
    for (const fill of this._fills) {
      fill.alpha = 0;
    }
  }

  private get _groupValues(): GamepadGroupValues {
    return {
      face: this.options.face.value,
      shoulders: this.options.shoulders.value,
      menu: this.options.menu.value
    };
  }

  protected draw(): void {
    const width = this.bodyGridWidth;
    this.addBody(width, this.bodyGridHeight);

    const fills: Graphics[] = [];
    for (const group of gamepadGroups(this._groupValues)) {
      if (group.start > 0) {
        const rule = this.addScaledGraphics((scale) =>
          this.geometryService.getGraphicsContext(
            GamepadRuleGraphics,
            width,
            scale
          )
        );
        rule.position.set(0, group.start);
      }

      // Upright whatever the direction, so "up" on the D-pad points up.
      const glyph = new Container();
      glyph.position.set(
        GAMEPAD_GLYPH_COLUMN_WIDTH / 2,
        (group.start + group.end) / 2
      );
      glyphLayout(group).forEach(({ x, y, shape }, i) => {
        const slot = group.start + i;
        const fill = new Graphics(
          this.geometryService.getGraphicsContext(
            GamepadControlFillGraphics,
            shape
          )
        );
        fill.position.set(x, y);
        fill.alpha = this.isActive(slot) ? 1 : 0;
        this.onApplyTheme(
          () => (fill.tint = this.themingService.currentTheme().wire)
        );
        fills[slot] = fill;

        const outline = new Graphics();
        outline.position.set(x, y);
        this.onApplyScale(
          (scale) =>
            (outline.context = this.geometryService.getGraphicsContext(
              GamepadControlOutlineGraphics,
              shape,
              strokeScaleFor(scale)
            ))
        );
        glyph.addChild(fill, outline);
      });
      this.registerRotationCounterContainer(glyph);
      this.addChild(glyph);
    }
    this._fills = fills;
  }
}
