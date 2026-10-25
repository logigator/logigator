import { NO_LABELS } from '@logigator/core';
import { Component } from '../app/components/component';
import { ComponentConfigView } from '../app/components/component-config.model';
import { buttonComponentConfig } from '../app/components/component-types/button/button.config';
import {
  LevelUserInput,
  PulseUserInput,
  UserInputDrive,
  UserInputGesture
} from '../app/components/user-input';

/**
 * A user input with `inputSlots` slots, one output port each — the
 * multi-slot shape no built-in has — with a configurable `drive` and
 * `gesture` pair (a hold button's by default); the constructor accepts only
 * the pairs `UserInput` allows. Draws nothing beyond the standard frame.
 */
export class FakeUserInput
  extends Component
  implements Omit<LevelUserInput | PulseUserInput, 'drive' | 'gesture'>
{
  public readonly config: ComponentConfigView;
  public readonly drive: UserInputDrive;
  public readonly gesture: UserInputGesture;
  public readonly slotIds?: readonly string[];

  private readonly _active = new Set<number>();

  constructor(
    public readonly inputSlots: number,
    extra: (
      | { drive?: 'level'; gesture?: LevelUserInput['gesture'] }
      | { drive: 'pulse'; gesture: PulseUserInput['gesture'] }
    ) & {
      slotIds?: readonly string[];
      inspection?: ComponentConfigView['inspection'];
    } = {}
  ) {
    super(
      {
        ports: () => ({ inputs: 0, outputs: inputSlots }),
        labels: () => NO_LABELS,
        body: () => ({ width: 1, height: inputSlots })
      },
      {}
    );
    this.config = { ...buttonComponentConfig, inspection: extra.inspection };
    this.drive = extra.drive ?? 'level';
    this.gesture = extra.gesture ?? 'hold';
    this.slotIds = extra.slotIds;
  }

  public isActive(slot: number): boolean {
    return this._active.has(slot);
  }

  public setActive(slot: number, active: boolean): void {
    if (active) {
      this._active.add(slot);
    } else {
      this._active.delete(slot);
    }
  }

  public override clearSimState(): void {
    this._active.clear();
  }

  protected draw(): void {
    // Nothing of its own: only the ports matter.
  }
}
