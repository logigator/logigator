import { signal, Signal } from '@angular/core';
import { ByteRange } from '../../component-inspection';
import {
  base64ToBytes,
  packedByteLength,
  resizeBuffer
} from '../../../utils/packed-buffer';
import { MemoryInspection } from '../../../inspection/memory/memory-inspection';
import { RomComponent } from './rom.component';

/**
 * Live view of a ROM during simulation. The contents are static and already on
 * the main thread, so the only live part is the addressed word.
 */
export class RomInspection extends MemoryInspection {
  public readonly kind = 'rom';
  /** The ROM image, sized to the full table. */
  public readonly bytes: Signal<Uint8Array>;
  public readonly loaded: Signal<ByteRange | null> = signal(null);

  constructor(component: RomComponent) {
    super(component, 'components.def.ROM.name');
    this.bytes = signal(
      resizeBuffer(
        base64ToBytes(component.options.data.value),
        packedByteLength(this.wordCount, this.wordSize)
      )
    );
  }
}
