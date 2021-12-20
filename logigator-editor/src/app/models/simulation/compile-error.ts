export class CompileError extends Error {

	public readonly src?: number;
	public readonly comp?: number;

	constructor(message: string, src?: number, comp?: number) {
		super(message);

		this.src = src;
		this.comp = comp;
	}
}
