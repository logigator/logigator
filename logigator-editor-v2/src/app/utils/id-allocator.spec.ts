import { IdAllocator } from './id-allocator';

describe('IdAllocator', () => {
	let allocator: IdAllocator;

	beforeEach(() => {
		allocator = new IdAllocator();
	});

	describe('next()', () => {
		it('returns 0 on the first call', () => {
			expect(allocator.next()).toBe(0);
		});

		it('returns 1 on the second call', () => {
			allocator.next();
			expect(allocator.next()).toBe(1);
		});

		it('returns incrementing sequential IDs', () => {
			expect(allocator.next()).toBe(0);
			expect(allocator.next()).toBe(1);
			expect(allocator.next()).toBe(2);
			expect(allocator.next()).toBe(3);
		});

		it('each new instance starts from 0 independently', () => {
			const a = new IdAllocator();
			const b = new IdAllocator();
			expect(a.next()).toBe(0);
			expect(b.next()).toBe(0);
			expect(a.next()).toBe(1);
			expect(b.next()).toBe(1);
		});
	});

	describe('bump()', () => {
		it('advances the counter so that next() returns id + 1 when id >= counter', () => {
			allocator.bump(5);
			expect(allocator.next()).toBe(6);
		});

		it('is a no-op when the given id is below the current counter', () => {
			allocator.next(); // counter = 1
			allocator.next(); // counter = 2
			allocator.next(); // counter = 3
			allocator.bump(1); // 1 < 3, no-op
			expect(allocator.next()).toBe(3);
		});

		it('is a no-op when the given id equals a value already passed', () => {
			allocator.next(); // returns 0, counter = 1
			allocator.bump(0); // 0 < 1, no-op
			expect(allocator.next()).toBe(1);
		});

		it('advances when given id equals current counter', () => {
			// counter starts at 0; bump(0) should advance because 0 >= 0
			allocator.bump(0);
			expect(allocator.next()).toBe(1);
		});

		it('advances when given id is greater than current counter', () => {
			allocator.bump(10);
			expect(allocator.next()).toBe(11);
		});

		it('next() after bump returns bumped value + 1 and then continues incrementing', () => {
			allocator.bump(7);
			expect(allocator.next()).toBe(8);
			expect(allocator.next()).toBe(9);
		});

		it('successive bumps only advance to the highest seen id', () => {
			allocator.bump(3);
			allocator.bump(10);
			allocator.bump(5); // lower than 10+1=11, no-op
			expect(allocator.next()).toBe(11);
		});

		it('bump on a lower id after next() calls is a no-op', () => {
			for (let i = 0; i < 5; i++) allocator.next(); // counter = 5
			allocator.bump(2); // 2 < 5, no-op
			expect(allocator.next()).toBe(5);
		});
	});
});
