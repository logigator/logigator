import { signal, Signal, WritableSignal } from '@angular/core';
import { ByteRange, StateRoute, StateWatch } from '../../component-inspection';
import { MemoryInspection } from '../../../inspection/memory/memory-inspection';
import { SimulationService } from '../../../simulation/simulation.service';
import { getStaticDI } from '../../../utils/get-di';
import { packedByteLength } from '../../../utils/packed-buffer';
import { RamComponent } from './ram.component';

/**
 * Memories of at most this many bytes are read whole whenever a view shows
 * any of them. A screen of the widest words with its margin is about that
 * much already — a dozen rows of sixteen 64-bit words, and as many again on
 * either side — so reading a range would save nothing, and would cost a
 * round trip on every scroll.
 */
export const RAM_WHOLE_READ_BYTES = 4096;

/**
 * Live view of a RAM during simulation: its memory is the engine's, read
 * through the {@link StateRoute} it was opened with, and only where the view
 * shows it. A memory of up to {@link RAM_WHOLE_READ_BYTES} is read whole;
 * a larger one is read over the rows on screen plus as many again on either
 * side, moved once the view leaves that range — a running CPU writes its RAM
 * every frame, and 512 KiB per frame is not what a dozen rows need. The
 * engine sends a range only when the RAM's state changed, so a paused or idle
 * RAM costs nothing.
 *
 * {@link loaded} is the range last read, current as of the last snapshot;
 * the view shows the rest as not loaded. A stop rebuilds the engine with the
 * memory all zero, which the view shows at once.
 */
export class RamInspection extends MemoryInspection {
  public readonly kind = 'ram';

  /** The memory as far as it was read; zero elsewhere. */
  private readonly memory: Uint8Array;
  private readonly _bytes: WritableSignal<Uint8Array>;
  /** The memory, a fresh view of the same bytes after every read. */
  public readonly bytes: Signal<Uint8Array>;
  private readonly _loaded = signal<ByteRange>({ start: 0, end: 0 });
  public readonly loaded = this._loaded.asReadonly();

  private readonly simulation = getStaticDI(SimulationService);
  private readonly watch: StateWatch | null;
  /** The range the watch reads; `null` while no view shows the memory. */
  private requested: ByteRange | null = null;
  private seenResets: number;

  constructor(component: RamComponent, state: StateRoute) {
    super(component, 'components.def.RAM.name');
    this.memory = new Uint8Array(
      packedByteLength(this.wordCount, this.wordSize)
    );
    this._bytes = signal(this.memory.subarray(0));
    this.bytes = this._bytes.asReadonly();
    this.seenResets = this.simulation.resets();
    this.watch = state.watch((offset, bytes) => this.onRead(offset, bytes));
  }

  public override showBytes(shown: ByteRange | null): void {
    const size = this.memory.length;
    let next: ByteRange | null;
    if (!shown || shown.end <= shown.start) {
      next = null;
    } else if (size <= RAM_WHOLE_READ_BYTES) {
      next = { start: 0, end: size };
    } else if (
      this.requested &&
      shown.start >= this.requested.start &&
      shown.end <= this.requested.end
    ) {
      return;
    } else {
      const span = shown.end - shown.start;
      next = {
        start: Math.max(0, shown.start - span),
        end: Math.min(size, shown.end + span)
      };
    }
    this.requested = next;
    this.watch?.setRange(next);
  }

  public override onFrame(): void {
    super.onFrame();
    const resets = this.simulation.resets();
    if (resets !== this.seenResets) {
      // The rebuilt engine's memory is all zero, and the range read stays
      // what it was: the engine sends it again only once it is written.
      this.seenResets = resets;
      this.memory.fill(0);
      this._bytes.set(this.memory.subarray(0));
    }
  }

  public override destroy(): void {
    this.watch?.close();
  }

  private onRead(offset: number, bytes: Uint8Array): void {
    this.memory.set(bytes, offset);
    this._bytes.set(this.memory.subarray(0));
    this._loaded.set({ start: offset, end: offset + bytes.length });
  }
}
