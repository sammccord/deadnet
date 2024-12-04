import type { BebopRecord } from "bebop";
import type { CleanupFn, Context } from "./createEventIterator";

export type Writer<T> = (
  context: Context<T>,
) => void | CleanupFn | Promise<CleanupFn | void>;

export async function* createDuplexIterator<T>(
  outgoing: AsyncGenerator<BebopRecord, void, undefined>,
  emitter: (record: BebopRecord) => void,
  incoming: Writer<T>,
): AsyncGenerator<T> {
  const events: T[] = [];
  let cancelled = false;

  // Create a promise that resolves whenever a new event is added to the events array
  let resolveNext: (() => void) | null = null;

  const emit = (event: T) => {
    events.push(event);
    // If we are awaiting for a new event, resolve the promise
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  };

  const cancel = () => {
    cancelled = true;
    if (resolveNext) resolveNext()
  };

  const unsubscribe = await incoming({ emit, cancel });
  try {
    while (!cancelled) {
      const { value, done } = await outgoing.next()
      if (value && !done) {
        emitter(value)
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
        if (events.length > 0) {
          yield events.shift()!;
        }
      } else if (done) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
        if (events.length > 0) {
          yield events.shift()!;
        }
        break
      }
    }
    // Process any remaining events that were emitted before cancellation.
    while (events.length > 0) {
      yield events.shift()!;
    }
  } finally {
    await unsubscribe?.();
  }
}
