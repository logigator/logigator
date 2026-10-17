import { signal, Signal } from '@angular/core';
import { Component } from '../../components/component';
import {
  ByteRange,
  ComponentInspection
} from '../../components/component-inspection';
import { ComponentOption } from '../../components/component-option';
import { NumberComponentOption } from '../../components/component-options/number/number.component-option';
import { TranslationService } from '../../translation/translation.service';
import { TranslationKey } from '../../translation/translation-key.model';
import { getStaticDI } from '../../utils/get-di';
import { MemoryInspectionComponent } from './memory-inspection.component';

/** The options every memory shares: its table's shape. */
export interface MemoryOptions {
  [key: string]: ComponentOption;
  wordSize: NumberComponentOption;
  addressSize: NumberComponentOption;
}

/**
 * Live view of a memory during simulation — a ROM or a RAM — in the hex
 * editor's read-only mode. Both hold `2^addressSize` words of `wordSize` bits
 * in the bit-packed layout of `utils/packed-buffer.ts`, and both address
 * `Σ inᵢ << i`, so input port `i` is address bit `i`: the addressed word is
 * derived from the address-input port power each frame. Where the contents
 * come from is the subclass's.
 */
export abstract class MemoryInspection extends ComponentInspection {
  public readonly renderer = MemoryInspectionComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 560, height: 440 },
    min: { width: 400, height: 240 }
  };

  /** Frozen at open time; editing is locked during simulation. */
  public readonly wordSize: number;
  public readonly wordCount: number;

  /** The contents, sized to the full table. */
  public abstract readonly bytes: Signal<Uint8Array>;
  /** The bytes of {@link bytes} that hold what they show; `null` for all. */
  public abstract readonly loaded: Signal<ByteRange | null>;

  private readonly _address = signal(0);
  /** The currently addressed word index. */
  public readonly address = this._address.asReadonly();

  private readonly addressSize: number;

  protected constructor(
    protected readonly component: Component<MemoryOptions>,
    titleKey: TranslationKey
  ) {
    super();
    const options = component.options;
    this.wordSize = options.wordSize.value;
    this.addressSize = options.addressSize.value;
    this.wordCount = 1 << this.addressSize;
    this.title = signal(getStaticDI(TranslationService).translate(titleKey));
    this.readAddress();
  }

  /**
   * The bytes the view has rendered, `null` once no view shows any — a
   * closed window, a sheet tab in the background. Absent where the contents
   * are all at hand.
   */
  public showBytes?(shown: ByteRange | null): void;

  /** Re-reads the address input's port power into {@link address}. */
  public override onFrame(): void {
    this.readAddress();
  }

  private readAddress(): void {
    let address = 0;
    for (let bit = 0; bit < this.addressSize; bit++) {
      if (this.component.isPortPowered(bit)) {
        address |= 1 << bit;
      }
    }
    this._address.set(address);
  }
}
