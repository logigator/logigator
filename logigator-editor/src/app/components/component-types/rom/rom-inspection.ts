import { signal, Signal } from '@angular/core';
import { TranslationService } from '../../../translation/translation.service';
import {
  base64ToBytes,
  packedByteLength,
  resizeBuffer
} from '../../../utils/packed-buffer';
import { getStaticDI } from '../../../utils/get-di';
import { ComponentInspection } from '../../component-inspection';
import { RomComponent } from './rom.component';
import { RomInspectionComponent } from './rom-inspection.component';

/**
 * Live view of a ROM during simulation. The contents are static and already on
 * the main thread, so the only live part is the addressed word, derived from
 * the address-input port power each frame. The engine addresses `Σ inᵢ << i`,
 * so input port `i` is address bit `i`.
 */
export class RomInspection extends ComponentInspection {
  public readonly kind = 'rom';
  public readonly renderer = RomInspectionComponent;
  public readonly title: Signal<string>;
  public override readonly sizing = {
    initial: { width: 560, height: 440 },
    min: { width: 400, height: 240 }
  };

  /** Frozen at open time; editing is locked during simulation. */
  public readonly wordSize: number;
  public readonly wordCount: number;
  /** The ROM image, sized to the full table. */
  public readonly bytes: Uint8Array;

  private readonly _address = signal(0);
  /** The currently addressed word index. */
  public readonly address = this._address.asReadonly();

  private readonly addressSize: number;

  constructor(private readonly component: RomComponent) {
    super();
    const options = component.options;
    this.wordSize = options.wordSize.value;
    this.addressSize = options.addressSize.value;
    this.wordCount = 1 << this.addressSize;
    this.bytes = resizeBuffer(
      base64ToBytes(options.data.value),
      packedByteLength(this.wordCount, this.wordSize)
    );

    this.title = signal(
      getStaticDI(TranslationService).translate('components.def.ROM.name')
    );
    this.onFrame();
  }

  /** Re-reads the address input's port power into {@link address}. */
  public override onFrame(): void {
    let address = 0;
    for (let bit = 0; bit < this.addressSize; bit++) {
      if (this.component.isPortPowered(bit)) {
        address |= 1 << bit;
      }
    }
    this._address.set(address);
  }
}
