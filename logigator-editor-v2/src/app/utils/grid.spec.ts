import { Point } from 'pixi.js';
import { environment } from '../../environments/environment';
import { fromGrid, roundToGrid, roundToHalfGrid } from './grid';

describe('fromGrid', () => {
	it('returns 0 for input 0', () => {
		expect(fromGrid(0)).toBe(0);
	});

	it('converts 1 grid unit to environment.gridSize pixels', () => {
		expect(fromGrid(1)).toBe(environment.gridSize);
	});

	it('scales linearly for positive integers', () => {
		expect(fromGrid(3)).toBe(3 * environment.gridSize);
	});

	it('scales linearly for negative values', () => {
		expect(fromGrid(-2)).toBe(-2 * environment.gridSize);
	});

	it('handles fractional grid values', () => {
		expect(fromGrid(0.5)).toBeCloseTo(0.5 * environment.gridSize, 10);
	});
});

describe('roundToGrid', () => {
	describe('inline = false (default)', () => {
		it('returns a new Point instance', () => {
			const p = new Point(1.2, 3.7);
			const result = roundToGrid(p);
			expect(result).not.toBe(p);
		});

		it('rounds x and y to the nearest integer', () => {
			const result = roundToGrid(new Point(1.2, 3.7));
			expect(result.x).toBe(1);
			expect(result.y).toBe(4);
		});

		it('rounds down when fraction is below 0.5', () => {
			const result = roundToGrid(new Point(2.4, 5.4));
			expect(result.x).toBe(2);
			expect(result.y).toBe(5);
		});

		it('rounds up when fraction is exactly 0.5', () => {
			const result = roundToGrid(new Point(2.5, 3.5));
			expect(result.x).toBe(3);
			expect(result.y).toBe(4);
		});

		it('handles negative values', () => {
			const result = roundToGrid(new Point(-1.6, -2.4));
			expect(result.x).toBe(-2);
			expect(result.y).toBe(-2);
		});

		it('does not mutate the original point', () => {
			const p = new Point(1.7, 2.3);
			roundToGrid(p);
			expect(p.x).toBe(1.7);
			expect(p.y).toBe(2.3);
		});

		it('returns exact integers unchanged', () => {
			const result = roundToGrid(new Point(5, 10));
			expect(result.x).toBe(5);
			expect(result.y).toBe(10);
		});
	});

	describe('inline = true', () => {
		it('returns the same Point instance', () => {
			const p = new Point(1.2, 3.7);
			const result = roundToGrid(p, true);
			expect(result).toBe(p);
		});

		it('mutates x and y on the original point', () => {
			const p = new Point(1.2, 3.7);
			roundToGrid(p, true);
			expect(p.x).toBe(1);
			expect(p.y).toBe(4);
		});

		it('rounds up at exactly 0.5 boundary inline', () => {
			const p = new Point(2.5, 3.5);
			roundToGrid(p, true);
			expect(p.x).toBe(3);
			expect(p.y).toBe(4);
		});

		it('handles negative values inline', () => {
			const p = new Point(-1.6, -2.4);
			roundToGrid(p, true);
			expect(p.x).toBe(-2);
			expect(p.y).toBe(-2);
		});
	});
});

describe('roundToHalfGrid', () => {
	describe('inline = false (default)', () => {
		it('returns a new Point instance', () => {
			const p = new Point(1.2, 3.7);
			const result = roundToHalfGrid(p);
			expect(result).not.toBe(p);
		});

		it('maps a value to floor(n) + 0.5', () => {
			const result = roundToHalfGrid(new Point(1.2, 3.7));
			expect(result.x).toBe(1.5);
			expect(result.y).toBe(3.5);
		});

		it('maps an integer to itself + 0.5', () => {
			const result = roundToHalfGrid(new Point(2, 5));
			expect(result.x).toBe(2.5);
			expect(result.y).toBe(5.5);
		});

		it('maps a value already at 0.5 to the same 0.5 value', () => {
			const result = roundToHalfGrid(new Point(3.5, 7.5));
			expect(result.x).toBe(3.5);
			expect(result.y).toBe(7.5);
		});

		it('maps 0.99 to 0.5 (floor stays at 0)', () => {
			const result = roundToHalfGrid(new Point(0.99, 0.99));
			expect(result.x).toBeCloseTo(0.5, 10);
			expect(result.y).toBeCloseTo(0.5, 10);
		});

		it('handles negative values: floor(-1.2) + 0.5 = -1.5', () => {
			const result = roundToHalfGrid(new Point(-1.2, -2.7));
			expect(result.x).toBe(-1.5);
			expect(result.y).toBe(-2.5);
		});

		it('does not mutate the original point', () => {
			const p = new Point(1.7, 2.3);
			roundToHalfGrid(p);
			expect(p.x).toBe(1.7);
			expect(p.y).toBe(2.3);
		});
	});

	describe('inline = true', () => {
		it('returns the same Point instance', () => {
			const p = new Point(1.2, 3.7);
			const result = roundToHalfGrid(p, true);
			expect(result).toBe(p);
		});

		it('mutates x and y on the original point', () => {
			const p = new Point(1.2, 3.7);
			roundToHalfGrid(p, true);
			expect(p.x).toBe(1.5);
			expect(p.y).toBe(3.5);
		});

		it('handles an integer input inline', () => {
			const p = new Point(4, 6);
			roundToHalfGrid(p, true);
			expect(p.x).toBe(4.5);
			expect(p.y).toBe(6.5);
		});

		it('handles negative values inline', () => {
			const p = new Point(-1.2, -2.7);
			roundToHalfGrid(p, true);
			expect(p.x).toBe(-1.5);
			expect(p.y).toBe(-2.5);
		});
	});
});
