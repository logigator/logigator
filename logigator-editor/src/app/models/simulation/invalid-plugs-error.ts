export class InvalidPlugsError extends Error {

	public readonly comp?: number;
	public readonly plugIndex?: number;

	constructor(message: string, comp: number, plugIndex: number) {
		super(message);

		this.comp = comp;
		this.plugIndex = plugIndex;
	}
}
