/* eslint-disable no-console */
import { Timed } from './timed.decorator';

describe('Timed decorator', () => {
	beforeEach(() => {
		spyOn(console, 'log');
	});

	describe('applied to a method', () => {
		it('decorated method still returns the correct value', () => {
			class Fixture {
				compute(x: number): number {
					return x * 2;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'compute')!;
			Object.defineProperty(proto, 'compute', Timed(proto, 'compute', descriptor));

			const f = new Fixture();
			expect(f.compute(21)).toBe(42);
		});

		it('console.log is called once per method invocation', () => {
			class Fixture {
				greet(): string {
					return 'hello';
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'greet')!;
			Object.defineProperty(proto, 'greet', Timed(proto, 'greet', descriptor));

			const f = new Fixture();
			f.greet();

			expect(console.log).toHaveBeenCalledTimes(1);
		});

		it('console.log message contains the property name', () => {
			class Fixture {
				myOperation(): void {
					// no-op
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'myOperation')!;
			Object.defineProperty(proto, 'myOperation', Timed(proto, 'myOperation', descriptor));

			new Fixture().myOperation();

			expect(console.log).toHaveBeenCalledWith(
				jasmine.any(String),
				'myOperation',
				jasmine.any(String)
			);
		});

		it('console.log is called once per call when invoked multiple times', () => {
			class Fixture {
				run(): number {
					return 1;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'run')!;
			Object.defineProperty(proto, 'run', Timed(proto, 'run', descriptor));

			const f = new Fixture();
			f.run();
			f.run();
			f.run();

			expect(console.log).toHaveBeenCalledTimes(3);
		});

		it('decorated method still executes its original logic', () => {
			let sideEffect = 0;

			class Fixture {
				increment(): void {
					sideEffect++;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'increment')!;
			Object.defineProperty(proto, 'increment', Timed(proto, 'increment', descriptor));

			new Fixture().increment();

			expect(sideEffect).toBe(1);
		});

		it('passes arguments through to the original method', () => {
			class Fixture {
				add(a: number, b: number): number {
					return a + b;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'add')!;
			Object.defineProperty(proto, 'add', Timed(proto, 'add', descriptor));

			expect(new Fixture().add(3, 4)).toBe(7);
		});

		it('preserves the `this` context inside the decorated method', () => {
			class Fixture {
				multiplier = 3;
				compute(x: number): number {
					return x * this.multiplier;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'compute')!;
			Object.defineProperty(proto, 'compute', Timed(proto, 'compute', descriptor));

			const f = new Fixture();
			expect(f.compute(7)).toBe(21);
		});
	});

	describe('applied to a getter', () => {
		it('decorated getter still returns the correct value', () => {
			class Fixture {
				// eslint-disable-next-line @typescript-eslint/class-literal-property-style
				get answer(): number {
					return 42;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'answer')!;
			Object.defineProperty(proto, 'answer', Timed(proto, 'answer', descriptor));

			expect(new Fixture().answer).toBe(42);
		});

		it('console.log is called once when the getter is read', () => {
			class Fixture {
				// eslint-disable-next-line @typescript-eslint/class-literal-property-style
				get label(): string {
					return 'test';
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'label')!;
			Object.defineProperty(proto, 'label', Timed(proto, 'label', descriptor));

			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			new Fixture().label;

			expect(console.log).toHaveBeenCalledTimes(1);
		});

		it('console.log message contains the getter property name', () => {
			class Fixture {
				// eslint-disable-next-line @typescript-eslint/class-literal-property-style
				get myProp(): number {
					return 0;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'myProp')!;
			Object.defineProperty(proto, 'myProp', Timed(proto, 'myProp', descriptor));

			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			new Fixture().myProp;

			expect(console.log).toHaveBeenCalledWith(
				jasmine.any(String),
				'myProp',
				jasmine.any(String)
			);
		});

		it('decorated getter executes its original logic', () => {
			let callCount = 0;

			class Fixture {
				get counter(): number {
					return ++callCount;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'counter')!;
			Object.defineProperty(proto, 'counter', Timed(proto, 'counter', descriptor));

			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			new Fixture().counter;

			expect(callCount).toBe(1);
		});
	});

	describe('applied to a setter', () => {
		it('decorated setter still executes the original setter logic', () => {
			let stored = 0;

			class Fixture {
				set value(v: number) {
					stored = v;
				}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')!;
			Object.defineProperty(proto, 'value', Timed(proto, 'value', descriptor));

			new Fixture().value = 42;

			expect(stored).toBe(42);
		});

		it('console.log is called when the setter is invoked', () => {
			class Fixture {
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				set label(_v: string) {}
			}

			const proto = Fixture.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'label')!;
			Object.defineProperty(proto, 'label', Timed(proto, 'label', descriptor));

			new Fixture().label = 'test';

			expect(console.log).toHaveBeenCalledTimes(1);
		});
	});
});
