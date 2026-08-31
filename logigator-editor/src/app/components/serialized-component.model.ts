import { ComponentType, Direction } from '@logigator/core';

export interface SerializedComponent {
  id: number;

  type: ComponentType;

  pos: [number, number];

  /** Quarter-turns clockwise from East. Omitted when East. */
  direction?: Direction;

  options: Record<string, unknown>;

  /** 0-based within the input group. Omitted when empty. */
  negInputs?: number[];

  /** 0-based within the output group. Omitted when empty. */
  negOutputs?: number[];
}
