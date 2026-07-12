import type { MockedObject } from 'vitest';
import { vi } from 'vitest';
import type { Action } from '../app/actions/action';

/** Minimal mocked Action with named do/undo spies. */
export function makeAction(): MockedObject<Action> {
  return {
    do: vi.fn().mockName('Action.do'),
    undo: vi.fn().mockName('Action.undo')
  } as unknown as MockedObject<Action>;
}
