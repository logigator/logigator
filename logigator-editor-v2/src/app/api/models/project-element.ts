/**
 * A single element in a circuit (component instance or wire).
 * This is the core wire format sent to / received from the backend.
 */
export interface ProjectElement {
	/** typeId */
	t: number;
	/** number of outputs */
	o?: number;
	/** number of inputs */
	i?: number;
	/** position [x, y] in grid units */
	p: [number, number];
	/** end position [x, y] in grid units (for wires) */
	q?: [number, number];
	/** rotation */
	r?: number;
	/** numerical data (up to 64 values) */
	n?: number[];
	/** string data (up to 32768 chars) */
	s?: string;
}
