/** One word a circuit stores: `value` at `address`. */
export interface RamWrite {
  address: number;
  value: bigint;
}

/**
 * Frames for a user input whose outputs drive a RAM's inputs in pin order —
 * address, data, WE, CLK — that store each word in turn: the address and the
 * data with WE high for a tick, then CLK rising, and every pin low again at
 * the end. The RAM samples its inputs a tick late, as every component does,
 * so each rising edge sees the address and data of the tick before. Plain
 * frames, so they go to the engine and the simulation service alike.
 */
export function ramWriteFrames(
  addressSize: number,
  wordSize: number,
  writes: readonly RamWrite[]
): { state: boolean[] }[] {
  const pins = (write: RamWrite | null, we: boolean, clk: boolean) => [
    ...Array.from({ length: addressSize }, (_, bit) =>
      write ? ((write.address >> bit) & 1) === 1 : false
    ),
    ...Array.from({ length: wordSize }, (_, bit) =>
      write ? ((write.value >> BigInt(bit)) & 1n) === 1n : false
    ),
    we,
    clk
  ];
  return [
    ...writes.flatMap((write) => [
      { state: pins(write, true, false) },
      { state: pins(write, true, true) }
    ]),
    { state: pins(null, false, false) }
  ];
}

/** Ticks after which every word {@link ramWriteFrames} sends is stored. */
export function ramWriteTicks(writes: number): number {
  return 2 * writes + 3;
}
