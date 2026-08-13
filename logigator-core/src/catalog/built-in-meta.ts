import { ComponentType } from '../model/component-type.enum';
import { ComponentMeta, widenMeta } from './component-meta';
import { andMeta } from './built-ins/and.meta';
import { buttonMeta } from './built-ins/button.meta';
import { clockMeta } from './built-ins/clock.meta';
import { dFfMeta } from './built-ins/d-ff.meta';
import { decoderMeta } from './built-ins/decoder.meta';
import { delayMeta } from './built-ins/delay.meta';
import { demuxMeta } from './built-ins/demux.meta';
import { encoderMeta } from './built-ins/encoder.meta';
import { fullAdderMeta } from './built-ins/full-adder.meta';
import { halfAdderMeta } from './built-ins/half-adder.meta';
import { inputMeta } from './built-ins/input.meta';
import { jkFfMeta } from './built-ins/jk-ff.meta';
import { ledMeta } from './built-ins/led.meta';
import { ledMatrixMeta } from './built-ins/led-matrix.meta';
import { muxMeta } from './built-ins/mux.meta';
import { notMeta } from './built-ins/not.meta';
import { orMeta } from './built-ins/or.meta';
import { outputMeta } from './built-ins/output.meta';
import { ramMeta } from './built-ins/ram.meta';
import { rngMeta } from './built-ins/rng.meta';
import { romMeta } from './built-ins/rom.meta';
import { segmentDisplayMeta } from './built-ins/segment-display.meta';
import { srFfMeta } from './built-ins/sr-ff.meta';
import { switchMeta } from './built-ins/switch.meta';
import { textMeta } from './built-ins/text.meta';
import { tunnelMeta } from './built-ins/tunnel.meta';
import { xorMeta } from './built-ins/xor.meta';

const ALL = [
  notMeta,
  andMeta,
  orMeta,
  xorMeta,
  delayMeta,
  clockMeta,
  textMeta,
  tunnelMeta,
  halfAdderMeta,
  fullAdderMeta,
  romMeta,
  dFfMeta,
  jkFfMeta,
  srFfMeta,
  rngMeta,
  ramMeta,
  decoderMeta,
  encoderMeta,
  muxMeta,
  demuxMeta,
  inputMeta,
  outputMeta,
  buttonMeta,
  switchMeta,
  ledMeta,
  segmentDisplayMeta,
  ledMatrixMeta
];

/**
 * Every built-in component type, in declaration order. The editor composes a
 * `ComponentConfig` per entry and the server reads them to check documents, so
 * a new built-in is added here once and both sides pick it up.
 */
export const BUILT_IN_META: readonly ComponentMeta[] = ALL.map(widenMeta);

const BY_TYPE: ReadonlyMap<ComponentType, ComponentMeta> = new Map(
  BUILT_IN_META.map((meta) => [meta.type, meta])
);

/** The meta for `type`, or `undefined` for a custom or unknown type id. */
export function builtInMeta(type: ComponentType): ComponentMeta | undefined {
  return BY_TYPE.get(type);
}
