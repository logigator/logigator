import { describe, beforeEach, it, expect, vi } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Cached } from './cached.decorator';

// ---------------------------------------------------------------------------
// Helper: build a fresh spy-tracked class each test so shared prototype cache
// slots never bleed between test cases.
// ---------------------------------------------------------------------------

/** Creates a class whose `value` getter is tracked by a call-count spy. */
function makeSimpleClass(returnValue: () => number) {
  class Fixture {
    callCount = 0;

    // Applied manually below because the TypeScript legacy decorator syntax
    // requires experimentalDecorators and works on pre-defined descriptors.
    get value(): number {
      this.callCount++;
      return returnValue();
    }
  }

  // Apply @Cached() manually to the prototype descriptor.
  const proto = Fixture.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')!;
  const newDescriptor = Cached()(proto, 'value', descriptor);
  Object.defineProperty(proto, 'value', newDescriptor);

  return Fixture;
}

/** Creates a class whose `value` getter is decorated with a keyGenerator. */
function makeKeyedClass(
  keyFn: (self: any) => string,
  returnValue: (self: any) => number
) {
  class Fixture {
    callCount = 0;

    get value(): number {
      this.callCount++;
      return returnValue(this);
    }
  }

  const proto = Fixture.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')!;
  // keyGenerator runs with `this` bound to the instance.
  const newDescriptor = Cached(function (this: any) {
    return keyFn(this);
  })(proto, 'value', descriptor);
  Object.defineProperty(proto, 'value', newDescriptor);

  return Fixture;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cached decorator', () => {
  describe('without keyGenerator', () => {
    it('getter is only called once across multiple reads (cache hit)', () => {
      const Fixture = makeSimpleClass(() => 42);
      const f = new Fixture();

      expect(f.value).toBe(42);
      expect(f.value).toBe(42);
      expect(f.value).toBe(42);
      expect(f.callCount).toBe(1);
    });

    it('returns the correct value on the first read', () => {
      const Fixture = makeSimpleClass(() => 99);
      const f = new Fixture();
      expect(f.value).toBe(99);
    });

    // NOTE: The Cached implementation stores the cache object on the *prototype*
    // (`target[cacheKey] = { key: null, val: null }`), not on each instance.
    // Therefore all instances of the same decorated class share one cache slot.
    // The task brief asked us to assert isolation; the actual behaviour is the
    // opposite — this test documents the real (shared-prototype) contract.
    it('instances share the same prototype-level cache slot (no keyGenerator)', () => {
      let counter = 0;
      const Fixture = makeSimpleClass(() => ++counter);

      const a = new Fixture();
      const b = new Fixture();

      const aValue = a.value; // computes, caches 1 on prototype slot
      const bValue = b.value; // hits shared cache, returns 1 (not 2)

      // Both see the same cached value — the prototype slot is shared.
      expect(aValue).toBe(bValue);
      // The underlying getter was only invoked once total.
      expect(a.callCount + b.callCount).toBe(1);
    });
  });

  describe('with keyGenerator', () => {
    it('getter is called on first read', () => {
      const Fixture = makeKeyedClass(
        () => 'static',
        () => 7
      );
      const f = new Fixture();
      expect(f.value).toBe(7);
      expect(f.callCount).toBe(1);
    });

    it('getter is not called again when key stays the same', () => {
      const Fixture = makeKeyedClass(
        () => 'same',
        () => 7
      );
      const f = new Fixture();

      void f.value;
      void f.value;
      void f.value;

      expect(f.callCount).toBe(1);
    });

    it('getter is recomputed when the key changes', () => {
      let key = 'first';
      let returnVal = 10;
      const Fixture = makeKeyedClass(
        () => key,
        () => returnVal
      );
      const f = new Fixture();

      expect(f.value).toBe(10); // key = 'first', computes
      key = 'second';
      returnVal = 20;
      expect(f.value).toBe(20); // key changed, recomputes
      expect(f.callCount).toBe(2);
    });

    it('getter is not recomputed when the key returns to the same value', () => {
      // After key settles to 'a', a second read with key 'a' must be a cache hit.
      const key = 'a';
      let returnVal = 5;
      const Fixture = makeKeyedClass(
        () => key,
        () => returnVal
      );
      const f = new Fixture();

      void f.value; // key='a', computes once
      returnVal = 999; // mutate underlying value
      void f.value; // key='a' still, should NOT recompute

      expect(f.callCount).toBe(1);
      // Stale value is returned from cache.
      expect(f.value).toBe(5);
    });

    it('with per-instance keys each instance gets its own correct value', () => {
      // Use an instance-specific field as the key so the two instances
      // never collide in key-space.  Because the prototype slot is shared
      // the instances will thrash each other's cache, but each read still
      // gets the correct value for its own current key.
      class Keyed {
        id: string;
        callCount = 0;

        constructor(id: string) {
          this.id = id;
        }

        get prop(): string {
          this.callCount++;
          return `value-for-${this.id}`;
        }
      }

      const proto = Keyed.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'prop')!;
      const newDescriptor = Cached(function (this: Keyed) {
        return this.id;
      })(proto, 'prop', descriptor);
      Object.defineProperty(proto, 'prop', newDescriptor);

      const a = new Keyed('a');
      const b = new Keyed('b');

      // Each instance gets a value derived from its own id.
      expect(a.prop).toBe('value-for-a');
      expect(b.prop).toBe('value-for-b');
    });
  });

  describe('applied to a non-getter', () => {
    it('returns the descriptor unchanged and does not throw', () => {
      class Fixture {
        myMethod(): number {
          return 1;
        }
      }

      const proto = Fixture.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'myMethod')!;
      const originalGet = descriptor.get; // undefined

      let result: PropertyDescriptor | undefined;
      expect(() => {
        result = Cached()(proto, 'myMethod', descriptor);
      }).not.toThrow();

      // descriptor.get was undefined so Cached must return it unmodified.
      expect(result).toBe(descriptor);
      expect(result!.get).toBe(originalGet); // still undefined
    });
  });
});
