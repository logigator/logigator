import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serial-queue';

describe('createSerialQueue', () => {
  it('starts a task only once the one before it has settled', async () => {
    const enqueue = createSerialQueue();
    const events: string[] = [];
    let finishFirst!: () => void;

    const first = enqueue(async () => {
      events.push('first started');
      await new Promise<void>((resolve) => (finishFirst = resolve));
      events.push('first ended');
    });
    const second = enqueue(async () => {
      events.push('second started');
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(['first started']);

    finishFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first started', 'first ended', 'second started']);
  });

  it('hands a rejection to its own caller and runs the tasks after it', async () => {
    const enqueue = createSerialQueue();
    let ran = false;

    const failing = enqueue(() => Promise.reject(new Error('refused')));
    const next = enqueue(async () => {
      ran = true;
    });

    await expect(failing).rejects.toThrow('refused');
    await next;
    expect(ran).toBe(true);
  });
});
