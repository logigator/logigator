import {
  BoardDescriptor,
  ENGINE_RECORDER_TYPE,
  ENGINE_USER_INPUT_TYPE
} from '../app/simulation/compiler/compiled-board.model';

const DATA_BITS = 8;

/** The recorder's unit in {@link recorderBoard}. */
export const RECORDER_UNIT = 1;

/**
 * A user input whose outputs drive every input of a recorder keeping
 * `capacity` records: eight data bits, then the trigger.
 */
export function recorderBoard(capacity: number): BoardDescriptor {
  const pins = Array.from({ length: DATA_BITS + 1 }, (_, pin) => pin);
  return {
    components: [
      { type: ENGINE_USER_INPUT_TYPE, inputs: [], outputs: pins },
      { type: ENGINE_RECORDER_TYPE, inputs: pins, outputs: [], capacity }
    ]
  };
}

/**
 * Frames for a user input whose outputs drive a recorder's inputs in pin
 * order that record each byte in turn: the byte and the trigger rising in one
 * frame, which the recorder samples on the tick the edge rises, then the
 * trigger low. Two ticks per byte.
 */
export function byteFrames(codes: readonly number[]): { state: boolean[] }[] {
  const pins = (code: number, trigger: boolean) => [
    ...Array.from({ length: DATA_BITS }, (_, bit) => ((code >> bit) & 1) === 1),
    trigger
  ];
  return codes.flatMap((code) => [
    { state: pins(code, true) },
    { state: pins(code, false) }
  ]);
}

/** Ticks after which every byte {@link byteFrames} sends is recorded. */
export function byteTicks(codes: number): number {
  return 2 * codes;
}
