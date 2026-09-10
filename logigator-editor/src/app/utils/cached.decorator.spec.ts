import { describe, expect, it } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Cached } from './cached.decorator';

// A fresh class per test, so shared prototype cache slots never bleed between
// cases.

/** Creates a class whose `value` getter is tracked by a call-count spy. */
function makeSimpleClass(returnValue: () => number) {
  class Fixture {
    callCount = 0;

    get value(): number {
      this.callCount++;
      return returnValue();
    }
  }

  // Applied manually: the legacy decorator syntax needs
  // experimentalDecorators and a pre-defined descriptor.
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
  const newDescriptor = Cached(function (this: any) {
    return keyFn(this);
  })(proto, 'value', descriptor);
  Object.defineProperty(proto, 'value', newDescriptor);

  return Fixture;
}

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

    // The cache object lives on the *prototype*, not per instance, so every
    // instance of a decorated class shares one slot.
    it('instances share the same prototype-level cache slot (no keyGenerator)', () => {
      let counter = 0;
      const Fixture = makeSimpleClass(() => ++counter);

      const a = new Fixture();
      const b = new Fixture();

      const aValue = a.value; // computes, caches 1 on prototype slot
      const bValue = b.value; // hits shared cache, returns 1 (not 2)

      // Both see the same cached value: the prototype slot is shared.
      expect(aValue).toBe(bValue);
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
      // A second read at the settled key must hit the cache.
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
      expect(f.value).toBe(5);
    });

    it('with per-instance keys each instance gets its own correct value', () => {
      // An instance-specific key keeps the two out of each other's key-space.
      // The shared prototype slot makes them thrash, but each read still gets
      // the right value for its own key.
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

      expect(result).toBe(descriptor);
      expect(result!.get).toBe(originalGet); // still undefined
    });
  });
});
