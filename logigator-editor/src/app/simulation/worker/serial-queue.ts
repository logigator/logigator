/**
 * Runs tasks one at a time, in the order they are given: each starts once the
 * one before it has settled, fulfilled or rejected. The returned promise is
 * the task's own outcome.
 */
export function createSerialQueue(): (
  task: () => Promise<void>
) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}
