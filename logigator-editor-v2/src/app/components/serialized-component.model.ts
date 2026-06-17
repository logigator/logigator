import { ComponentType } from './component-type.enum';

export interface SerializedComponent {
  /** Component ID */
  id: number;

  /** Component type */
  type: ComponentType;

  /** Grid Position */
  pos: [number, number];

  /** Option values keyed by option name */
  options: Record<string, unknown>;

  /** Negated input-port indices (0-based within the input group). Omitted when empty. */
  negInputs?: number[];

  /** Negated output-port indices (0-based within the output group). Omitted when empty. */
  negOutputs?: number[];
}
